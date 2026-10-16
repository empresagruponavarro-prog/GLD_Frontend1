import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Data, Router, RouterStateSnapshot, Routes, UrlTree, provideRouter } from '@angular/router';
import { AvisosService } from '../avisos/avisos.service';
import { MIS_PERMISOS_URL, MemoryStorage, guardarSesion, misPermisos, provideSesionStorage } from './auth.testing';
import { MSG_ACCESO_DENEGADO, MSG_PERMISOS_NO_CARGADOS, moduloDeSnapshot, moduloDeUrl, permisoGuard, rutaModulo, rutaSesion } from './permiso.guard';
import { routes } from '../../app.routes';

const storage = new MemoryStorage();

/** Snapshot con la cadena de `data` desde la raíz hasta la ruta activada (la última). */
function snap(...cadena: Data[]): ActivatedRouteSnapshot {
  const nodos = cadena.map((data) => ({ data }) as ActivatedRouteSnapshot);
  const hoja = { data: cadena.at(-1) ?? {}, pathFromRoot: nodos };
  return hoja as unknown as ActivatedRouteSnapshot;
}

const state = { url: '/x' } as RouterStateSnapshot;

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSesionStorage(storage)],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
    avisos: TestBed.inject(AvisosService),
  };
}

function ejecutar(route: ActivatedRouteSnapshot) {
  return TestBed.runInInjectionContext(() => permisoGuard(route, state));
}

describe('permisoGuard', () => {
  beforeEach(() => storage.clear());
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.inject(AvisosService).cerrar();
    storage.clear();
  });

  it('una ruta sin módulo solo exige sesión: pasa sin cargar permisos', async () => {
    guardarSesion(storage, 'Usuario');
    setup();
    expect(await ejecutar(snap({}, {}))).toBe(true);
  });

  it('sin sesión deja que authGuard redirija (no pide permisos)', async () => {
    setup();
    expect(await ejecutar(snap({}, { modulo: 'incidencias' }))).toBe(true);
  });

  it('espera a que carguen los permisos y deja pasar con ver', async () => {
    guardarSesion(storage, 'Usuario');
    const { http } = setup();
    let resultado: unknown = 'pendiente';
    const promesa = Promise.resolve(ejecutar(snap({}, { modulo: 'incidencias' }))).then((r) => (resultado = r));
    await Promise.resolve();
    expect(resultado).toBe('pendiente'); // no decide antes de tener los permisos
    http.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Usuario', { incidencias: {} }));
    await promesa;
    expect(resultado).toBe(true);
  });

  it('sin ver redirige al inicio y muestra "No tienes acceso a este módulo"', async () => {
    guardarSesion(storage, 'Usuario');
    const { http, router, avisos } = setup();
    const promesa = ejecutar(snap({}, { modulo: 'tesoreria.pagos' }));
    http.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Usuario', { incidencias: {} }));
    const r = await promesa;
    expect(r).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(r as UrlTree)).toBe('/');
    expect(avisos.aviso()).toEqual({ texto: MSG_ACCESO_DENEGADO, tipo: 'error' });
  });

  it('usa el módulo de la ruta más cercana en la jerarquía', async () => {
    guardarSesion(storage, 'Usuario');
    const { http } = setup();
    const promesa = ejecutar(snap({ modulo: 'obra' }, { tipo: 'x' }));
    http.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Usuario', { obra: {} }));
    expect(await promesa).toBe(true);
  });

  it('el Administrador pasa a cualquier módulo', async () => {
    guardarSesion(storage, 'Administrador');
    const { http } = setup();
    const promesa = ejecutar(snap({}, { modulo: 'admin.roles' }));
    http.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Administrador', {}, true));
    expect(await promesa).toBe(true);
  });

  it('si no se pudieron cargar los permisos, va al inicio con un aviso distinto', async () => {
    guardarSesion(storage, 'Usuario');
    const { http, router, avisos } = setup();
    const promesa = ejecutar(snap({}, { modulo: 'incidencias' }));
    http.expectOne(MIS_PERMISOS_URL).flush(null, { status: 500, statusText: 'Error' });
    const r = await promesa;
    expect(router.serializeUrl(r as UrlTree)).toBe('/');
    expect(avisos.aviso()?.texto).toBe(MSG_PERMISOS_NO_CARGADOS);
  });
});

describe('moduloDeSnapshot / rutaModulo / rutaSesion', () => {
  it('ignora valores que no son claves de módulo', () => {
    expect(moduloDeSnapshot(snap({}, { modulo: 'no.existe' }))).toBeNull();
    expect(moduloDeSnapshot(snap({ modulo: 'obra' }, { modulo: 'presupuestos' }))).toBe('presupuestos');
  });

  it('rutaModulo conserva los demás datos de la ruta', () => {
    @Component({ template: '' })
    class Vacio {}
    expect(rutaModulo('a/:id', Vacio, 'almacen.salidas', { tipo: 'salidas' })).toEqual({
      path: 'a/:id',
      component: Vacio,
      data: { tipo: 'salidas', modulo: 'almacen.salidas' },
    });
  });

  it('rutaSesion no declara módulo (solo sesión) y conserva los demás datos', () => {
    @Component({ template: '' })
    class Vacio {}
    expect(rutaSesion('', Vacio)).toEqual({ path: '', component: Vacio, data: {} });
    const imprimir = rutaSesion('imprimir/fur/:id', Vacio, { tipo: 'fur', modulo: 'requerimientos' });
    expect(imprimir).toEqual({ path: 'imprimir/fur/:id', component: Vacio, data: { tipo: 'fur' } });
    expect(moduloDeSnapshot(snap({}, imprimir.data ?? {}))).toBeNull();
  });
});

describe('moduloDeUrl', () => {
  it.each([
    ['/tesoreria/pagos', 'tesoreria.pagos'],
    ['/presupuestos?id=4', 'presupuestos'],
    ['/presupuestos/plantillas', 'presupuestos.plantillas'],
    ['/centros-costos/7/datos?tab=planos', 'obra'],
    ['/requerimientos/aprobacion', 'requerimientos.aprobacion'],
    ['/requerimientos/15', 'requerimientos'],
    ['/imprimir/comprobante-pago/3', null],
    ['/imprimir/fur/15', null],
    ['/dashboard-situacional', 'dashboard'],
    ['/modulos', 'modulos'],
    ['/admin/roles#x', 'admin.roles'],
    ['/', null],
    ['/login', null],
    ['/no-existe', null],
  ])('%s -> %s', (url, esperado) => {
    expect(moduloDeUrl(routes, url)).toBe(esperado);
  });

  it('hereda el módulo de un padre con hijos', () => {
    @Component({ template: '' })
    class Vacio {}
    const rutas: Routes = [{ path: 'obra/:id', data: { modulo: 'obra' }, children: [{ path: 'planos', component: Vacio }] }];
    expect(moduloDeUrl(rutas, '/obra/3/planos')).toBe('obra');
    expect(moduloDeUrl(rutas, '/obra/3/otra')).toBeNull();
  });
});
