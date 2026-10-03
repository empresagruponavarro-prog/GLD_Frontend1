import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface ModuleCard {
  title: string;
  icon: string;
  /** Sin ruta = módulo sin pantalla: se muestra deshabilitado ("Próximamente"). */
  route?: string;
}

@Component({
  selector: 'app-modules-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './modules-dashboard.html'
})
export class ModulesDashboardComponent {
  modules: ModuleCard[] = [
    { title: 'Tesorería', icon: 'fa-solid fa-coins' },
    { title: 'Compras', icon: 'fa-solid fa-cart-shopping' },
    { title: 'Maestros Generales', icon: 'fa-solid fa-gears', route: '/maestros-generales' },
    { title: 'Almacén', icon: 'fa-solid fa-boxes-stacked' },
    { title: 'Proyectos', icon: 'fa-solid fa-diagram-project' },
    { title: 'Finanzas', icon: 'fa-solid fa-chart-line' },
    { title: 'Ventas', icon: 'fa-solid fa-hand-holding-dollar' }
  ];
}
