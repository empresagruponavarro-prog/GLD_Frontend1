import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { environment } from '@env';
import { UsuarioSesion } from '@app/core/auth/auth.models';
import { AuthService } from '@app/core/auth/auth.service';
import { cargarPermisos, misPermisos } from '@app/core/auth/auth.testing';
import { MisPermisos } from '@app/core/auth/permisos.models';
import { UsuariosComponent } from './usuarios';
import { Usuario } from './interfaces';
import { validarClaveNueva } from './usuarios.validators';

const API = `${environment.apiUrl}/administration/usuarios`;
const ROLES = ['Administrador', 'Promotor', 'Supervisor', 'Usuario'];
const USUARIO: Usuario = { IdUsuario: 'USR001', Nombres: 'Ana Pérez', Usuario: 'aperez', Rol: 'Promotor', activo: true };
/** Usuario de la sesión. */
const YO: Usuario = { IdUsuario: 'USR-0001', Nombres: 'Admin GLD', Usuario: 'admin', Rol: 'Administrador', activo: true };
const INACTIVO: Usuario = { IdUsuario: 'USR002', Nombres: 'Luis Díaz', Usuario: 'ldiaz', Rol: 'Usuario', activo: false };
const SESION: UsuarioSesion = { id: 'USR-0001', usuario: 'admin', nombres: 'Admin GLD', rol: 'Administrador' };

const ADMIN = misPermisos('Administrador', {}, true);

async function setup(roles: string[] | 'error' = ROLES, usuarios: Usuario[] = [USUARIO], permisos: MisPermisos = ADMIN) {
  TestBed.configureTestingModule({
    imports: [UsuariosComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: AuthService, useValue: { usuario: signal<UsuarioSesion | null>(SESION), token: () => 'tok-admin' } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(UsuariosComponent);
  await cargarPermisos(permisos);
  const reqRoles = http.expectOne(`${API}/roles`);
  if (roles === 'error') reqRoles.flush({ message: 'Fallo' }, { status: 500, statusText: 'Server Error' });
  else reqRoles.flush(roles);
  http.expectOne(API).flush(usuarios);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const q = <T extends Element>(sel: string) => el.querySelector<T>(sel);
  const escribir = (sel: string, valor: string) => {
    const input = q<HTMLInputElement>(sel)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };
  const render = () => fixture.whenStable();
  const guardar = async () => {
    q<HTMLFormElement>('.modal-content form')!.dispatchEvent(new Event('submit'));
    await render();
  };
  const fila = (login: string) =>
    Array.from(el.querySelectorAll<HTMLTableRowElement>('tbody tr')).find((tr) =>
      Array.from(tr.cells).some((td) => td.textContent?.trim() === login),
    );
  const logins = () =>
    Array.from(el.querySelectorAll<HTMLTableRowElement>('tbody tr'))
      .map((tr) => tr.cells[2]?.textContent?.trim())
      .filter((t): t is string => !!t);
  const click = async (target: Element | null | undefined) => {
    (target as HTMLElement).click();
    await render();
  };
  return { http, el, q, escribir, render, guardar, fila, logins, click, cmp: fixture.componentInstance };
}

describe('UsuariosComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lista usuarios sin columna ni datos de clave', async () => {
    const { el } = await setup();
    const texto = el.textContent ?? '';
    expect(texto).toContain('aperez');
    expect(texto.toLowerCase()).not.toContain('clave');
    expect(el.querySelectorAll('input[type="password"]').length).toBe(0);
  });

  it('carga el select de roles desde el catálogo del backend', async () => {
    const { q, cmp, render } = await setup();
    cmp.openModal();
    await render();
    const opciones = Array.from(q<HTMLSelectElement>('#usuario-rol')!.options)
      .filter((o) => !o.disabled)
      .map((o) => o.value);
    expect(opciones).toEqual(ROLES);
    expect(q('[data-testid="usuario-roles-aviso"]')).toBeNull();
    expect(q<HTMLAnchorElement>('[data-testid="usuario-admin-roles"]')?.getAttribute('href')).toBe('/admin/roles');
  });

  it('si falla la carga de roles avisa y no inventa la lista', async () => {
    const { q, cmp, render, escribir, guardar, http } = await setup('error');
    cmp.openModal();
    await render();
    const opciones = Array.from(q<HTMLSelectElement>('#usuario-rol')!.options).filter((o) => !o.disabled);
    expect(opciones).toEqual([]);
    expect(q('[data-testid="usuario-roles-aviso"]')?.textContent).toContain('No se pudieron cargar los roles');

    escribir('#usuario-nombres', 'Luis Díaz');
    escribir('#usuario-login', 'ldiaz');
    await guardar();
    expect(q('[data-testid="usuario-form-error"]')?.textContent).toContain('Seleccione un rol válido');
    http.expectNone((r) => r.method === 'POST');
  });

  it('"Actualizar" refresca el select de roles (p. ej. tras renombrar uno en Administración de Roles)', async () => {
    const { el, q, cmp, render, http } = await setup();
    const actualizar = Array.from(el.querySelectorAll<HTMLButtonElement>('.content-header button'))
      .find((b) => b.textContent?.includes('Actualizar'))!;
    actualizar.click();
    http.expectOne(`${API}/roles`).flush(['Administrador', 'Almacenero', 'Supervisor']);
    http.expectOne(API).flush([{ ...USUARIO, Rol: 'Almacenero' }]);
    await render();
    expect(el.textContent).toContain('Almacenero');

    cmp.openModal();
    await render();
    const opciones = Array.from(q<HTMLSelectElement>('#usuario-rol')!.options)
      .filter((o) => !o.disabled)
      .map((o) => o.value);
    expect(opciones).toEqual(['Administrador', 'Almacenero', 'Supervisor']);
  });

  it('crear exige clave de 8+ caracteres y confirmación coincidente', async () => {
    const { q, cmp, render, escribir, guardar, http } = await setup();
    cmp.openModal();
    await render();
    escribir('#usuario-nombres', 'Luis Díaz');
    escribir('#usuario-login', 'ldiaz');

    await guardar();
    expect(q('[data-testid="usuario-form-error"]')?.textContent).toContain('Ingrese la contraseña');

    escribir('#usuario-clave', 'corta');
    escribir('#usuario-clave-confirmar', 'corta');
    await guardar();
    expect(q('[data-testid="usuario-form-error"]')?.textContent).toContain('al menos 8');

    escribir('#usuario-clave', 'segura-123');
    escribir('#usuario-clave-confirmar', 'otra-123');
    await guardar();
    expect(q('[data-testid="usuario-form-error"]')?.textContent).toContain('no coincide');

    escribir('#usuario-clave-confirmar', 'segura-123');
    await guardar();
    const req = http.expectOne((r) => r.url === API && r.method === 'POST');
    expect(req.request.body).toEqual({
      Nombres: 'Luis Díaz',
      Usuario: 'ldiaz',
      Rol: 'Usuario',
      Clave: 'segura-123',
    });
    req.flush({});
    http.expectOne(API).flush([]);
  });

  it('el título es "Administración de Usuarios" (los roles tienen su propia pantalla)', async () => {
    const { q } = await setup();
    expect(q('.content-title')?.textContent?.trim()).toBe('Administración de Usuarios');
  });

  it('Escape cierra el formulario, pero no mientras se guarda', async () => {
    const { q, cmp, render, escribir, guardar, http } = await setup();
    const escape = async () => {
      q('#usuario-nombres')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await render();
    };
    cmp.openModal();
    await render();
    await escape();
    expect(q('.modal-content')).toBeNull();

    cmp.openModal();
    await render();
    escribir('#usuario-nombres', 'Luis Díaz');
    escribir('#usuario-login', 'ldiaz');
    escribir('#usuario-clave', 'segura-123');
    escribir('#usuario-clave-confirmar', 'segura-123');
    await guardar();
    const req = http.expectOne((r) => r.url === API && r.method === 'POST');
    await escape();
    expect(q('.modal-content')).not.toBeNull();
    req.flush({});
    http.expectOne(API).flush([]);
  });

  it('muestra el mensaje del backend ante un 409 (usuario duplicado)', async () => {
    const { q, cmp, render, escribir, guardar, http } = await setup();
    cmp.openModal();
    await render();
    escribir('#usuario-nombres', 'Otro');
    escribir('#usuario-login', 'aperez');
    escribir('#usuario-clave', 'segura-123');
    escribir('#usuario-clave-confirmar', 'segura-123');
    await guardar();
    http
      .expectOne((r) => r.method === 'POST')
      .flush({ message: 'El usuario "aperez" ya existe' }, { status: 409, statusText: 'Conflict' });
    await render();
    expect(q('[role="alert"]')?.textContent).toContain('El usuario "aperez" ya existe');
    expect(q('.modal-content')).not.toBeNull();
  });

  it('editar no pide ni envía la clave salvo que se marque "Cambiar contraseña"', async () => {
    const { q, cmp, render, escribir, guardar, http } = await setup();
    cmp.editModal(USUARIO);
    await render();
    expect(q('#usuario-clave')).toBeNull();

    escribir('#usuario-nombres', 'Ana María Pérez');
    await guardar();
    const sinClave = http.expectOne(`${API}/USR001`);
    expect(sinClave.request.method).toBe('PATCH');
    expect(sinClave.request.body).toEqual({ Nombres: 'Ana María Pérez', Usuario: 'aperez', Rol: 'Promotor' });
    sinClave.flush({});
    http.expectOne(API).flush([USUARIO]);
    await render();

    cmp.editModal(USUARIO);
    await render();
    const check = q<HTMLInputElement>('#usuario-cambiar-clave')!;
    check.click();
    await render();
    escribir('#usuario-clave', 'nueva-clave-1');
    escribir('#usuario-clave-confirmar', 'nueva-clave-1');
    await guardar();
    const conClave = http.expectOne(`${API}/USR001`);
    expect(conClave.request.body).toEqual({ Nombres: 'Ana Pérez', Usuario: 'aperez', Rol: 'Promotor', Clave: 'nueva-clave-1' });
    conClave.flush({});
    http.expectOne(API).flush([USUARIO]);
  });

  it('un rol heredado fuera del catálogo obliga a elegir uno válido', async () => {
    const { q, cmp, render, guardar } = await setup();
    cmp.editModal({ ...USUARIO, Rol: 'Operador' });
    await render();
    await guardar();
    expect(q('[data-testid="usuario-form-error"]')?.textContent).toContain('Seleccione un rol válido');
  });
});

describe('UsuariosComponent — estado activo/inactivo', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra la columna Estado con insignia Activo/Inactivo y filtra por estado', async () => {
    const { el, q, fila, logins, render } = await setup(ROLES, [USUARIO, YO, INACTIVO]);
    const encabezados = Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(encabezados).toContain('Estado');
    expect(fila('aperez')?.querySelector('[data-testid="usuario-estado"]')?.textContent).toContain('Activo');
    expect(fila('ldiaz')?.querySelector('[data-testid="usuario-estado"]')?.textContent).toContain('Inactivo');
    expect(logins()).toEqual(['aperez', 'admin', 'ldiaz']);

    const filtro = q<HTMLSelectElement>('#usuarios-filtro-estado')!;
    expect(q('label[for="usuarios-filtro-estado"]')?.textContent).toContain('Estado');
    filtro.value = 'inactivos';
    filtro.dispatchEvent(new Event('change'));
    await render();
    expect(logins()).toEqual(['ldiaz']);

    filtro.value = 'activos';
    filtro.dispatchEvent(new Event('change'));
    await render();
    expect(logins()).toEqual(['aperez', 'admin']);

    filtro.value = 'todos';
    filtro.dispatchEvent(new Event('change'));
    await render();
    expect(logins()).toEqual(['aperez', 'admin', 'ldiaz']);
  });

  it('desactivar pide confirmación dentro de la pantalla; Cancelar no envía y Confirmar envía PATCH', async () => {
    const { q, http, fila, click, render } = await setup(ROLES, [USUARIO, YO]);
    const boton = () => fila('aperez')?.querySelector<HTMLButtonElement>('[data-testid="usuario-estado-btn"]');
    expect(boton()?.getAttribute('aria-label')).toBe('Desactivar usuario aperez');

    await click(boton());
    expect(q('[data-testid="usuario-confirm"]')?.getAttribute('role')).toBe('alertdialog');
    expect(q('#usuario-confirm-desc')?.textContent).toContain('¿Desactivar a "aperez"?');
    expect(q('[data-testid="usuario-confirm-cancelar"]') === document.activeElement).toBe(true);
    await click(q('[data-testid="usuario-confirm-cancelar"]'));
    expect(q('[data-testid="usuario-confirm"]')).toBeNull();
    http.expectNone((r) => r.method === 'PATCH');

    // Escape también cierra.
    await click(boton());
    q('[data-testid="usuario-confirm"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await render();
    expect(q('[data-testid="usuario-confirm"]')).toBeNull();

    await click(boton());
    await click(q('[data-testid="usuario-confirm-aceptar"]'));
    const req = http.expectOne(`${API}/USR001/estado`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activo: false });
    req.flush({ ...USUARIO, activo: false });
    await render();
    expect(q('[data-testid="usuario-confirm"]')).toBeNull();
    expect(fila('aperez')?.querySelector('[data-testid="usuario-estado"]')?.textContent).toContain('Inactivo');
    expect(boton()?.getAttribute('aria-label')).toBe('Reactivar usuario aperez');
    expect(q('[data-testid="usuarios-aviso"]')?.textContent).toContain('desactivado');
  });

  it('reactivar envía { activo: true }', async () => {
    const { q, http, fila, click, render } = await setup(ROLES, [INACTIVO]);
    await click(fila('ldiaz')?.querySelector('[data-testid="usuario-estado-btn"]'));
    expect(q('#usuario-confirm-title')?.textContent).toContain('Reactivar usuario');
    await click(q('[data-testid="usuario-confirm-aceptar"]'));
    const req = http.expectOne(`${API}/USR002/estado`);
    expect(req.request.body).toEqual({ activo: true });
    req.flush({ ...INACTIVO, activo: true });
    await render();
    expect(fila('ldiaz')?.querySelector('[data-testid="usuario-estado"]')?.textContent).toContain('Activo');
  });

  it('el botón está deshabilitado para el propio usuario de la sesión, con explicación', async () => {
    const { q, fila } = await setup(ROLES, [USUARIO, YO]);
    const propio = fila('admin')?.querySelector<HTMLButtonElement>('[data-testid="usuario-estado-btn"]');
    expect(propio?.disabled).toBe(true);
    expect(propio?.closest('[title]')?.getAttribute('title')).toContain('No puedes desactivar tu propio usuario');
    expect(q(`#${propio?.getAttribute('aria-describedby')}`)?.textContent).toContain('No puedes desactivar tu propio usuario');
    expect(fila('aperez')?.querySelector<HTMLButtonElement>('[data-testid="usuario-estado-btn"]')?.disabled).toBe(false);
  });

  it('un 409 del backend se muestra en la confirmación (role="alert")', async () => {
    const { q, http, fila, click, render } = await setup(ROLES, [USUARIO]);
    await click(fila('aperez')?.querySelector('[data-testid="usuario-estado-btn"]'));
    await click(q('[data-testid="usuario-confirm-aceptar"]'));
    http
      .expectOne(`${API}/USR001/estado`)
      .flush({ message: 'Debe quedar al menos un Administrador activo' }, { status: 409, statusText: 'Conflict' });
    await render();
    const alerta = q('[data-testid="usuario-confirm-error"]');
    expect(alerta?.getAttribute('role')).toBe('alert');
    expect(alerta?.textContent).toContain('Debe quedar al menos un Administrador activo');
    expect(q('[data-testid="usuario-confirm"]')).not.toBeNull();
    expect(fila('aperez')?.querySelector('[data-testid="usuario-estado"]')?.textContent).toContain('Activo');
  });

  it('eliminar también se confirma dentro de la pantalla (sin confirm())', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { q, http, fila, click, render } = await setup(ROLES, [USUARIO]);
    await click(fila('aperez')?.querySelector('[aria-label="Eliminar usuario"]'));
    expect(q('#usuario-confirm-desc')?.textContent).toContain('¿Eliminar el usuario "aperez"?');
    await click(q('[data-testid="usuario-confirm-aceptar"]'));
    const req = http.expectOne(`${API}/USR001`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(API).flush([]);
    await render();
    expect(q('[data-testid="usuarios-aviso"]')?.textContent).toContain('eliminado');
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe('UsuariosComponent: botones según permisos (admin.usuarios)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const botones = (el: HTMLElement) => ({
    nuevo: Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Nuevo Usuario')),
    editar: el.querySelector('[aria-label="Editar usuario"]') !== null,
    estado: el.querySelector('[data-testid="usuario-estado-btn"]') !== null,
    eliminar: el.querySelector('[aria-label="Eliminar usuario"]') !== null,
  });

  it('con solo ver no aparecen + Nuevo, editar, activar/desactivar ni eliminar', async () => {
    const { el, cmp, render } = await setup(ROLES, [USUARIO, INACTIVO], misPermisos('Consulta', { 'admin.usuarios': {} }));
    expect(el.textContent).toContain('aperez');
    expect(botones(el)).toEqual({ nuevo: false, editar: false, estado: false, eliminar: false });
    // Defensa: los métodos que abren el alta/edición o piden confirmación no hacen nada.
    cmp.openModal();
    cmp.editModal(USUARIO);
    cmp.cambiarEstado(USUARIO);
    cmp.deleteUsuario(USUARIO);
    await render();
    expect(el.querySelector('.modal-overlay')).toBeNull();
  });

  it('crear muestra solo + Nuevo; editar muestra editar y activar/desactivar; eliminar solo eliminar', async () => {
    const crear = await setup(ROLES, [USUARIO], misPermisos('R', { 'admin.usuarios': { crear: true } }));
    expect(botones(crear.el)).toEqual({ nuevo: true, editar: false, estado: false, eliminar: false });
    TestBed.resetTestingModule();
    const editar = await setup(ROLES, [USUARIO], misPermisos('R', { 'admin.usuarios': { editar: true } }));
    expect(botones(editar.el)).toEqual({ nuevo: false, editar: true, estado: true, eliminar: false });
    TestBed.resetTestingModule();
    const eliminar = await setup(ROLES, [USUARIO], misPermisos('R', { 'admin.usuarios': { eliminar: true } }));
    expect(botones(eliminar.el)).toEqual({ nuevo: false, editar: false, estado: false, eliminar: true });
  });

  it('con editar se mantiene la regla de no desactivarse a sí mismo', async () => {
    const { fila } = await setup(ROLES, [YO], misPermisos('R', { 'admin.usuarios': { editar: true } }));
    const btn = fila('admin')?.querySelector<HTMLButtonElement>('[data-testid="usuario-estado-btn"]');
    expect(btn?.disabled).toBe(true);
  });
});

describe('validarClaveNueva', () => {
  it('aplica longitud 8-128 y confirmación', () => {
    expect(validarClaveNueva('', '')).toContain('Ingrese');
    expect(validarClaveNueva('1234567', '1234567')).toContain('al menos 8');
    expect(validarClaveNueva('x'.repeat(129), 'x'.repeat(129))).toContain('128');
    expect(validarClaveNueva('12345678', '12345679')).toContain('no coincide');
    expect(validarClaveNueva('12345678', '12345678')).toBeNull();
    expect(validarClaveNueva('x'.repeat(128), 'x'.repeat(128))).toBeNull();
  });
});
