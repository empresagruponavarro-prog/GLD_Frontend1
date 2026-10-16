import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from './auth.service';
import { MemoryStorage, cargarPermisos, guardarSesion, misPermisos, providersPantalla } from './auth.testing';
import { ClaveModulo } from './permisos.models';
import { PermisosPantalla, permisosDePantalla } from './permisos-pantalla';

const storage = new MemoryStorage();

function valores(p: PermisosPantalla) {
  return { crear: p.crear(), editar: p.editar(), eliminar: p.eliminar(), aprobar: p.aprobar(), anular: p.anular() };
}

const NINGUNO = { crear: false, editar: false, eliminar: false, aprobar: false, anular: false };
const TODOS = { crear: true, editar: true, eliminar: true, aprobar: true, anular: true };

function setup(rutaModulo?: ClaveModulo) {
  guardarSesion(storage, 'Usuario');
  // Ruta activa mínima: su snapshot es el último (y único) eslabón de `pathFromRoot`.
  const hoja = { data: rutaModulo ? { modulo: rutaModulo } : {} };
  const ruta = { snapshot: { ...hoja, pathFromRoot: [hoja] } };
  TestBed.configureTestingModule({
    providers: [...providersPantalla(storage), { provide: ActivatedRoute, useValue: ruta }],
  });
}

function crear(clave?: ClaveModulo): PermisosPantalla {
  return TestBed.runInInjectionContext(() => permisosDePantalla(clave));
}

describe('permisosDePantalla', () => {
  beforeEach(() => storage.clear());
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    storage.clear();
  });

  it('sin permisos cargados todo es false', () => {
    setup();
    expect(valores(crear('almacen.almacenes'))).toEqual(NINGUNO);
  });

  it('refleja las acciones del módulo indicado y reacciona a la carga de permisos', async () => {
    setup();
    const p = crear('almacen.prestamos');
    expect(valores(p)).toEqual(NINGUNO);
    await cargarPermisos(misPermisos('Usuario', { 'almacen.prestamos': { crear: true, anular: true }, incidencias: { editar: true } }));
    expect(valores(p)).toEqual({ ...NINGUNO, crear: true, anular: true });
  });

  it('con solo ver no permite ninguna acción de escritura', async () => {
    setup();
    await cargarPermisos(misPermisos('Usuario', { incidencias: {} }));
    expect(valores(crear('incidencias'))).toEqual(NINGUNO);
  });

  it('Administrador: todo true', async () => {
    setup();
    await cargarPermisos(misPermisos('Administrador', {}, true));
    expect(valores(crear('admin.usuarios'))).toEqual(TODOS);
  });

  it('sin clave usa el data.modulo de la ruta activa', async () => {
    setup('tesoreria.cuentas');
    await cargarPermisos(misPermisos('Usuario', { 'tesoreria.cuentas': { editar: true } }));
    expect(valores(crear())).toEqual({ ...NINGUNO, editar: true });
  });

  it('sin clave ni módulo en la ruta: todo false (incluso para el Administrador)', async () => {
    setup();
    await cargarPermisos(misPermisos('Administrador', {}, true));
    expect(valores(crear())).toEqual(NINGUNO);
  });

  it('al cerrar sesión vuelve a false', async () => {
    setup();
    const p = crear('incidencias');
    await cargarPermisos(misPermisos('Usuario', { incidencias: { crear: true } }));
    expect(p.crear()).toBe(true);
    TestBed.inject(AuthService).logout({ redirigir: false });
    expect(p.crear()).toBe(false);
  });
});
