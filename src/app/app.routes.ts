import { Routes } from '@angular/router';
import { ModulesDashboardComponent } from './features/modules-dashboard/modules-dashboard';
import { IncidenciasComponent } from './features/incidencias/incidencias';
import { UsuariosComponent } from './features/administration/usuarios/usuarios';
import { MenusComponent } from './features/administration/menus/menus';
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

import { MantenimientoPlantillasComponent } from './features/presupuestos/mantenimiento-plantillas/mantenimiento-plantillas';

export const routes: Routes = [
  { path: 'presupuestos/plantillas', component: MantenimientoPlantillasComponent },
  { path: '', component: CentrosCostosDashboardComponent },
  { path: 'dashboard-situacional', component: CentrosCostosDashboardComponent },
  { path: 'centros-costos', component: CentrosCostosComponent },
  { path: 'centros-costos/:id/datos', component: ObraCockpitComponent },
  { path: 'modulos', component: ModulesDashboardComponent },
  { path: 'incidencias', component: IncidenciasComponent },
  { path: 'maestros-generales', component: MaestrosGeneralesComponent },
  { path: 'admin/usuarios', component: UsuariosComponent },
  { path: 'admin/menus', component: MenusComponent },
  { path: 'admin/empresas', component: EmpresasComponent },
  { path: 'anexos', component: AnexosComponent },
  { path: 'productos', component: ProductosComponent },
  { path: 'maestros-generales/especialidades', component: EspecialidadesComponent },
  { path: 'maestros-generales/tipo-doc-identidad', component: TipoDocIdentidadComponent },
  { path: 'presupuestos', component: PresupuestosComponent },
  { path: 'documentos/origen', component: DocumentosOrigenComponent },
  { path: '**', redirectTo: '' }
];


