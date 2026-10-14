import { Routes } from '@angular/router';
import { authGuard, invitadoGuard, rolGuard } from './core/auth/auth.guards';
import { LoginComponent } from './features/auth/login/login';
import { ModulesDashboardComponent } from './features/modules-dashboard/modules-dashboard';
import { IncidenciasComponent } from './features/incidencias/incidencias';
import { UsuariosComponent } from './features/administration/usuarios/usuarios';
import { RolesComponent } from './features/administration/roles/roles';
import { EmpresasComponent } from './features/administration/empresas/empresas';
import { MaestrosGeneralesComponent } from './features/maestros-generales/maestros-generales';
import { AnexosComponent } from './features/maestros-generales/anexos/anexos';
import { ProductosComponent } from './features/maestros-generales/productos/productos';
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

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [invitadoGuard] },
  // Todas las pantallas (incluidas las de /imprimir) requieren sesión.
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: 'presupuestos/plantillas', component: MantenimientoPlantillasComponent },
      { path: '', component: CentrosCostosDashboardComponent },
      { path: 'dashboard-situacional', component: CentrosCostosDashboardComponent },
      { path: 'centros-costos', component: CentrosCostosComponent },
      { path: 'centros-costos/:id/datos', component: ObraCockpitComponent },
      { path: 'modulos', component: ModulesDashboardComponent },
      { path: 'incidencias', component: IncidenciasComponent },
      { path: 'maestros-generales', component: MaestrosGeneralesComponent },
      { path: 'admin/usuarios', component: UsuariosComponent, canActivate: [rolGuard('Administrador')] },
      { path: 'admin/roles', component: RolesComponent, canActivate: [rolGuard('Administrador')] },
      { path: 'admin/empresas', component: EmpresasComponent, canActivate: [rolGuard('Administrador')] },
      { path: 'anexos', component: AnexosComponent },
      { path: 'productos', component: ProductosComponent },
      { path: 'maestros-generales/especialidades', component: EspecialidadesComponent },
      { path: 'maestros-generales/tipo-doc-identidad', component: TipoDocIdentidadComponent },
      { path: 'presupuestos', component: PresupuestosComponent },
      { path: 'documentos/origen', component: DocumentosOrigenComponent },
      { path: 'documentos/administracion', component: DocumentosAdministracionComponent },
      { path: 'maestros-generales/areas', component: AreasComponent },
      { path: 'tesoreria/cuentas', component: CuentasComponent },
      { path: 'tesoreria/tipo-cambio', component: TipoCambioComponent },
      { path: 'tesoreria/programacion', component: ProgramacionComponent },
      { path: 'tesoreria/pagos', component: PagosComponent },
      { path: 'tesoreria/consulta', component: ConsultaTesoreriaComponent },
      // Formatos para imprimir o guardar como PDF (sin menú lateral)
      { path: 'imprimir/fur/:id', component: ImprimirComponent, data: { tipo: 'fur' } },
      { path: 'imprimir/cuadro-comparativo/:id', component: ImprimirComponent, data: { tipo: 'cuadro-comparativo' } },
      { path: 'imprimir/documento-origen/:id', component: ImprimirComponent, data: { tipo: 'documento-origen' } },
      { path: 'imprimir/comprobante-pago/:id', component: ImprimirComponent, data: { tipo: 'comprobante-pago' } },
      { path: 'imprimir/expediente/:id', component: ImprimirComponent, data: { tipo: 'expediente' } },
      { path: 'requerimientos', component: RequerimientosListaComponent },
      { path: 'requerimientos/aprobacion', component: BandejaAprobacionComponent },
      { path: 'requerimientos/nuevo', component: RequerimientoFormComponent },
      { path: 'requerimientos/:id', component: RequerimientoFormComponent },
      { path: 'almacen/consulta', component: ConsultaAlmacenComponent },
      { path: 'almacen/stock', component: StockActualComponent },
      { path: 'almacen/inventario-inicial', component: DocumentosAlmacenComponent, data: { tipo: 'inventario-inicial' } },
      { path: 'almacen/ingresos', component: DocumentosAlmacenComponent, data: { tipo: 'ingresos' } },
      { path: 'almacen/recepciones', component: RecepcionesComponent },
      { path: 'almacen/salidas', component: DocumentosAlmacenComponent, data: { tipo: 'salidas' } },
      { path: 'almacen/transferencias', component: DocumentosAlmacenComponent, data: { tipo: 'transferencias' } },
      { path: 'almacen/prestamos', component: PrestamosComponent },
      { path: 'almacen/kardex', component: KardexComponent },
      { path: 'almacen/almacenes', component: AlmacenesComponent },
    ],
  },
  { path: '**', redirectTo: '' }
];


