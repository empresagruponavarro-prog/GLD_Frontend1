import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '@env';
import { UsuariosComponent } from './usuarios';
import { validarClaveNueva } from './usuarios.validators';

const API = `${environment.apiUrl}/administration/usuarios`;
const ROLES = ['Administrador', 'Promotor', 'Supervisor', 'Usuario'];
const USUARIO = { IdUsuario: 'USR001', Nombres: 'Ana Pérez', Usuario: 'aperez', Rol: 'Promotor' };

async function setup(roles: string[] | 'error' = ROLES) {
  TestBed.configureTestingModule({
    imports: [UsuariosComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(UsuariosComponent);
  const reqRoles = http.expectOne(`${API}/roles`);
  if (roles === 'error') reqRoles.flush({ message: 'Fallo' }, { status: 500, statusText: 'Server Error' });
  else reqRoles.flush(roles);
  http.expectOne(API).flush([USUARIO]);
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
  return { http, el, q, escribir, render, guardar, cmp: fixture.componentInstance };
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
