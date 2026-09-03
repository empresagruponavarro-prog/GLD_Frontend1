import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface ModuleCard {
  title: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-modules-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="content-header">
      <div>
        <h1 class="content-title">Menú de Módulos Principal</h1>
        <p class="content-subtitle">Selecciona el módulo de GLD al que deseas ingresar.</p>
      </div>
    </div>

    <div class="content-body">
      <div class="modules-grid">
        <div class="module-card" *ngFor="let mod of modules" [routerLink]="mod.route">
          <div class="module-icon">
            <i [class]="mod.icon"></i>
          </div>
          <span class="module-title">{{ mod.title }}</span>
        </div>
      </div>
    </div>
  `
})
export class ModulesDashboardComponent {
  modules: ModuleCard[] = [
    { title: 'Tesorería', icon: 'fa-solid fa-coins', route: '/incidencias' },
    { title: 'Compras', icon: 'fa-solid fa-cart-shopping', route: '/incidencias' },
    { title: 'Maestros Generales', icon: 'fa-solid fa-gears', route: '/maestros-generales' },
    { title: 'Almacén', icon: 'fa-solid fa-boxes-stacked', route: '/incidencias' },
    { title: 'Proyectos', icon: 'fa-solid fa-diagram-project', route: '/incidencias' },
    { title: 'Finanzas', icon: 'fa-solid fa-chart-line', route: '/incidencias' },
    { title: 'Ventas', icon: 'fa-solid fa-hand-holding-dollar', route: '/incidencias' }
  ];
}
