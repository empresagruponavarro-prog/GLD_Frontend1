import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env';
import { RolesComponent } from './roles';
import { RolAdmin } from './roles.service';
import { validarDescripcionRol, validarNombreRol } from './roles.validators';

const API = `${environment.apiUrl}/administration/roles`;
const ADMIN: RolAdmin = { id: 1, nombre: 'Administrador', descripcion: 'Acceso total', es_sistema: true, usuarios: 1 };
const PROMOTOR: RolAdmin = { id: 2, nombre: 'Promotor', descripcion: null, es_sistema: false, usuarios: 3 };
const VISITA: RolAdmin = { id: 3, nombre: 'Visita', descripcion: 'Solo lectura', es_sistema: false, usuarios: 0 };
const ROLES = [ADMIN, PROMOTOR, VISITA];

async function setup(roles: RolAdmin[] = ROLES) {
  TestBed.configureTestingModule({
    imports: [RolesComponent],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(RolesComponent);
  http.expectOne(API).flush(roles);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const q = <T extends Element>(sel: string) => el.querySelector<T>(sel);
  const render = () => fixture.whenStable();
  const filas = () => Array.from(el.querySelectorAll<HTMLTableRowElement>('[data-testid="rol-fila"]'));
  const fila = (nombre: string) => filas().find((f) => f.querySelector('strong')?.textContent?.trim() === nombre)!;
  const escribir = (sel: string, valor: string) => {
    const input = q<HTMLInputElement>(sel)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };
  const guardar = async () => {
    q<HTMLFormElement>('.modal-content form')!.dispatchEvent(new Event('submit'));
    await render();
  };
  const click = async (target: Element | null) => {
    (target as HTMLElement).click();
    await render();
  };
  return { http, el, q, render, filas, fila, escribir, guardar, click, cmp: fixture.componentInstance };
}

describe('RolesComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lista los roles con conteo de usuarios e insignia "Sistema"', async () => {
    const { filas, fila } = await setup();
    expect(filas().length).toBe(3);
    expect(fila('Administrador').querySelector('[data-testid="rol-sistema"]')?.textContent).toContain('Sistema');
    expect(fila('Administrador').querySelector('[data-testid="rol-sistema"] .fa-lock')).not.toBeNull();
    expect(fila('Administrador').querySelector('[data-testid="rol-usuarios"]')?.textContent).toContain('1 usuario');
    expect(fila('Promotor').querySelector('[data-testid="rol-sistema"]')).toBeNull();
    expect(fila('Promotor').querySelector('[data-testid="rol-usuarios"]')?.textContent).toContain('3 usuarios');
    expect(fila('Promotor').textContent).toContain('Sin descripción');
    expect(fila('Visita').querySelector('[data-testid="rol-usuarios"]')?.textContent).toContain('0 usuarios');
  });

  it('crear valida el nombre en el campo, envía POST y refresca la lista', async () => {
    const { q, http, escribir, guardar, click, el, render } = await setup();
    await click(q('[data-testid="roles-nuevo"]'));
    expect(q('#rol-modal-title')?.textContent).toContain('Nuevo Rol');
    expect(q('#rol-nombre') === document.activeElement).toBe(true);

    await guardar();
    expect(q('[data-testid="rol-nombre-error"]')?.textContent).toContain('Ingrese el nombre');
    expect(q('#rol-nombre')?.getAttribute('aria-invalid')).toBe('true');

    escribir('#rol-nombre', 'A');
    await render();
    expect(q('[data-testid="rol-nombre-error"]')?.textContent).toContain('al menos 2');

    escribir('#rol-nombre', 'Jefe/Obra');
    await render();
    expect(q('[data-testid="rol-nombre-error"]')?.textContent).toContain('Use solo letras');

    escribir('#rol-nombre', 'promotor');
    await guardar();
    expect(q('[data-testid="rol-nombre-error"]')?.textContent).toContain('Ya existe un rol');
    http.expectNone((r) => r.method === 'POST');

    escribir('#rol-nombre', '  Jefe de Obra Ñ.  ');
    escribir('#rol-descripcion', '  Supervisa la obra ');
    await guardar();
    const req = http.expectOne((r) => r.url === API && r.method === 'POST');
    expect(req.request.body).toEqual({ nombre: 'Jefe de Obra Ñ.', descripcion: 'Supervisa la obra' });
    req.flush({ id: 4, nombre: 'Jefe de Obra Ñ.', descripcion: 'Supervisa la obra', es_sistema: false, usuarios: 0 });
    http.expectOne((r) => r.url === API && r.method === 'GET').flush([
      ...ROLES,
      { id: 4, nombre: 'Jefe de Obra Ñ.', descripcion: 'Supervisa la obra', es_sistema: false, usuarios: 0 },
    ]);
    await render();
    expect(q('.modal-content')).toBeNull();
    expect(q('[data-testid="roles-aviso"]')?.textContent).toContain('creado');
    expect(el.textContent).toContain('Jefe de Obra Ñ.');
  });

  it('crear sin descripción no envía el campo', async () => {
    const { q, http, escribir, guardar, click } = await setup();
    await click(q('[data-testid="roles-nuevo"]'));
    escribir('#rol-nombre', 'Almacenero');
    await guardar();
    const req = http.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({ nombre: 'Almacenero' });
    req.flush({});
    http.expectOne(API).flush(ROLES);
  });

  it('editar Administrador: nombre bloqueado y solo envía la descripción', async () => {
    const { q, http, fila, escribir, guardar, click, render } = await setup();
    await click(fila('Administrador').querySelector('[data-testid="rol-editar"]'));
    const nombre = q<HTMLInputElement>('#rol-nombre')!;
    expect(nombre.disabled).toBe(true);
    expect(nombre.value).toBe('Administrador');
    expect(q('[data-testid="rol-sistema-aviso"]')).not.toBeNull();
    expect(q('#rol-descripcion') === document.activeElement).toBe(true);

    await guardar();
    expect(q('[data-testid="rol-form-error"]')?.textContent).toContain('No hay cambios');
    http.expectNone((r) => r.method === 'PATCH');

    escribir('#rol-descripcion', 'Acceso total al sistema');
    await guardar();
    const req = http.expectOne(`${API}/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ descripcion: 'Acceso total al sistema' });
    req.flush({ ...ADMIN, descripcion: 'Acceso total al sistema' });
    http.expectOne(API).flush(ROLES);
    await render();
    expect(q('.modal-content')).toBeNull();
  });

  it('renombrar otro rol envía solo el nombre nuevo', async () => {
    const { q, http, fila, escribir, guardar, click, render } = await setup();
    await click(fila('Promotor').querySelector('[data-testid="rol-editar"]'));
    expect(q<HTMLInputElement>('#rol-nombre')!.disabled).toBe(false);
    expect(q('.modal-content')?.textContent).toContain('se actualizará en 3 usuarios');

    escribir('#rol-nombre', 'Promotor Senior');
    await guardar();
    const req = http.expectOne(`${API}/2`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ nombre: 'Promotor Senior' });
    req.flush({ ...PROMOTOR, nombre: 'Promotor Senior' });
    http.expectOne(API).flush([ADMIN, { ...PROMOTOR, nombre: 'Promotor Senior' }, VISITA]);
    await render();
    expect(q('[data-testid="roles-aviso"]')?.textContent).toContain('actualizado');
  });

  it('muestra el 409 del backend en role="alert" y mantiene el modal abierto', async () => {
    const { q, http, escribir, guardar, click, render } = await setup();
    await click(q('[data-testid="roles-nuevo"]'));
    escribir('#rol-nombre', 'Supervisor');
    await guardar();
    http
      .expectOne((r) => r.method === 'POST')
      .flush({ message: 'Ya existe un rol "Supervisor"' }, { status: 409, statusText: 'Conflict' });
    await render();
    const alerta = q('.modal-content [role="alert"]');
    expect(alerta?.textContent).toContain('Ya existe un rol "Supervisor"');
    expect(q('.modal-content')).not.toBeNull();
  });

  it('eliminar está deshabilitado con explicación para el rol de sistema y para roles con usuarios', async () => {
    const { fila, q } = await setup();
    const admin = fila('Administrador').querySelector<HTMLButtonElement>('[data-testid="rol-eliminar"]')!;
    expect(admin.disabled).toBe(true);
    expect(admin.closest('[title]')?.getAttribute('title')).toContain('Rol de sistema');
    expect(q(`#${admin.getAttribute('aria-describedby')}`)?.textContent).toContain('Rol de sistema');

    const promotor = fila('Promotor').querySelector<HTMLButtonElement>('[data-testid="rol-eliminar"]')!;
    expect(promotor.disabled).toBe(true);
    expect(promotor.closest('[title]')?.getAttribute('title')).toContain('Asignado a 3 usuarios');

    expect(fila('Visita').querySelector<HTMLButtonElement>('[data-testid="rol-eliminar"]')!.disabled).toBe(false);
  });

  it('confirmar dentro de la pantalla envía DELETE y refresca; Cancelar no envía nada', async () => {
    const { q, http, fila, click, el, render } = await setup();
    const borrar = () => fila('Visita').querySelector('[data-testid="rol-eliminar"]');

    await click(borrar());
    expect(q('#rol-eliminar-desc')?.textContent).toContain('¿Eliminar el rol "Visita"?');
    expect(q('[data-testid="rol-eliminar-cancelar"]') === document.activeElement).toBe(true);
    await click(q('[data-testid="rol-eliminar-cancelar"]'));
    expect(q('#rol-eliminar-desc')).toBeNull();
    http.expectNone((r) => r.method === 'DELETE');

    await click(borrar());
    await click(q('[data-testid="rol-eliminar-confirmar"]'));
    const req = http.expectOne(`${API}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(API).flush([ADMIN, PROMOTOR]);
    await render();
    expect(q('#rol-eliminar-desc')).toBeNull();
    expect(q('[data-testid="roles-aviso"]')?.textContent).toContain('eliminado');
    expect(el.textContent).not.toContain('Solo lectura');
  });

  it('un 409 al eliminar se muestra en la confirmación', async () => {
    const { q, http, fila, click, render } = await setup();
    await click(fila('Visita').querySelector('[data-testid="rol-eliminar"]'));
    await click(q('[data-testid="rol-eliminar-confirmar"]'));
    http
      .expectOne(`${API}/3`)
      .flush({ message: 'El rol "Visita" tiene 2 usuarios asignados' }, { status: 409, statusText: 'Conflict' });
    await render();
    expect(q('[data-testid="rol-eliminar-error"]')?.getAttribute('role')).toBe('alert');
    expect(q('[data-testid="rol-eliminar-error"]')?.textContent).toContain('tiene 2 usuarios asignados');
  });

  it('Escape y clic en el fondo cierran el modal; no mientras se guarda', async () => {
    const { q, http, escribir, guardar, click, render } = await setup();
    await click(q('[data-testid="roles-nuevo"]'));
    q('#rol-nombre')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await render();
    expect(q('.modal-content')).toBeNull();

    await click(q('[data-testid="roles-nuevo"]'));
    await click(q('.modal-content'));
    expect(q('.modal-content')).not.toBeNull();
    await click(q('.modal-overlay'));
    expect(q('.modal-content')).toBeNull();

    await click(q('[data-testid="roles-nuevo"]'));
    escribir('#rol-nombre', 'Almacenero');
    await guardar();
    q('#rol-nombre')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await render();
    expect(q('.modal-content')).not.toBeNull();
    http.expectOne((r) => r.method === 'POST').flush({});
    http.expectOne(API).flush(ROLES);
  });

  it('muestra un aviso si no se puede cargar la lista', async () => {
    TestBed.configureTestingModule({
      imports: [RolesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RolesComponent);
    http.expectOne(API).flush({ message: 'Forbidden resource' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    const alerta = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="roles-page-error"]');
    expect(alerta?.getAttribute('role')).toBe('alert');
    expect(alerta?.textContent).toContain('Forbidden resource');
  });
});

describe('validarNombreRol / validarDescripcionRol', () => {
  it('aplica 2-50 caracteres y letras con tildes/ñ, números, espacios, guion y punto', () => {
    expect(validarNombreRol('   ')).toContain('Ingrese');
    expect(validarNombreRol('A')).toContain('al menos 2');
    expect(validarNombreRol('x'.repeat(51))).toContain('50');
    expect(validarNombreRol('Jefe_Obra')).toContain('Use solo');
    expect(validarNombreRol('Jefe@Obra')).toContain('Use solo');
    expect(validarNombreRol('Ab')).toBeNull();
    expect(validarNombreRol('x'.repeat(50))).toBeNull();
    expect(validarNombreRol('Señor Técnico-2 Sr.')).toBeNull();
    expect(validarDescripcionRol('x'.repeat(256))).toContain('255');
    expect(validarDescripcionRol('')).toBeNull();
  });
});
