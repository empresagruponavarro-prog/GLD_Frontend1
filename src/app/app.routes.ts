import { Routes } from '@angular/router';
import { ModulesDashboardComponent } from './features/modules-dashboard/modules-dashboard.component';
import { IncidenciasComponent } from './features/incidencias/incidencias.component';
import { UsuariosComponent } from './features/administration/usuarios/usuarios.component';
import { MenusComponent } from './features/administration/menus/menus.component';
import { EmpresasComponent } from './features/administration/empresas/empresas.component';
import { MaestrosGeneralesComponent } from './features/maestros-generales/maestros-generales.component';
import { CentrosCostosDashboardComponent } from './features/centros-costos/centros-costos-dashboard.component';

export const routes: Routes = [
  { path: '', component: ModulesDashboardComponent },
  { path: 'dashboard-situacional', component: CentrosCostosDashboardComponent },
  { path: 'centros-costos', component: CentrosCostosDashboardComponent },
  { path: 'incidencias', component: IncidenciasComponent },
  { path: 'maestros-generales', component: MaestrosGeneralesComponent },
  { path: 'admin/usuarios', component: UsuariosComponent },
  { path: 'admin/menus', component: MenusComponent },
  { path: 'admin/empresas', component: EmpresasComponent },
  { path: '**', redirectTo: '' }
];

