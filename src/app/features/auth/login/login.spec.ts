import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, Routes, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '@env';
import { SESION_STORAGE_KEY } from '@app/core/auth/auth.models';
import { AuthService } from '@app/core/auth/auth.service';
import { MIS_PERMISOS_URL, MemoryStorage, misPermisos, provideSesionStorage } from '@app/core/auth/auth.testing';
import { MisPermisos } from '@app/core/auth/permisos.models';
import { PermisosService } from '@app/core/auth/permisos.service';
import { rutaModulo } from '@app/core/auth/permiso.guard';

const storage = new MemoryStorage();
import { LoginComponent } from './login';

const LOGIN = `${environment.apiUrl}/auth/login`;

@Component({ template: '' })
class PantallaVacia {}

/** Rutas mínimas para que el login sepa qué módulo exige cada destino. */
const RUTAS: Routes = [
  { path: '', children: [rutaModulo('presupuestos', PantallaVacia, 'presupuestos'), rutaModulo('tesoreria/pagos', PantallaVacia, 'tesoreria.pagos')] },
];

async function setup(queryParams: Record<string, string> = {}, rutas: Routes = []) {
  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter(rutas),
      provideSesionStorage(storage),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(LoginComponent);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const q = <T extends Element>(sel: string) => el.querySelector<T>(sel);

  const escribir = (sel: string, valor: string) => {
    const input = q<HTMLInputElement>(sel)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };
  const enviar = async () => {
    q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  const render = () => fixture.whenStable();
  /** Responde a `GET /auth/mis-permisos` (lo pide el login antes de navegar) y espera la navegación. */
  const permisos = async (respuesta: MisPermisos = misPermisos('Administrador', {}, true)) => {
    http.expectOne(MIS_PERMISOS_URL).flush(respuesta);
    await TestBed.inject(PermisosService).listo();
    await new Promise((r) => setTimeout(r)); // la navegación se encadena tras la carga
    await render();
  };
  return { fixture, http, navigateByUrl, q, escribir, enviar, render, permisos };
}

function respuestaOk() {
  return {
    token: 'tok',
    expiraEn: new Date(Date.now() + 8 * 3600_000).toISOString(),
    usuario: { id: 'USR001', usuario: 'admin', nombres: 'Ana', rol: 'Administrador' },
  };
}

describe('LoginComponent', () => {
  beforeEach(() => storage.clear());
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    storage.clear();
  });

  it('renderiza los campos con labels, autocompletado y foco en el usuario', async () => {
    const { q } = await setup();
    const usuario = q<HTMLInputElement>('#login-usuario')!;
    const clave = q<HTMLInputElement>('#login-clave')!;
    expect(q('label[for="login-usuario"]')?.textContent).toContain('Usuario');
    expect(q('label[for="login-clave"]')?.textContent).toContain('Contraseña');
    expect(usuario.getAttribute('autocomplete')).toBe('username');
    expect(clave.getAttribute('autocomplete')).toBe('current-password');
    expect(clave.type).toBe('password');
    expect(document.activeElement).toBe(usuario);
    expect(q('[data-testid="aviso-expirada"]')).toBeNull();
  });

  it('valida campos obligatorios sin llamar al backend', async () => {
    const { q, enviar } = await setup();
    await enviar();
    expect(q('#login-usuario-error')?.textContent).toContain('Ingresa tu usuario');
    expect(q('#login-clave-error')?.textContent).toContain('Ingresa tu contraseña');
    expect(q('#login-usuario')?.getAttribute('aria-invalid')).toBe('true');
    // HttpTestingController.verify() en afterEach confirma que no hubo petición.
  });

  it('un usuario de solo espacios no es válido', async () => {
    const { q, escribir, enviar } = await setup();
    escribir('#login-usuario', '   ');
    escribir('#login-clave', 'secreta123');
    await enviar();
    expect(q('#login-usuario-error')).not.toBeNull();
  });

  it('muestra y oculta la contraseña con aria-pressed', async () => {
    const { q, render } = await setup();
    const boton = q<HTMLButtonElement>('[data-testid="toggle-clave"]')!;
    expect(boton.getAttribute('aria-pressed')).toBe('false');
    expect(boton.getAttribute('aria-label')).toBe('Mostrar contraseña');

    boton.click();
    await render();
    expect(q<HTMLInputElement>('#login-clave')!.type).toBe('text');
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    expect(boton.getAttribute('aria-label')).toBe('Ocultar contraseña');

    boton.click();
    await render();
    expect(q<HTMLInputElement>('#login-clave')!.type).toBe('password');
  });

  it('envía credenciales, guarda la sesión, carga los permisos y navega a /', async () => {
    const { http, q, escribir, enviar, navigateByUrl, permisos } = await setup();
    escribir('#login-usuario', ' admin ');
    escribir('#login-clave', 'secreta123');
    await enviar();

    const boton = q<HTMLButtonElement>('button[type="submit"]')!;
    expect(boton.disabled).toBe(true);
    expect(boton.textContent).toContain('Ingresando');

    const req = http.expectOne(LOGIN);
    expect(req.request.body).toEqual({ usuario: 'admin', clave: 'secreta123' });
    req.flush(respuestaOk());
    expect(navigateByUrl).not.toHaveBeenCalled(); // espera los permisos
    await permisos();

    expect(TestBed.inject(AuthService).autenticado()).toBe(true);
    expect(storage.getItem(SESION_STORAGE_KEY)).not.toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('tras el login navega al returnUrl interno', async () => {
    const { http, escribir, enviar, navigateByUrl, permisos } = await setup({ returnUrl: '/presupuestos?id=4' }, RUTAS);
    escribir('#login-usuario', 'admin');
    escribir('#login-clave', 'secreta123');
    await enviar();
    http.expectOne(LOGIN).flush(respuestaOk());
    await permisos();
    expect(navigateByUrl).toHaveBeenCalledWith('/presupuestos?id=4', { replaceUrl: true });
  });

  it('si el returnUrl es de un módulo sin "ver", navega al inicio', async () => {
    const { http, escribir, enviar, navigateByUrl, permisos } = await setup({ returnUrl: '/tesoreria/pagos' }, RUTAS);
    escribir('#login-usuario', 'ana');
    escribir('#login-clave', 'secreta123');
    await enviar();
    http.expectOne(LOGIN).flush({ ...respuestaOk(), usuario: { id: 'USR002', usuario: 'ana', nombres: null, rol: 'Usuario' } });
    await permisos(misPermisos('Usuario', { presupuestos: {} }));
    expect(navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it('con "ver" del módulo del returnUrl navega a él', async () => {
    const { http, escribir, enviar, navigateByUrl, permisos } = await setup({ returnUrl: '/tesoreria/pagos' }, RUTAS);
    escribir('#login-usuario', 'ana');
    escribir('#login-clave', 'secreta123');
    await enviar();
    http.expectOne(LOGIN).flush({ ...respuestaOk(), usuario: { id: 'USR002', usuario: 'ana', nombres: null, rol: 'Usuario' } });
    await permisos(misPermisos('Usuario', { 'tesoreria.pagos': {} }));
    expect(navigateByUrl).toHaveBeenCalledWith('/tesoreria/pagos', { replaceUrl: true });
  });

  it('ignora un returnUrl externo', async () => {
    const { http, escribir, enviar, navigateByUrl, permisos } = await setup({ returnUrl: '//evil.com/robar' });
    escribir('#login-usuario', 'admin');
    escribir('#login-clave', 'secreta123');
    await enviar();
    http.expectOne(LOGIN).flush(respuestaOk());
    await permisos();
    expect(navigateByUrl).toHaveBeenCalledWith('/', { replaceUrl: true });
  });

  it.each([
    [401, { message: 'Usuario o contraseña incorrectos' }, 'Usuario o contraseña incorrectos'],
    [429, { message: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.' }, 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'],
    [429, null, 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'],
    [500, { message: 'boom' }, 'No se pudo iniciar sesión. Inténtalo de nuevo.'],
  ])('muestra el mensaje para HTTP %s', async (status, cuerpo, esperado) => {
    const { http, q, escribir, enviar, navigateByUrl, render } = await setup();
    escribir('#login-usuario', 'admin');
    escribir('#login-clave', 'mala-clave');
    await enviar();
    http.expectOne(LOGIN).flush(cuerpo, { status, statusText: 'Error' });
    await render();

    const alerta = q('[role="alert"]');
    expect(alerta?.textContent?.trim()).toBe(esperado);
    expect(q<HTMLInputElement>('#login-clave')!.value).toBe('');
    expect(q<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('muestra error de red cuando el servidor no responde', async () => {
    const { http, q, escribir, enviar, render } = await setup();
    escribir('#login-usuario', 'admin');
    escribir('#login-clave', 'secreta123');
    await enviar();
    http.expectOne(LOGIN).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await render();
    expect(q('[role="alert"]')?.textContent?.trim()).toBe('No se pudo conectar con el servidor');
  });

  it('muestra el aviso de usuario desactivado al llegar con ?motivo=inactivo', async () => {
    const { q } = await setup({ motivo: 'inactivo' });
    const aviso = q('[data-testid="aviso-inactivo"]');
    expect(aviso?.getAttribute('role')).toBe('alert');
    expect(aviso?.textContent?.trim()).toBe('Tu usuario está desactivado. Contacta al administrador');
    expect(q('[data-testid="aviso-expirada"]')).toBeNull();
  });

  it('muestra el aviso de usuario desactivado cuando el login responde 403 USUARIO_INACTIVO', async () => {
    const { http, q, escribir, enviar, navigateByUrl, render } = await setup();
    escribir('#login-usuario', 'ldiaz');
    escribir('#login-clave', 'secreta123');
    await enviar();
    http
      .expectOne(LOGIN)
      .flush(
        { message: 'Tu usuario está desactivado. Contacta al administrador', codigo: 'USUARIO_INACTIVO' },
        { status: 403, statusText: 'Forbidden' },
      );
    await render();
    expect(q('[role="alert"]')?.textContent?.trim()).toBe('Tu usuario está desactivado. Contacta al administrador');
    expect(TestBed.inject(AuthService).autenticado()).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('muestra el aviso de sesión expirada', async () => {
    const { q } = await setup({ motivo: 'expirada', returnUrl: '/presupuestos' });
    expect(q('[data-testid="aviso-expirada"]')?.textContent).toContain('sesión expiró');
  });
});
