import { Routes } from '@angular/router';
import { ModulesDashboardComponent } from './features/modules-dashboard/modules-dashboard';
import { IncidenciasComponent } from './features/incidencias/incidencias';
import { UsuariosComponent } from './features/administration/usuarios/usuarios';
import { MenusComponent } from './features/administration/menus/menus';
import { EmpresasComponent } from './features/administration/empresas/empresas';
import { MaestrosGeneralesComponent } from './features/maestros-generales/maestros-generales';
import { CentrosCostosDashboardComponent } from './features/centros-costos/centro-costos-dashboard/centros-costos-dashboard';
import { CentrosCostosComponent } from './features/centros-costos/centros-costos';
import { PresupuestosComponent } from './features/presupuestos/presupuestos';

export const routes: Routes = [
  { path: '', component: CentrosCostosDashboardComponent },
  { path: 'dashboard-situacional', component: CentrosCostosDashboardComponent },
  { path: 'centros-costos', component: CentrosCostosComponent },
  { path: 'modulos', component: ModulesDashboardComponent },
  { path: 'incidencias', component: IncidenciasComponent },
  { path: 'maestros-generales', component: MaestrosGeneralesComponent },
  { path: 'admin/usuarios', component: UsuariosComponent },
  { path: 'admin/menus', component: MenusComponent },
  { path: 'admin/empresas', component: EmpresasComponent },
  { path: 'presupuestos', component: PresupuestosComponent },
  { path: '**', redirectTo: '' }
];


