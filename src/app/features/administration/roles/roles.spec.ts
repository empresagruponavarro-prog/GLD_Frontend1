import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, provideRouter } from '@angular/router';
import { environment } from '@env';
import { GrupoCatalogo, MatrizPermisosRol, Permisos, SIN_PERMISOS } from '@app/core/auth/permisos.models';
import { MIS_PERMISOS_URL, MemoryStorage, guardarSesion, misPermisos, provideSesionStorage } from '@app/core/auth/auth.testing';
import { PermisosService } from '@app/core/auth/permisos.service';
import { RolesComponent } from './roles';
import { rolesPendientesGuard } from './roles.guard';
import { RolAdmin } from './roles.service';
import { validarDescripcionRol, validarNombreRol } from './roles.validators';

const API = `${environment.apiUrl}/administration/roles`;
const API_CATALOGO = `${environment.apiUrl}/administration/permisos/catalogo`;
const permisosUrl = (id: number) => `${API}/${id}/permisos`;

const ADMIN: RolAdmin = { id: 1, nombre: 'Administrador', descripcion: 'Acceso total', es_sistema: true, usuarios: 1 };
const PROMOTOR: RolAdmin = { id: 2, nombre: 'Promotor', descripcion: null, es_sistema: false, usuarios: 3 };
const VISITA: RolAdmin = { id: 3, nombre: 'Visita', descripcion: 'Solo lectura', es_sistema: false, usuarios: 0 };
const ROLES = [ADMIN, PROMOTOR, VISITA];

const storage = new MemoryStorage();

function providers() {
  return [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSesionStorage(storage)];
}

const CATALOGO: GrupoCatalogo[] = [
  {
    grupo: 'Documentos',
    modulos: [
      { id: 4, clave: 'documentos.administracion', nombre: 'Compromisos de pago', ruta: '/documentos/administracion', orden: 1, admiteAprobar: true, admiteAnular: true },
      { id: 5, clave: 'documentos.origen', nombre: 'Órdenes de compra', ruta: '/documentos/origen', orden: 2, admiteAprobar: false, admiteAnular: true },
      { id: 6, clave: 'requerimientos', nombre: 'Requerimientos (FUR)', ruta: '/requerimientos', orden: 3, admiteAprobar: false, admiteAnular: false },
    ],
  },
  {
    grupo: 'Maestros',
    modulos: [
      { id: 23, clave: 'maestros.anexos', nombre: 'Anexos', ruta: '/anexos', orden: 1, admiteAprobar: false, admiteAnular: false },
      { id: 24, clave: 'maestros.productos', nombre: 'Productos', ruta: null, orden: 2, admiteAprobar: false, admiteAnular: false },
    ],
  },
];
const MODULOS = CATALOGO.flatMap((g) => g.modulos);
const TODO: Permisos = { ver: true, crear: true, editar: true, eliminar: true, aprobar: true, anular: true };

function matrizDe(rol: RolAdmin, valores: Record<string, Partial<Permisos>> = {}, bloqueado = false): MatrizPermisosRol {
  return {
    rolId: rol.id,
    rol: rol.nombre,
    esSistema: rol.es_sistema,
    bloqueado,
    permisos: MODULOS.map((m) => ({
      moduloId: m.id,
      clave: m.clave,
      ...(bloqueado ? TODO : { ...SIN_PERMISOS, ...valores[m.clave] }),
    })),
  };
}

/** Promotor: ve y crea Anexos; ve Compromisos de pago. */
const MATRIZ_PROMOTOR = matrizDe(PROMOTOR, {
  'documentos.administracion': { ver: true },
  'maestros.anexos': { ver: true, crear: true },
});
const MATRIZ_ADMIN = matrizDe(ADMIN, {}, true);

/** Por defecto la sesión es de un Administrador (el único que llega a esta pantalla hoy). */
async function setup(roles: RolAdmin[] = ROLES, matrizInicial: MatrizPermisosRol = MATRIZ_PROMOTOR, rolSesion = 'Administrador') {
  storage.clear();
  guardarSesion(storage, rolSesion);
  TestBed.configureTestingModule({
    imports: [RolesComponent],
    providers: providers(),
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(RolesComponent);
  http.expectOne(API).flush(roles);
  http.expectOne(API_CATALOGO).flush(CATALOGO);
  http.expectOne(permisosUrl(matrizInicial.rolId)).flush(matrizInicial);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const q = <T extends Element>(sel: string) => el.querySelector<T>(sel);
  const render = () => fixture.whenStable();
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
  const casilla = (clave: string, accion: string) =>
    q<HTMLInputElement>(`[data-testid="permisos-fila"][data-clave="${clave}"] input[data-accion="${accion}"]`);
  const noAplica = (clave: string, accion: string) =>
    q(`[data-testid="permisos-fila"][data-clave="${clave}"] .permisos-na[data-accion="${accion}"]`);
  const casillaGrupo = (grupo: string, accion: string) =>
    q<HTMLInputElement>(`[data-testid="permisos-grupo"][data-grupo="${grupo}"] input[data-accion="${accion}"]`);
  const selectRol = () => q<HTMLSelectElement>('#permisos-rol')!;
  const elegirRol = async (nombre: string) => {
    const select = selectRol();
    select.selectedIndex = Array.from(select.options).findIndex((o) => o.textContent?.startsWith(nombre));
    select.dispatchEvent(new Event('change'));
    await render();
  };
  const rolElegido = () => selectRol().options[selectRol().selectedIndex]?.textContent ?? '';
  const botonGuardar = () => q<HTMLButtonElement>('[data-testid="permisos-guardar"]')!;
  const contador = () => q('[data-testid="permisos-contador"]')?.textContent?.trim() ?? null;
  return {
    http, el, q, render, escribir, guardar, click, casilla, noAplica, casillaGrupo,
    selectRol, elegirRol, rolElegido, botonGuardar, contador, cmp: fixture.componentInstance,
  };
}

describe('RolesComponent — matriz de permisos', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('carga roles, catálogo y la matriz del primer rol editable, agrupada', async () => {
    const { el, q, selectRol, rolElegido, casilla } = await setup();
    expect(q('.content-title')?.textContent).toContain('Roles y permisos');
    const opciones = Array.from(selectRol().options).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Administrador (1 usuario)', 'Promotor (3 usuarios)', 'Visita (0 usuarios)']);
    expect(rolElegido()).toContain('Promotor');

    const grupos = Array.from(el.querySelectorAll('[data-testid="permisos-grupo"] th')).map((t) => t.textContent?.trim());
    expect(grupos).toEqual(['Documentos', 'Maestros']);
    const filas = Array.from(el.querySelectorAll<HTMLElement>('[data-testid="permisos-fila"]'));
    expect(filas.map((f) => f.dataset['clave'])).toEqual(MODULOS.map((m) => m.clave));
    expect(filas[0].querySelector('.permisos-modulo__ruta')?.textContent).toBe('/documentos/administracion');
    expect(filas[4].querySelector('.permisos-modulo__ruta')).toBeNull();

    const encabezados = Array.from(el.querySelectorAll('thead th')).map((t) => t.textContent?.trim());
    expect(encabezados).toEqual(['Módulo', 'Ver', 'Crear', 'Editar', 'Eliminar', 'Aprobar', 'Anular']);
    expect(casilla('maestros.anexos', 'crear')?.getAttribute('aria-label')).toBe('Crear en Anexos');
    expect(casilla('maestros.anexos', 'crear')?.checked).toBe(true);
    expect(casilla('maestros.anexos', 'editar')?.checked).toBe(false);
    expect(casilla('documentos.administracion', 'ver')?.checked).toBe(true);
    expect(q('[data-testid="permisos-bloqueado"]')).toBeNull();
  });

  it('Aprobar/Anular solo tienen casilla donde el módulo los admite', async () => {
    const { casilla, noAplica, casillaGrupo } = await setup();
    expect(casilla('documentos.administracion', 'aprobar')).not.toBeNull();
    expect(casilla('documentos.administracion', 'anular')).not.toBeNull();
    expect(casilla('documentos.origen', 'aprobar')).toBeNull();
    expect(noAplica('documentos.origen', 'aprobar')?.textContent).toBe('—');
    expect(casilla('documentos.origen', 'anular')).not.toBeNull();
    expect(casilla('requerimientos', 'aprobar')).toBeNull();
    expect(casilla('requerimientos', 'anular')).toBeNull();
    expect(casilla('maestros.anexos', 'anular')).toBeNull();
    // Fila de grupo: sin casilla si ningún módulo del grupo admite la acción.
    expect(casillaGrupo('Documentos', 'aprobar')).not.toBeNull();
    expect(casillaGrupo('Maestros', 'aprobar')).toBeNull();
    expect(casillaGrupo('Maestros', 'anular')).toBeNull();
  });

  it('desmarcar Ver desmarca la fila; marcar otra acción marca Ver', async () => {
    const { casilla, click, contador } = await setup();
    await click(casilla('maestros.anexos', 'ver'));
    expect(casilla('maestros.anexos', 'ver')?.checked).toBe(false);
    expect(casilla('maestros.anexos', 'crear')?.checked).toBe(false);

    await click(casilla('maestros.productos', 'editar'));
    expect(casilla('maestros.productos', 'editar')?.checked).toBe(true);
    expect(casilla('maestros.productos', 'ver')?.checked).toBe(true);

    await click(casilla('documentos.origen', 'anular'));
    expect(casilla('documentos.origen', 'ver')?.checked).toBe(true);
    // anexos: ver+crear (2) · productos: ver+editar (2) · órdenes: ver+anular (2)
    expect(contador()).toBe('6 cambios sin guardar');
  });

  it('las casillas de grupo marcan/desmarcan la columna con estado indeterminado si es mixto', async () => {
    const { casilla, casillaGrupo, click } = await setup();
    const verMaestros = casillaGrupo('Maestros', 'ver')!;
    expect(verMaestros.getAttribute('aria-label')).toBe('Ver en todo el grupo Maestros');
    // Anexos con Ver, Productos sin Ver -> mixto.
    expect(verMaestros.checked).toBe(false);
    expect(verMaestros.indeterminate).toBe(true);

    await click(casillaGrupo('Maestros', 'editar'));
    expect(casilla('maestros.anexos', 'editar')?.checked).toBe(true);
    expect(casilla('maestros.productos', 'editar')?.checked).toBe(true);
    expect(casilla('maestros.productos', 'ver')?.checked).toBe(true);
    expect(casillaGrupo('Maestros', 'ver')?.checked).toBe(true);
    expect(casillaGrupo('Maestros', 'ver')?.indeterminate).toBe(false);
    expect(casillaGrupo('Maestros', 'editar')?.checked).toBe(true);

    // Desmarcar Ver del grupo desmarca todas las acciones de sus módulos.
    await click(casillaGrupo('Maestros', 'ver'));
    for (const clave of ['maestros.anexos', 'maestros.productos']) {
      for (const accion of ['ver', 'crear', 'editar', 'eliminar']) expect(casilla(clave, accion)?.checked).toBe(false);
    }
    expect(casillaGrupo('Maestros', 'editar')?.checked).toBe(false);
    expect(casillaGrupo('Maestros', 'editar')?.indeterminate).toBe(false);

    // Aprobar del grupo solo afecta a los módulos que lo admiten.
    await click(casillaGrupo('Documentos', 'aprobar'));
    expect(casilla('documentos.administracion', 'aprobar')?.checked).toBe(true);
    expect(casillaGrupo('Documentos', 'aprobar')?.checked).toBe(true);
    expect(casilla('documentos.origen', 'ver')?.checked).toBe(false);
  });

  it('el Administrador se muestra en solo lectura, todo marcado y con aviso', async () => {
    const { el, q, elegirRol, http, render, botonGuardar } = await setup();
    await elegirRol('Administrador');
    http.expectOne(permisosUrl(1)).flush(MATRIZ_ADMIN);
    await render();
    expect(q('[data-testid="permisos-bloqueado"]')?.textContent).toContain('El Administrador tiene todos los permisos');
    const casillas = Array.from(el.querySelectorAll<HTMLInputElement>('.permisos-tabla input[type="checkbox"]'));
    expect(casillas.length).toBeGreaterThan(0);
    expect(casillas.every((c) => c.disabled && c.checked && !c.indeterminate)).toBe(true);
    expect(botonGuardar().disabled).toBe(true);
    expect(q('[data-testid="rol-eliminar"]')?.hasAttribute('disabled')).toBe(true);
  });

  it('cuenta los cambios y "Descartar cambios" vuelve a lo guardado', async () => {
    const { casilla, click, contador, botonGuardar, q } = await setup();
    expect(contador()).toBeNull();
    expect(botonGuardar().disabled).toBe(true);

    await click(casilla('requerimientos', 'ver'));
    expect(contador()).toBe('1 cambio sin guardar');
    expect(botonGuardar().disabled).toBe(false);
    // Volver al estado original no cuenta como cambio.
    await click(casilla('requerimientos', 'ver'));
    expect(contador()).toBeNull();

    await click(casilla('requerimientos', 'crear'));
    expect(contador()).toBe('2 cambios sin guardar');
    await click(q('[data-testid="permisos-descartar"]'));
    expect(contador()).toBeNull();
    expect(casilla('requerimientos', 'ver')?.checked).toBe(false);
    expect(casilla('requerimientos', 'crear')?.checked).toBe(false);
    expect(botonGuardar().disabled).toBe(true);
  });

  it('cambiar de rol sin cambios carga la matriz del nuevo rol', async () => {
    const { elegirRol, http, render, casilla, rolElegido } = await setup();
    await elegirRol('Visita');
    http.expectOne(permisosUrl(3)).flush(matrizDe(VISITA, { 'maestros.productos': { ver: true } }));
    await render();
    expect(rolElegido()).toContain('Visita');
    expect(casilla('maestros.productos', 'ver')?.checked).toBe(true);
    expect(casilla('maestros.anexos', 'crear')?.checked).toBe(false);
  });

  it('con cambios sin guardar, cambiar de rol pide confirmación en la pantalla (Cancelar / Descartar / Guardar)', async () => {
    const { q, http, render, click, casilla, elegirRol, rolElegido, contador } = await setup();
    await click(casilla('maestros.productos', 'ver'));

    // Cancelar: se queda en el rol y conserva los cambios.
    await elegirRol('Visita');
    expect(q('[data-testid="permisos-pendientes"]')?.getAttribute('role')).toBe('alertdialog');
    expect(q('#permisos-pendientes-desc')?.textContent).toContain('1 cambio sin guardar en el rol "Promotor"');
    expect(rolElegido()).toContain('Promotor');
    expect(q('[data-testid="permisos-pendientes-cancelar"]') === document.activeElement).toBe(true);
    await click(q('[data-testid="permisos-pendientes-cancelar"]'));
    expect(q('[data-testid="permisos-pendientes"]')).toBeNull();
    expect(contador()).toBe('1 cambio sin guardar');
    http.expectNone(permisosUrl(3));

    // Escape también cancela.
    await elegirRol('Visita');
    q('[data-testid="permisos-pendientes"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await render();
    expect(q('[data-testid="permisos-pendientes"]')).toBeNull();
    http.expectNone(permisosUrl(3));

    // Descartar: cambia de rol sin guardar.
    await elegirRol('Visita');
    await click(q('[data-testid="permisos-pendientes-descartar"]'));
    http.expectNone((r) => r.method === 'PUT');
    http.expectOne(permisosUrl(3)).flush(matrizDe(VISITA));
    await render();
    expect(rolElegido()).toContain('Visita');
    expect(contador()).toBeNull();
  });

  it('"Guardar" en la confirmación guarda y después cambia de rol', async () => {
    const { q, http, render, click, casilla, elegirRol, rolElegido } = await setup();
    await click(casilla('maestros.productos', 'ver'));
    await elegirRol('Visita');
    await click(q('[data-testid="permisos-pendientes-guardar"]'));
    const put = http.expectOne((r) => r.method === 'PUT');
    expect(put.request.url).toBe(permisosUrl(2));
    put.flush(matrizDe(PROMOTOR, { 'maestros.productos': { ver: true } }));
    http.expectOne(permisosUrl(3)).flush(matrizDe(VISITA));
    await render();
    expect(rolElegido()).toContain('Visita');
    expect(q('[data-testid="roles-aviso"]')?.textContent).toContain('Permisos del rol "Promotor" guardados');
  });

  it('Guardar envía un PUT con todas las filas del catálogo, muestra el progreso y la confirmación', async () => {
    const { q, http, render, click, casilla, botonGuardar, contador } = await setup();
    await click(casilla('documentos.administracion', 'aprobar'));
    await click(casilla('maestros.anexos', 'ver'));
    await click(botonGuardar());

    expect(botonGuardar().disabled).toBe(true);
    expect(botonGuardar().textContent).toContain('Guardando');
    const put = http.expectOne(permisosUrl(2));
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      permisos: [
        { clave: 'documentos.administracion', ver: true, crear: false, editar: false, eliminar: false, aprobar: true, anular: false },
        { clave: 'documentos.origen', ...SIN_PERMISOS },
        { clave: 'requerimientos', ...SIN_PERMISOS },
        { clave: 'maestros.anexos', ...SIN_PERMISOS },
        { clave: 'maestros.productos', ...SIN_PERMISOS },
      ],
    });
    put.flush(matrizDe(PROMOTOR, { 'documentos.administracion': { ver: true, aprobar: true } }));
    await render();
    expect(q('[data-testid="roles-aviso"]')?.textContent).toContain('Permisos del rol "Promotor" guardados');
    expect(q('[data-testid="roles-aviso"]')?.getAttribute('role')).toBe('status');
    expect(contador()).toBeNull();
    expect(botonGuardar().disabled).toBe(true);
    expect(casilla('documentos.administracion', 'aprobar')?.checked).toBe(true);
  });

  it.each([
    [400, 'Aprobar no se admite en "requerimientos"'],
    [409, 'El Administrador tiene todos los permisos y no se puede modificar'],
  ])('un %s al guardar se muestra en role="alert" y conserva los cambios', async (status, mensaje) => {
    const { q, http, render, click, casilla, botonGuardar, contador } = await setup();
    await click(casilla('maestros.productos', 'ver'));
    await click(botonGuardar());
    http.expectOne(permisosUrl(2)).flush({ message: mensaje }, { status, statusText: 'Error' });
    await render();
    const alerta = q('[data-testid="permisos-error"]');
    expect(alerta?.getAttribute('role')).toBe('alert');
    expect(alerta?.textContent).toContain(mensaje);
    expect(contador()).toBe('1 cambio sin guardar');
    expect(botonGuardar().disabled).toBe(false);
  });

  it('Actualizar con cambios pide confirmación; sin cambios recarga todo', async () => {
    const { q, http, render, click, casilla } = await setup();
    await click(q('[data-testid="roles-actualizar"]'));
    http.expectOne(API).flush(ROLES);
    http.expectOne(API_CATALOGO).flush(CATALOGO);
    http.expectOne(permisosUrl(2)).flush(MATRIZ_PROMOTOR);
    await render();

    await click(casilla('maestros.productos', 'ver'));
    await click(q('[data-testid="roles-actualizar"]'));
    expect(q('[data-testid="permisos-pendientes"]')).not.toBeNull();
    http.expectNone(API);
    await click(q('[data-testid="permisos-pendientes-descartar"]'));
    http.expectOne(API).flush(ROLES);
    http.expectOne(API_CATALOGO).flush(CATALOGO);
    http.expectOne(permisosUrl(2)).flush(MATRIZ_PROMOTOR);
    await render();
    expect(casilla('maestros.productos', 'ver')?.checked).toBe(false);
  });

  it('muestra un aviso si no se pueden cargar roles o catálogo', async () => {
    TestBed.configureTestingModule({
      imports: [RolesComponent],
      providers: providers(),
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RolesComponent);
    http.expectOne(API_CATALOGO).flush(CATALOGO);
    http.expectOne(API).flush({ message: 'Forbidden resource' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    const alerta = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="roles-page-error"]');
    expect(alerta?.getAttribute('role')).toBe('alert');
    expect(alerta?.textContent).toContain('Forbidden resource');
  });
});

describe('RolesComponent — permisos de la sesión y salida con cambios pendientes', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const ruta = {} as ActivatedRouteSnapshot;
  const estado = { url: '/admin/roles' } as RouterStateSnapshot;
  const salir = (cmp: RolesComponent) =>
    TestBed.runInInjectionContext(() => rolesPendientesGuard(cmp, ruta, estado, { url: '/' } as RouterStateSnapshot));

  it('guardar la matriz del rol de la sesión recarga los permisos (el menú se actualiza al momento)', async () => {
    const { http, render, click, casilla, botonGuardar } = await setup(ROLES, MATRIZ_PROMOTOR, 'Promotor');
    await click(casilla('maestros.productos', 'ver'));
    await click(botonGuardar());
    http.expectOne(permisosUrl(2)).flush(matrizDe(PROMOTOR, { 'maestros.productos': { ver: true } }));
    await render();
    const recarga = http.expectOne(MIS_PERMISOS_URL);
    recarga.flush(misPermisos('Promotor', { 'maestros.productos': {} }));
    const permisos = TestBed.inject(PermisosService);
    await permisos.listo();
    expect(permisos.puedeVer('maestros.productos')).toBe(true);
  });

  it('guardar la matriz de otro rol no recarga los permisos de la sesión', async () => {
    const { http, render, click, casilla, botonGuardar } = await setup(ROLES, MATRIZ_PROMOTOR, 'Visita');
    await click(casilla('maestros.productos', 'ver'));
    await click(botonGuardar());
    http.expectOne(permisosUrl(2)).flush(matrizDe(PROMOTOR, { 'maestros.productos': { ver: true } }));
    await render();
    http.expectNone(MIS_PERMISOS_URL);
  });

  it('canDeactivate: sin cambios deja salir sin preguntar', async () => {
    const { cmp, q } = await setup();
    expect(salir(cmp)).toBe(true);
    expect(q('[data-testid="permisos-pendientes"]')).toBeNull();
  });

  it('canDeactivate con cambios: Cancelar se queda y conserva los cambios; Descartar sale', async () => {
    const { cmp, q, render, click, casilla, contador } = await setup();
    await click(casilla('maestros.productos', 'ver'));

    const primera = salir(cmp);
    expect(primera).toBeInstanceOf(Promise);
    await render();
    expect(q('#permisos-pendientes-desc')?.textContent).toContain('1 cambio sin guardar en el rol "Promotor"');
    await click(q('[data-testid="permisos-pendientes-cancelar"]'));
    expect(await primera).toBe(false);
    expect(contador()).toBe('1 cambio sin guardar');

    const segunda = salir(cmp);
    await render();
    await click(q('[data-testid="permisos-pendientes-descartar"]'));
    expect(await segunda).toBe(true);
    expect(contador()).toBeNull();
  });

  it('canDeactivate con cambios: Guardar guarda y sale; si el guardado falla, se queda', async () => {
    const { cmp, q, http, render, click, casilla } = await setup();
    await click(casilla('maestros.productos', 'ver'));

    const fallida = salir(cmp);
    await render();
    await click(q('[data-testid="permisos-pendientes-guardar"]'));
    http.expectOne(permisosUrl(2)).flush({ message: 'Aprobar no se admite' }, { status: 400, statusText: 'Bad Request' });
    expect(await fallida).toBe(false);
    await render();
    expect(q('[data-testid="permisos-error"]')?.textContent).toContain('Aprobar no se admite');

    const correcta = salir(cmp);
    await render();
    await click(q('[data-testid="permisos-pendientes-guardar"]'));
    http.expectOne(permisosUrl(2)).flush(matrizDe(PROMOTOR, { 'maestros.productos': { ver: true } }));
    expect(await correcta).toBe(true);
  });
});

describe('RolesComponent — crear, editar y eliminar roles', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('crear valida el nombre, envía POST, refresca la lista y selecciona el rol nuevo', async () => {
    const { q, http, escribir, guardar, click, render, rolElegido } = await setup();
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
    const nuevo: RolAdmin = { id: 4, nombre: 'Jefe de Obra Ñ.', descripcion: 'Supervisa la obra', es_sistema: false, usuarios: 0 };
    const req = http.expectOne((r) => r.url === API && r.method === 'POST');
    expect(req.request.body).toEqual({ nombre: 'Jefe de Obra Ñ.', descripcion: 'Supervisa la obra' });
    req.flush(nuevo);
    http.expectOne((r) => r.url === API && r.method === 'GET').flush([...ROLES, nuevo]);
    http.expectOne(permisosUrl(4)).flush(matrizDe(nuevo));
    await render();
    expect(q('.modal-content')).toBeNull();
    expect(q('[data-testid="roles-aviso"]')?.textContent).toContain('creado');
    expect(rolElegido()).toContain('Jefe de Obra Ñ.');
  });

  it('crear sin descripción no envía el campo', async () => {
    const { q, http, escribir, guardar, click } = await setup();
    await click(q('[data-testid="roles-nuevo"]'));
    escribir('#rol-nombre', 'Almacenero');
    await guardar();
    const req = http.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({ nombre: 'Almacenero' });
    req.flush({ ...VISITA, id: 5, nombre: 'Almacenero' });
    http.expectOne(API).flush(ROLES);
  });

  it('editar Administrador: nombre bloqueado y solo envía la descripción', async () => {
    const { q, http, escribir, guardar, click, render, elegirRol } = await setup();
    await elegirRol('Administrador');
    http.expectOne(permisosUrl(1)).flush(MATRIZ_ADMIN);
    await render();
    await click(q('[data-testid="rol-editar"]'));
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
    http.expectOne(API).flush([{ ...ADMIN, descripcion: 'Acceso total al sistema' }, PROMOTOR, VISITA]);
    await render();
    expect(q('.modal-content')).toBeNull();
    expect(q('[data-testid="rol-descripcion"]')?.textContent).toContain('Acceso total al sistema');
  });

  it('renombrar el rol seleccionado envía solo el nombre nuevo y mantiene la selección', async () => {
    const { q, http, escribir, guardar, click, render, rolElegido } = await setup();
    await click(q('[data-testid="rol-editar"]'));
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
    expect(rolElegido()).toContain('Promotor Senior');
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
    const { q, http, render, elegirRol } = await setup();
    const eliminar = () => q<HTMLButtonElement>('[data-testid="rol-eliminar"]')!;
    expect(eliminar().disabled).toBe(true);
    expect(eliminar().closest('[title]')?.getAttribute('title')).toContain('Asignado a 3 usuarios');

    await elegirRol('Administrador');
    http.expectOne(permisosUrl(1)).flush(MATRIZ_ADMIN);
    await render();
    expect(eliminar().disabled).toBe(true);
    expect(eliminar().closest('[title]')?.getAttribute('title')).toContain('Rol de sistema');
    expect(q(`#${eliminar().getAttribute('aria-describedby')}`)?.textContent).toContain('Rol de sistema');

    await elegirRol('Visita');
    http.expectOne(permisosUrl(3)).flush(matrizDe(VISITA));
    await render();
    expect(eliminar().disabled).toBe(false);
  });

  it('confirmar dentro de la pantalla envía DELETE, refresca y selecciona otro rol; Cancelar no envía nada', async () => {
    const { q, http, click, render, elegirRol, rolElegido, selectRol } = await setup();
    await elegirRol('Visita');
    http.expectOne(permisosUrl(3)).flush(matrizDe(VISITA));
    await render();

    await click(q('[data-testid="rol-eliminar"]'));
    expect(q('#rol-eliminar-desc')?.textContent).toContain('¿Eliminar el rol "Visita"?');
    expect(q('[data-testid="rol-eliminar-cancelar"]') === document.activeElement).toBe(true);
    await click(q('[data-testid="rol-eliminar-cancelar"]'));
    expect(q('#rol-eliminar-desc')).toBeNull();
    http.expectNone((r) => r.method === 'DELETE');

    await click(q('[data-testid="rol-eliminar"]'));
    await click(q('[data-testid="rol-eliminar-confirmar"]'));
    const req = http.expectOne(`${API}/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(API).flush([ADMIN, PROMOTOR]);
    http.expectOne(permisosUrl(2)).flush(MATRIZ_PROMOTOR);
    await render();
    expect(q('#rol-eliminar-desc')).toBeNull();
    expect(q('[data-testid="roles-aviso"]')?.textContent).toContain('eliminado');
    expect(rolElegido()).toContain('Promotor');
    expect(Array.from(selectRol().options).some((o) => o.textContent?.includes('Visita'))).toBe(false);
  });

  it('un 409 al eliminar se muestra en la confirmación', async () => {
    const { q, http, click, render, elegirRol } = await setup();
    await elegirRol('Visita');
    http.expectOne(permisosUrl(3)).flush(matrizDe(VISITA));
    await render();
    await click(q('[data-testid="rol-eliminar"]'));
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
    http.expectOne((r) => r.method === 'POST').flush({ ...VISITA, id: 5, nombre: 'Almacenero' });
    http.expectOne(API).flush(ROLES);
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
