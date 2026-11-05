import { Route } from '@angular/router';
import { routes } from './app.routes';
import { authGuard, invitadoGuard } from './core/auth/auth.guards';
import { permisoGuard } from './core/auth/permiso.guard';
import { CLAVES_MODULO, MODULOS_RETIRADOS, esClaveModulo } from './core/auth/permisos.models';
import { rolesPendientesGuard } from './features/administration/roles/roles.guard';
import { LoginComponent } from './features/auth/login/login';
import { InicioComponent } from './core/inicio/inicio';
import { CatalogosProyectoComponent } from './features/proyectos/catalogos/catalogos';
import { ImprimirComponent } from './features/imprimir/imprimir';
import { ModulesDashboardComponent } from './features/modules-dashboard/modules-dashboard';

/** Rutas de pantalla que no corresponden a ningún módulo (solo exigen sesión): inicio e impresiones. */
const IMPRESIONES = [
  ['imprimir/fur/:id', 'fur'],
  ['imprimir/cuadro-comparativo/:id', 'cuadro-comparativo'],
  ['imprimir/documento-origen/:id', 'documento-origen'],
  ['imprimir/comprobante-pago/:id', 'comprobante-pago'],
  ['imprimir/expediente/:id', 'expediente'],
  ['imprimir/pecosa/:id', 'pecosa'],
  ['imprimir/presupuesto-meta/:id', 'presupuesto-meta'],
  ['imprimir/presupuesto-comercial/:id', 'presupuesto-comercial'],
  ['imprimir/ficha-obra/:id', 'ficha-obra'],
  ['imprimir/informe-avance/:id', 'informe-avance'],
  ['imprimir/dosier/:id', 'dosier'],
] as const;
const SIN_MODULO: readonly string[] = ['', ...IMPRESIONES.map(([path]) => path)];

describe('app.routes', () => {
  const login = routes.find((r) => r.path === 'login');
  const protegida = routes.find((r) => r.path === '' && r.children);
  const todas: Route[] = protegida?.children ?? [];
  /** Pantallas: las rutas hijas que no son redirecciones (las redirecciones no tienen módulo propio). */
  const hijos: Route[] = todas.filter((r) => r.redirectTo === undefined);

  it('/personas redirige a RR.HH. › Trabajadores (enlaces guardados)', () => {
    expect(todas.find((r) => r.path === 'personas')?.redirectTo).toBe('rrhh/trabajadores');
    expect(todas.filter((r) => r.redirectTo !== undefined).map((r) => r.path)).toEqual(['personas']);
  });

  it('expone /login solo para invitados', () => {
    expect(login?.component).toBe(LoginComponent);
    expect(login?.canActivate).toEqual([invitadoGuard]);
    expect(login?.data?.['modulo']).toBeUndefined();
  });

  it('protege todas las demás rutas (incluidas /imprimir) con authGuard y permisoGuard', () => {
    expect(protegida?.canActivateChild).toEqual([authGuard, permisoGuard]);
    const sueltas = routes.filter((r) => r !== login && r !== protegida && r.path !== '**');
    expect(sueltas).toEqual([]);
    expect(hijos.some((r) => r.path?.startsWith('imprimir/'))).toBe(true);
    expect(routes.at(-1)?.path).toBe('**');
  });

  it('todas las pantallas (salvo el inicio y las impresiones) declaran un data.modulo válido', () => {
    const sinModulo: string[] = [];
    for (const ruta of hijos) {
      const modulo: unknown = ruta.data?.['modulo'];
      if (SIN_MODULO.includes(ruta.path ?? '')) {
        expect(modulo).toBeUndefined();
        continue;
      }
      if (typeof modulo !== 'string' || !esClaveModulo(modulo)) sinModulo.push(ruta.path ?? '(sin path)');
    }
    expect(sinModulo).toEqual([]);
    expect(hijos.length).toBeGreaterThanOrEqual(43);
  });

  it('cada módulo con ruta propia en el catálogo tiene al menos una pantalla', () => {
    const usados = new Set(hijos.map((r) => r.data?.['modulo']));
    const SIN_PANTALLA_TODAVIA: readonly string[] = [];
    expect(
      CLAVES_MODULO.filter((c) => !usados.has(c) && !MODULOS_RETIRADOS.includes(c) && !SIN_PANTALLA_TODAVIA.includes(c)),
    ).toEqual([]);
  });

  it.each([
    ['proyectos/catalogos', 'proyectos.catalogos'],
    ['centros-costos/:id/datos', 'obra'],
    ['presupuestos/plantillas', 'presupuestos.plantillas'],
    ['requerimientos/nuevo', 'requerimientos'],
    ['requerimientos/:id', 'requerimientos'],
    ['maestros-generales/especialidades', 'maestros.generales'],
    ['anexos', 'maestros.anexos'],
    ['equipos-tecnologicos', 'tecnologia.dashboard'],
    ['equipos-mantenimiento', 'tecnologia.mantenimiento'],
    ['rrhh/trabajadores', 'rrhh.trabajadores'],
    ['rrhh/catalogos', 'rrhh.catalogos'],
    ['almacen/salidas', 'almacen.salidas'],
  ])('%s -> %s', (path, modulo) => {
    expect(hijos.find((r) => r.path === path)?.data?.['modulo']).toBe(modulo);
  });

  it('el inicio (/) es InicioComponent (lleva a Centros de Costos), sin módulo (solo sesión)', () => {
    const inicio = hijos.find((r) => r.path === '');
    expect(inicio?.component).toBe(InicioComponent);
    expect(inicio?.data?.['modulo']).toBeUndefined();
    expect(inicio?.canActivate).toBeUndefined();
    expect(hijos.filter((r) => r.path === '')).toHaveLength(1);
  });

  it('el Dashboard Situacional se retiró (DG11): ya no tiene ruta', () => {
    expect(hijos.some((r) => r.path === 'dashboard-situacional')).toBe(false);
    expect(hijos.some((r) => r.data?.['modulo'] === 'dashboard')).toBe(false);
  });

  it('catálogos de proyecto y modulos conservan su pantalla y su módulo', () => {
    const catalogos = hijos.find((r) => r.path === 'proyectos/catalogos');
    expect(catalogos?.component).toBe(CatalogosProyectoComponent);
    expect(catalogos?.data?.['modulo']).toBe('proyectos.catalogos');
    const modulos = hijos.find((r) => r.path === 'modulos');
    expect(modulos?.component).toBe(ModulesDashboardComponent);
    expect(modulos?.data?.['modulo']).toBe('modulos');
  });

  it.each(IMPRESIONES)('%s: impresión sin módulo (solo sesión), conserva data.tipo = %s', (path, tipo) => {
    const ruta = hijos.find((r) => r.path === path);
    expect(ruta?.component).toBe(ImprimirComponent);
    expect(ruta?.data?.['modulo']).toBeUndefined();
    expect(ruta?.data?.['tipo']).toBe(tipo);
  });

  it('las únicas pantallas sin módulo son el inicio y las impresiones', () => {
    const sin = hijos.filter((r) => r.data?.['modulo'] === undefined).map((r) => r.path ?? '');
    expect([...sin].sort()).toEqual([...SIN_MODULO].sort());
  });

  it('conserva data.tipo en las rutas que lo usan', () => {
    expect(hijos.find((r) => r.path === 'almacen/salidas')?.data?.['tipo']).toBe('salidas');
    expect(hijos.find((r) => r.path === 'imprimir/fur/:id')?.data?.['tipo']).toBe('fur');
  });

  it('admin/usuarios, admin/roles y admin/empresas se rigen por su módulo admin.* (sin guard de rol propio)', () => {
    for (const [path, modulo] of [['admin/usuarios', 'admin.usuarios'], ['admin/roles', 'admin.roles'], ['admin/empresas', 'admin.empresas']]) {
      const ruta = hijos.find((r) => r.path === path);
      expect(ruta?.data?.['modulo']).toBe(modulo);
      expect(ruta?.canActivate).toBeUndefined();
    }
  });

  it('admin/roles pide confirmación al salir con cambios sin guardar', () => {
    expect(hijos.find((r) => r.path === 'admin/roles')?.canDeactivate).toEqual([rolesPendientesGuard]);
  });
});
