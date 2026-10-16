import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '@env';
import { SESION_STORAGE_KEY, Sesion } from './auth.models';
import { AvisosService } from '../avisos/avisos.service';
import { MSG_SIN_PERMISO, authInterceptor, esUrlDelApi } from './auth.interceptor';
import { AuthService } from './auth.service';
import { MIS_PERMISOS_URL, MemoryStorage, misPermisos, provideSesionStorage } from './auth.testing';
import { PermisosService } from './permisos.service';

const storage = new MemoryStorage();

const API = environment.apiUrl;

function setup(conSesion = true) {
  if (conSesion) {
    const s: Sesion = {
      token: 'tok-abc',
      expiraEn: new Date(Date.now() + 8 * 3600_000).toISOString(),
      usuario: { id: 'USR001', usuario: 'admin', nombres: null, rol: 'Administrador' },
    };
    storage.setItem(SESION_STORAGE_KEY, JSON.stringify(s));
  }
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      provideSesionStorage(storage),
    ],
  });
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'url', 'get').mockReturnValue('/centros-costos/7/datos?tab=planos');
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  return {
    http: TestBed.inject(HttpClient),
    ctrl: TestBed.inject(HttpTestingController),
    auth: TestBed.inject(AuthService),
    avisos: TestBed.inject(AvisosService),
    permisos: TestBed.inject(PermisosService),
    navigate,
  };
}

describe('authInterceptor', () => {
  beforeEach(() => storage.clear());
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.inject(AvisosService).cerrar();
    storage.clear();
  });

  it('añade Authorization: Bearer a las peticiones del API', () => {
    const { http, ctrl } = setup();
    http.get(`${API}/centros-costos`).subscribe();
    const req = ctrl.expectOne(`${API}/centros-costos`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-abc');
    req.flush([]);
  });

  it('no añade el token a otros dominios ni a rutas relativas', () => {
    const { http, ctrl } = setup();
    http.get('https://otro-dominio.com/datos').subscribe();
    http.get(`${API}.evil.com/datos`).subscribe();
    http.get('assets/config.json').subscribe();
    for (const req of ctrl.match(() => true)) {
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    }
  });

  it('sin sesión no añade la cabecera', () => {
    const { http, ctrl } = setup(false);
    http.get(`${API}/centros-costos`).subscribe();
    const req = ctrl.expectOne(`${API}/centros-costos`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('ante un 401 del API cierra la sesión y navega a /login con returnUrl y motivo', () => {
    const { http, ctrl, auth, navigate } = setup();
    let status = 0;
    http.get(`${API}/centros-costos`).subscribe({ error: (e) => (status = e.status) });
    ctrl.expectOne(`${API}/centros-costos`).flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(auth.autenticado()).toBe(false);
    expect(storage.getItem(SESION_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { motivo: 'expirada', returnUrl: '/centros-costos/7/datos?tab=planos' },
    });
  });

  it('un 401 de /auth/login no cierra la sesión ni navega', () => {
    const { http, ctrl, auth, navigate } = setup();
    http.post(`${API}/auth/login`, { usuario: 'x', clave: 'y' }).subscribe({ error: () => undefined });
    ctrl.expectOne(`${API}/auth/login`).flush({ message: 'Usuario o contraseña incorrectos' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.autenticado()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('otros errores (403, 500) no cierran la sesión', () => {
    const { http, ctrl, auth } = setup();
    http.get(`${API}/a`).subscribe({ error: () => undefined });
    http.get(`${API}/b`).subscribe({ error: () => undefined });
    ctrl.expectOne(`${API}/a`).flush({}, { status: 403, statusText: 'Forbidden' });
    ctrl.expectOne(`${API}/b`).flush({}, { status: 500, statusText: 'Error' });
    expect(auth.autenticado()).toBe(true);
    // El 403 recarga los permisos.
    ctrl.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Administrador', {}, true));
  });

  it('un 403 USUARIO_INACTIVO cierra la sesión y lleva a /login?motivo=inactivo', () => {
    const { http, ctrl, auth, navigate } = setup();
    let status = 0;
    http.get(`${API}/centros-costos`).subscribe({ error: (e) => (status = e.status) });
    ctrl
      .expectOne(`${API}/centros-costos`)
      .flush(
        { message: 'Tu usuario está desactivado. Contacta al administrador', codigo: 'USUARIO_INACTIVO' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(status).toBe(403);
    expect(auth.autenticado()).toBe(false);
    expect(storage.getItem(SESION_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { motivo: 'inactivo' } });
    // Sigue igual: no muestra el aviso de permiso ni recarga permisos.
    expect(TestBed.inject(AvisosService).aviso()).toBeNull();
    ctrl.expectNone(MIS_PERMISOS_URL);
  });

  it('un 403 de permisos (sin codigo USUARIO_INACTIVO) no cierra la sesión: avisa, recarga permisos y propaga el error', async () => {
    const { http, ctrl, auth, avisos, permisos, navigate } = setup();
    let status = 0;
    http.get(`${API}/a`).subscribe({ error: (e) => (status = e.status) });
    ctrl
      .expectOne(`${API}/a`)
      .flush({ message: 'No tienes permiso', codigo: 'SIN_PERMISO' }, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
    expect(auth.autenticado()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    expect(avisos.aviso()).toEqual({ texto: MSG_SIN_PERMISO, tipo: 'error' });
    expect(permisos.cargando()).toBe(true);

    const recarga = ctrl.expectOne(MIS_PERMISOS_URL);
    expect(recarga.request.headers.get('Authorization')).toBe('Bearer tok-abc');
    recarga.flush(misPermisos('Administrador', {}, true));
    await permisos.listo();
    expect(permisos.cargado()).toBe(true);
  });

  it('un 403 de /auth/mis-permisos no vuelve a recargar (sin bucle)', async () => {
    const { ctrl, avisos, permisos } = setup();
    const carga = permisos.recargar();
    ctrl.expectOne(MIS_PERMISOS_URL).flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect(await carga).toBeNull();
    ctrl.expectNone(MIS_PERMISOS_URL);
    expect(avisos.aviso()).toBeNull();
  });

  it('un 403 inactivo del propio /auth/login no navega (lo muestra la pantalla de login)', () => {
    const { http, ctrl, navigate } = setup(false);
    http.post(`${API}/auth/login`, { usuario: 'x', clave: 'y' }).subscribe({ error: () => undefined });
    ctrl
      .expectOne(`${API}/auth/login`)
      .flush({ message: 'desactivado', codigo: 'USUARIO_INACTIVO' }, { status: 403, statusText: 'Forbidden' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('un 401 de otro dominio no cierra la sesión', () => {
    const { http, ctrl, auth } = setup();
    http.get('https://otro-dominio.com/x').subscribe({ error: () => undefined });
    ctrl.expectOne('https://otro-dominio.com/x').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.autenticado()).toBe(true);
  });
});

describe('esUrlDelApi', () => {
  it.each([
    [`${API}`, true],
    [`${API}/x`, true],
    [`${API}?a=1`, true],
    [`${API}0/x`, false],
    [`${API}.evil.com/x`, false],
    ['https://evil.com/?u=' + API, false],
    ['/relativa', false],
  ])('%s -> %s', (url, esperado) => {
    expect(esUrlDelApi(url)).toBe(esperado);
  });
});
