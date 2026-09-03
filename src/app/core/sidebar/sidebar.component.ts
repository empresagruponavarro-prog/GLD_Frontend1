import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="sidebar-header" routerLink="/" style="cursor: pointer;">
      <i class="fa-solid fa-building-user"></i> GLD Arquitectura
    </div>

    <ul class="sidebar-menu">
      <li class="menu-category">Navegación</li>
      <li>
        <a class="sidebar-item" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <i class="fa-solid fa-grid-2"></i> Módulos Principal
        </a>
      </li>

      <li class="menu-category">Operaciones</li>
      <li>
        <a class="sidebar-item" routerLink="/incidencias" routerLinkActive="active">
          <i class="fa-solid fa-clipboard-list"></i> Registro de Incidencias
        </a>
      </li>

      <li class="menu-category">Módulos del Sistema</li>
      <li>
        <div class="sidebar-item has-sub" (click)="toggleMaestros()">
          <span><i class="fa-solid fa-gears"></i> Maestros Generales</span>
          <i class="fa-solid" [class.fa-chevron-down]="!isMaestrosOpen" [class.fa-chevron-up]="isMaestrosOpen"></i>
        </div>
        <ul class="sidebar-submenu" *ngIf="isMaestrosOpen">
          <li>
            <a class="sidebar-subitem" routerLink="/admin/empresas" routerLinkActive="active">
              <i class="fa-solid fa-building"></i> Empresas
            </a>
          </li>
        </ul>
      </li>

      <li class="menu-category">Administración</li>
      <li>
        <a class="sidebar-item" routerLink="/admin/usuarios" routerLinkActive="active">
          <i class="fa-solid fa-users-gear"></i> Usuarios y Roles
        </a>
      </li>
      <li>
        <a class="sidebar-item" routerLink="/admin/menus" routerLinkActive="active">
          <i class="fa-solid fa-sitemap"></i> Estructura de Menús
        </a>
      </li>
    </ul>
  `
})
export class SidebarComponent {
  isMaestrosOpen = true;

  toggleMaestros() {
    this.isMaestrosOpen = !this.isMaestrosOpen;
  }
}
