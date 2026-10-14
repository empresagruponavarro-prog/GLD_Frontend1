import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '@env';
import { SESION_STORAGE_KEY, Sesion, returnUrlSeguro } from './auth.models';
import { AuthService } from './auth.service';
import { MemoryStorage, provideSesionStorage } from './auth.testing';

const storage = new MemoryStorage();

const HORA = 60 * 60 * 1000;

function sesion(expiraEnMs: number, rol = 'Administrador'): Sesion {
  return {
    token: 'tok-123',
    expiraEn: new Date(Date.now() + expiraEnMs).toISOString(),
    usuario: { id: 'USR001', usuario: 'admin', nombres: 'Ana Pérez', rol },
  };
}

function setup(guardada?: unknown) {
  if (guardada !== undefined) {
    storage.setItem(SESION_STORAGE_KEY, typeof guardada === 'string' ? guardada : JSON.stringify(guardada));
  }
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSesionStorage(storage)],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const auth = TestBed.inject(AuthService);
  const http = TestBed.inject(HttpTestingController);
  return { auth, http, navigate };
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
    storage.clear();
  });

  it('login guarda la sesión en localStorage y expone usuario y rol', () => {
    const { auth, http } = setup();
    expect(auth.autenticado()).toBe(false);

    let usuario: unknown;
    auth.login('admin', 'secreta123').subscribe((u) => (usuario = u));
    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ usuario: 'admin', clave: 'secreta123' });
    const respuesta = sesion(8 * HORA);
    req.flush(respuesta);

    expect(usuario).toEqual(respuesta.usuario);
    expect(auth.autenticado()).toBe(true);
    expect(auth.token()).toBe('tok-123');
    expect(auth.rol()).toBe('Administrador');
    expect(auth.esAdministrador()).toBe(true);
    expect(JSON.parse(storage.getItem(SESION_STORAGE_KEY) ?? 'null')).toEqual(respuesta);
  });

  it('login con credenciales inválidas propaga el error y no guarda nada', () => {
    const { auth, http } = setup();
    let status = 0;
    auth.login('admin', 'mala').subscribe({ error: (e) => (status = e.status) });
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ message: 'Usuario o contraseña incorrectos' }, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
    expect(auth.autenticado()).toBe(false);
    expect(storage.getItem(SESION_STORAGE_KEY)).toBeNull();
  });

  it('restaura al iniciar una sesión guardada válida', () => {
    const { auth } = setup(sesion(2 * HORA, 'Supervisor'));
    expect(auth.autenticado()).toBe(true);
    expect(auth.usuario()?.usuario).toBe('admin');
    expect(auth.rol()).toBe('Supervisor');
    expect(auth.esAdministrador()).toBe(false);
  });

  it('borra una sesión guardada vencida', () => {
    const { auth } = setup(sesion(-1000));
    expect(auth.autenticado()).toBe(false);
    expect(storage.getItem(SESION_STORAGE_KEY)).toBeNull();
  });

  it('recuerda una sola vez que la sesión guardada estaba vencida al abrir la app', () => {
    const { auth } = setup(sesion(-1000));
    expect(auth.consumirVencidaAlIniciar()).toBe(true);
    expect(auth.consumirVencidaAlIniciar()).toBe(false);
  });

  it.each([
    ['sin sesión guardada', undefined],
    ['sesión vigente', sesion(HORA)],
    ['sesión corrupta', '{no-es-json'],
  ])('no marca vencida al iniciar (%s)', (_caso, guardada) => {
    const { auth } = setup(guardada);
    expect(auth.consumirVencidaAlIniciar()).toBe(false);
  });

  it.each([
    ['JSON corrupto', '{no-es-json'],
    ['sin token', { expiraEn: new Date(Date.now() + HORA).toISOString(), usuario: { id: '1', usuario: 'a', nombres: null, rol: 'Usuario' } }],
    ['fecha inválida', { token: 't', expiraEn: 'mañana', usuario: { id: '1', usuario: 'a', nombres: null, rol: 'Usuario' } }],
    ['sin usuario', { token: 't', expiraEn: new Date(Date.now() + HORA).toISOString() }],
  ])('borra una sesión guardada corrupta (%s)', (_caso, valor) => {
    const { auth } = setup(valor);
    expect(auth.autenticado()).toBe(false);
    expect(storage.getItem(SESION_STORAGE_KEY)).toBeNull();
  });

  it('logout limpia la sesión y navega a /login', () => {
    const { auth, navigate } = setup(sesion(HORA));
    auth.logout();
    expect(auth.autenticado()).toBe(false);
    expect(auth.token()).toBeNull();
    expect(auth.usuario()).toBeNull();
    expect(storage.getItem(SESION_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });

  it('logout sin redirigir no navega', () => {
    const { auth, navigate } = setup(sesion(HORA));
    auth.logout({ redirigir: false });
    expect(auth.autenticado()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('tieneRol compara con el rol del usuario', () => {
    const { auth } = setup(sesion(HORA, 'Promotor'));
    expect(auth.tieneRol('Promotor')).toBe(true);
    expect(auth.tieneRol('Administrador', 'Promotor')).toBe(true);
    expect(auth.tieneRol('Administrador')).toBe(false);
    auth.logout({ redirigir: false });
    expect(auth.tieneRol('Promotor')).toBe(false);
  });

  it('cierra la sesión automáticamente al llegar expiraEn', () => {
    const { auth, navigate } = setup(sesion(8 * HORA));
    vi.advanceTimersByTime(8 * HORA - 1000);
    expect(auth.autenticado()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(auth.autenticado()).toBe(false);
    expect(storage.getItem(SESION_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { motivo: 'expirada' } });
  });

  it('sesionVigente borra una sesión que venció aunque el temporizador no se haya disparado', () => {
    const { auth } = setup(sesion(HORA));
    vi.setSystemTime(Date.now() + 2 * HORA);
    expect(auth.token()).toBeNull();
    expect(auth.sesionVigente()).toBe(false);
    expect(auth.autenticado()).toBe(false);
  });

  it('cierra la sesión cuando otra pestaña la cierra (evento storage)', () => {
    const { auth, navigate } = setup(sesion(HORA));
    storage.removeItem(SESION_STORAGE_KEY);
    window.dispatchEvent(new StorageEvent('storage', { key: SESION_STORAGE_KEY, newValue: null }));
    expect(auth.autenticado()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });

  it('adopta la sesión iniciada en otra pestaña e ignora otras claves', () => {
    const { auth } = setup();
    window.dispatchEvent(new StorageEvent('storage', { key: 'otra.clave', newValue: 'x' }));
    expect(auth.autenticado()).toBe(false);

    storage.setItem(SESION_STORAGE_KEY, JSON.stringify(sesion(HORA, 'Usuario')));
    window.dispatchEvent(new StorageEvent('storage', { key: SESION_STORAGE_KEY }));
    expect(auth.autenticado()).toBe(true);
    expect(auth.rol()).toBe('Usuario');
  });
});

describe('returnUrlSeguro', () => {
  it.each([
    ['/centros-costos/5/datos?tab=1', '/centros-costos/5/datos?tab=1'],
    ['/admin/usuarios', '/admin/usuarios'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['http://evil.com', '/'],
    ['https://evil.com/x', '/'],
    ['javascript:alert(1)', '/'],
    ['evil.com', '/'],
    ['/login?returnUrl=/x', '/'],
    ['', '/'],
    [null, '/'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(returnUrlSeguro(entrada)).toBe(esperado);
  });
});
