import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { SESION_STORAGE_KEY } from './auth.models';
import { AuthService } from './auth.service';
import { MIS_PERMISOS_URL, MemoryStorage, guardarSesion, misPermisos, provideSesionStorage } from './auth.testing';
import { CLAVES_MODULO } from './permisos.models';
import { PermisosService, normalizarMisPermisos } from './permisos.service';

const storage = new MemoryStorage();

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSesionStorage(storage)],
  });
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  return {
    http: TestBed.inject(HttpTestingController),
    auth: TestBed.inject(AuthService),
    permisos: TestBed.inject(PermisosService),
  };
}

describe('PermisosService', () => {
  beforeEach(() => storage.clear());
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    storage.clear();
  });

  it('sin sesión: listo() se resuelve sin pedir nada y puede() es false', async () => {
    const { permisos } = setup();
    await permisos.listo();
    expect(permisos.cargado()).toBe(false);
    expect(permisos.puede('dashboard', 'ver')).toBe(false);
  });

  it('carga mis-permisos con la sesión y responde puede/puedeVer', async () => {
    guardarSesion(storage, 'Jefe de Área');
    const { http, permisos } = setup();
    expect(permisos.puedeVer('incidencias')).toBe(false); // sin datos -> false

    const listo = permisos.listo();
    expect(permisos.cargando()).toBe(true);
    const req = http.expectOne(MIS_PERMISOS_URL);
    expect(req.request.method).toBe('GET');
    req.flush(misPermisos('Jefe de Área', { incidencias: { crear: true }, 'tesoreria.pagos': {} }));
    await listo;

    expect(permisos.cargando()).toBe(false);
    expect(permisos.cargado()).toBe(true);
    expect(permisos.esAdministrador()).toBe(false);
    expect(permisos.rol()).toBe('Jefe de Área');
    expect(permisos.puedeVer('incidencias')).toBe(true);
    expect(permisos.puede('incidencias', 'crear')).toBe(true);
    expect(permisos.puede('incidencias', 'eliminar')).toBe(false);
    expect(permisos.puedeVer('tesoreria.pagos')).toBe(true);
    expect(permisos.puede('tesoreria.pagos', 'anular')).toBe(false);
    // Módulo ausente en la respuesta = sin permisos.
    expect(permisos.puedeVer('admin.roles')).toBe(false);

    // Ya cargado: listo() no vuelve a pedir.
    await permisos.listo();
  });

  it('Administrador: puede() es siempre true', async () => {
    guardarSesion(storage, 'Administrador');
    const { http, permisos } = setup();
    const listo = permisos.listo();
    http.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Administrador', {}, true));
    await listo;
    expect(permisos.esAdministrador()).toBe(true);
    for (const clave of CLAVES_MODULO) expect(permisos.puede(clave, 'anular')).toBe(true);
  });

  it('varias esperas simultáneas comparten una sola petición', async () => {
    guardarSesion(storage, 'Usuario');
    const { http, permisos } = setup();
    const a = permisos.listo();
    const b = permisos.listo();
    const c = permisos.recargar();
    http.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Usuario', { modulos: {} }));
    await Promise.all([a, b, c]);
    expect(await c).not.toBeNull();
    expect(permisos.puedeVer('modulos')).toBe(true);
  });

  it('recargar() vuelve a pedir y aplica los permisos nuevos', async () => {
    guardarSesion(storage, 'Usuario');
    const { http, permisos } = setup();
    const primera = permisos.listo();
    http.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Usuario', { incidencias: {} }));
    await primera;
    expect(permisos.puedeVer('incidencias')).toBe(true);

    const recarga = permisos.recargar();
    http.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Usuario', { 'almacen.stock': {} }));
    const datos = await recarga;
    expect(datos?.permisos['almacen.stock']?.ver).toBe(true);
    expect(permisos.puedeVer('incidencias')).toBe(false);
    expect(permisos.puedeVer('almacen.stock')).toBe(true);
  });

  it('si la carga falla, listo() se resuelve igual y no da permisos', async () => {
    guardarSesion(storage, 'Usuario');
    const { http, permisos } = setup();
    const listo = permisos.listo();
    http.expectOne(MIS_PERMISOS_URL).flush({ message: 'boom' }, { status: 500, statusText: 'Error' });
    await listo;
    expect(permisos.cargado()).toBe(false);
    expect(permisos.cargando()).toBe(false);
    expect(permisos.puedeVer('dashboard')).toBe(false);
  });

  it('se vacía al cerrar sesión y no reutiliza los permisos de otro usuario', async () => {
    guardarSesion(storage, 'Usuario', 'ana');
    const { http, auth, permisos } = setup();
    const listo = permisos.listo();
    http.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Usuario', { incidencias: {} }));
    await listo;
    expect(permisos.puedeVer('incidencias')).toBe(true);

    auth.logout({ redirigir: false });
    expect(permisos.cargado()).toBe(false);
    expect(permisos.puedeVer('incidencias')).toBe(false);

    // Otro usuario (otro token) en otra pestaña: hay que cargar sus permisos.
    guardarSesion(storage, 'Gerente', 'beto');
    window.dispatchEvent(new StorageEvent('storage', { key: SESION_STORAGE_KEY }));
    expect(auth.rol()).toBe('Gerente');
    expect(permisos.puedeVer('incidencias')).toBe(false);
    const otra = permisos.listo();
    const req = http.expectOne(MIS_PERMISOS_URL);
    expect(req.request.headers.has('Authorization')).toBe(false); // sin interceptor en este spec
    req.flush(misPermisos('Gerente', { dashboard: {} }));
    await otra;
    expect(permisos.puedeVer('dashboard')).toBe(true);
    expect(permisos.puedeVer('incidencias')).toBe(false);

    permisos.vaciar();
    expect(permisos.cargado()).toBe(false);
  });

  it('descarta una respuesta que llega después de cerrar sesión', async () => {
    guardarSesion(storage, 'Usuario');
    const { http, auth, permisos } = setup();
    const listo = permisos.listo();
    auth.logout({ redirigir: false });
    http.expectOne(MIS_PERMISOS_URL).flush(misPermisos('Usuario', { incidencias: {} }));
    await listo;
    expect(permisos.cargado()).toBe(false);
  });
});

describe('normalizarMisPermisos', () => {
  it('ignora claves desconocidas y permisos mal formados', () => {
    const r = normalizarMisPermisos({
      rol: 'Usuario',
      esAdministrador: false,
      permisos: {
        dashboard: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false, anular: false },
        'no.existe': { ver: true, crear: true, editar: true, eliminar: true, aprobar: true, anular: true },
        modulos: { ver: 'si' },
      },
    });
    expect(r?.permisos).toEqual({
      dashboard: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false, anular: false },
    });
  });

  it.each([null, 'x', {}, { rol: 'U', esAdministrador: 'no', permisos: {} }, { rol: 'U', esAdministrador: false }])(
    'rechaza respuestas no válidas (%j)',
    (valor) => {
      expect(normalizarMisPermisos(valor)).toBeNull();
    },
  );
});
