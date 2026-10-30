import { Routes } from '@angular/router';
import { authGuard, invitadoGuard } from './core/auth/auth.guards';
import { permisoGuard, rutaModulo, rutaSesion } from './core/auth/permiso.guard';
import { LoginComponent } from './features/auth/login/login';
import { ModulesDashboardComponent } from './features/modules-dashboard/modules-dashboard';
import { IncidenciasComponent } from './features/incidencias/incidencias';
import { UsuariosComponent } from './features/administration/usuarios/usuarios';
import { RolesComponent } from './features/administration/roles/roles';
import { rolesPendientesGuard } from './features/administration/roles/roles.guard';
import { EmpresasComponent } from './features/administration/empresas/empresas';
import { MaestrosGeneralesComponent } from './features/maestros-generales/maestros-generales';
import { AnexosComponent } from './features/maestros-generales/anexos/anexos';
import { ProductosComponent } from './features/maestros-generales/productos/productos';
import { EquiposDashboardComponent } from './features/maestros-generales/equipos-dashboard/equipos-dashboard';
import { EspecialidadesComponent } from './features/maestros-generales/especialidades/especialidades';
import { TipoDocIdentidadComponent } from './features/maestros-generales/tipo-doc-identidad/tipo-doc-identidad';
import { CentrosCostosDashboardComponent } from './features/centros-costos/centro-costos-dashboard/centros-costos-dashboard';
import { CentrosCostosComponent } from './features/centros-costos/centros-costos';
import { ObraCockpitComponent } from './features/centros-costos/obra-cockpit/obra-cockpit';
import { PresupuestosComponent } from './features/presupuestos/presupuestos';
import { DocumentosOrigenComponent } from './features/documentos/documentos-origen/documentos-origen';

import { AlmacenesComponent } from './features/almacen/almacenes/almacenes';
import { ConsultaAlmacenComponent } from './features/almacen/consulta/consulta';
import { DocumentosAlmacenComponent } from './features/almacen/documentos/documentos';
import { KardexComponent } from './features/almacen/kardex/kardex';
import { PrestamosComponent } from './features/almacen/prestamos/prestamos';
import { StockActualComponent } from './features/almacen/stock/stock';
import { RecepcionesComponent } from './features/almacen/recepciones/recepciones';
import { DocumentosAdministracionComponent } from './features/documentos/administracion/administracion';
import { AreasComponent } from './features/maestros-generales/areas/areas';
import { LocalesComponent } from './features/maestros-generales/locales/locales';
import { AreasModulosComponent } from './features/administration/roles/areas-modulos/areas-modulos';
import { UnidadesMedidaComponent } from './features/maestros-generales/unidades-medida/unidades-medida';
import { ImprimirComponent } from './features/imprimir/imprimir';
import { CuentasComponent } from './features/tesoreria/cuentas/cuentas';
import { TipoCambioComponent } from './features/tesoreria/tipo-cambio/tipo-cambio';
import { ProgramacionComponent } from './features/tesoreria/programacion/programacion';
import { PagosComponent } from './features/tesoreria/pagos/pagos';
import { ConsultaTesoreriaComponent } from './features/tesoreria/consulta/consulta';

import { BandejaAprobacionComponent } from './features/requerimientos/bandeja-aprobacion/bandeja-aprobacion';
import { RequerimientoFormComponent } from './features/requerimientos/requerimiento-form/requerimiento-form';
import { RequerimientosListaComponent } from './features/requerimientos/requerimientos-lista/requerimientos-lista';

import { MantenimientoPlantillasComponent } from './features/presupuestos/mantenimiento-plantillas/mantenimiento-plantillas';

/**
 * Cada pantalla declara su módulo (`data.modulo`, plan 05 §5) y `permisoGuard` exige el permiso
 * `ver` de ese módulo. No llevan módulo (solo exigen sesión): el inicio (`/`, menú de módulos), las
 * impresiones (`imprimir/*`), el login y el 404.
 */
export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [invitadoGuard] },
  // Todas las pantallas requieren sesión; las que declaran módulo, además el `ver` de ese módulo.
  {
    path: '',
    canActivateChild: [authGuard, permisoGuard],
    children: [
      rutaModulo('presupuestos/plantillas', MantenimientoPlantillasComponent, 'presupuestos.plantillas'),
      // Inicio: menú de módulos principal, sin módulo (es el destino al denegar el acceso a una pantalla).
      rutaSesion('', ModulesDashboardComponent),
      rutaModulo('dashboard-situacional', CentrosCostosDashboardComponent, 'dashboard'),
      rutaModulo('centros-costos', CentrosCostosComponent, 'centros-costos'),
      rutaModulo('centros-costos/:id/datos', ObraCockpitComponent, 'obra'),
      rutaModulo('modulos', ModulesDashboardComponent, 'modulos'),
      rutaModulo('incidencias', IncidenciasComponent, 'incidencias'),
      rutaModulo('maestros-generales', MaestrosGeneralesComponent, 'maestros.generales'),
      // Administración: como el resto, la decide la matriz (la API la aplica siempre en estricto).
      rutaModulo('admin/usuarios', UsuariosComponent, 'admin.usuarios'),
      { ...rutaModulo('admin/roles', RolesComponent, 'admin.roles'), canDeactivate: [rolesPendientesGuard] },
      { ...rutaModulo('admin/roles/areas', AreasModulosComponent, 'admin.roles'), canDeactivate: [rolesPendientesGuard] },
      rutaModulo('admin/empresas', EmpresasComponent, 'admin.empresas'),
      rutaModulo('anexos', AnexosComponent, 'maestros.anexos'),
      rutaModulo('productos', ProductosComponent, 'maestros.productos'),
      rutaModulo('equipos-tecnologicos', EquiposDashboardComponent, 'maestros.anexos'),
      // Maestro de personas del módulo Activo Fijo: los anexos de tipo Trabajador (reutiliza la pantalla de Anexos).
      rutaModulo('personas', AnexosComponent, 'maestros.anexos'),
      rutaModulo('maestros-generales/especialidades', EspecialidadesComponent, 'maestros.generales'),
      rutaModulo('maestros-generales/tipo-doc-identidad', TipoDocIdentidadComponent, 'maestros.generales'),
      rutaModulo('maestros-generales/unidades-medida', UnidadesMedidaComponent, 'maestros.generales'),
      rutaModulo('presupuestos', PresupuestosComponent, 'presupuestos'),
      rutaModulo('documentos/origen', DocumentosOrigenComponent, 'documentos.origen'),
      rutaModulo('documentos/administracion', DocumentosAdministracionComponent, 'documentos.administracion'),
      rutaModulo('maestros-generales/areas', AreasComponent, 'maestros.areas'),
      rutaModulo('maestros-generales/locales', LocalesComponent, 'maestros.generales'),
      rutaModulo('maestros-generales/ubicaciones', LocalesComponent, 'maestros.generales'),
      rutaModulo('tesoreria/cuentas', CuentasComponent, 'tesoreria.cuentas'),
      rutaModulo('tesoreria/tipo-cambio', TipoCambioComponent, 'tesoreria.tipo-cambio'),
      rutaModulo('tesoreria/programacion', ProgramacionComponent, 'tesoreria.programacion'),
      rutaModulo('tesoreria/pagos', PagosComponent, 'tesoreria.pagos'),
      rutaModulo('tesoreria/consulta', ConsultaTesoreriaComponent, 'tesoreria.consulta'),
      // Formatos para imprimir o guardar como PDF (sin menú lateral): por ahora solo exigen sesión
      // (la API marca sus lecturas como compartidas).
      rutaSesion('imprimir/fur/:id', ImprimirComponent, { tipo: 'fur' }),
      rutaSesion('imprimir/cuadro-comparativo/:id', ImprimirComponent, { tipo: 'cuadro-comparativo' }),
      rutaSesion('imprimir/documento-origen/:id', ImprimirComponent, { tipo: 'documento-origen' }),
      rutaSesion('imprimir/comprobante-pago/:id', ImprimirComponent, { tipo: 'comprobante-pago' }),
      rutaSesion('imprimir/expediente/:id', ImprimirComponent, { tipo: 'expediente' }),
      rutaModulo('requerimientos', RequerimientosListaComponent, 'requerimientos'),
      rutaModulo('requerimientos/aprobacion', BandejaAprobacionComponent, 'requerimientos.aprobacion'),
      rutaModulo('requerimientos/nuevo', RequerimientoFormComponent, 'requerimientos'),
      rutaModulo('requerimientos/:id', RequerimientoFormComponent, 'requerimientos'),
      rutaModulo('almacen/consulta', ConsultaAlmacenComponent, 'almacen.consulta'),
      rutaModulo('almacen/stock', StockActualComponent, 'almacen.stock'),
      rutaModulo('almacen/inventario-inicial', DocumentosAlmacenComponent, 'almacen.inventario-inicial', { tipo: 'inventario-inicial' }),
      rutaModulo('almacen/ingresos', DocumentosAlmacenComponent, 'almacen.ingresos', { tipo: 'ingresos' }),
      rutaModulo('almacen/recepciones', RecepcionesComponent, 'almacen.recepciones'),
      rutaModulo('almacen/salidas', DocumentosAlmacenComponent, 'almacen.salidas', { tipo: 'salidas' }),
      rutaModulo('almacen/transferencias', DocumentosAlmacenComponent, 'almacen.transferencias', { tipo: 'transferencias' }),
      rutaModulo('almacen/prestamos', PrestamosComponent, 'almacen.prestamos'),
      rutaModulo('almacen/kardex', KardexComponent, 'almacen.kardex'),
      rutaModulo('almacen/almacenes', AlmacenesComponent, 'almacen.almacenes'),
    ],
  },
  { path: '**', redirectTo: '' }
];


