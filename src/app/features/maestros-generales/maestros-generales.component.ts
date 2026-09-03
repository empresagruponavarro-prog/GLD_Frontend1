import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface SubModuleCard {
  title: string;
  description: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-maestros-generales',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="content-header">
      <div>
        <h1 class="content-title">Maestros Generales</h1>
        <p class="content-subtitle">Gestión centralizada de tablas maestras de GLD.</p>
      </div>
    </div>

    <div class="content-body">
      <div class="modules-grid">
        <div class="module-card" *ngFor="let mod of subModules" [routerLink]="mod.route">
          <div class="module-icon">
            <i [class]="mod.icon"></i>
          </div>
          <span class="module-title">{{ mod.title }}</span>
          <small style="color: var(--text-muted); font-size: 0.75rem; text-align: center; margin-top: 0.25rem;">
            {{ mod.description }}
          </small>
        </div>
      </div>
    </div>
  `
})
export class MaestrosGeneralesComponent {
  subModules: SubModuleCard[] = [
    { title: 'Empresas', description: 'Registro y administración de datos de empresas', icon: 'fa-solid fa-building', route: '/admin/empresas' },
  ];
}
