import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { SidebarComponent } from './core/sidebar/sidebar.component';

/* Componente Principal de la Aplicación con Menú Hamburguesa Integrado */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, SidebarComponent],
  template: `
    <!-- Barra Superior (Header) con Botón de Menú Hamburguesa -->
    <header class="app-header">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <!-- Botón Hamburguesa para Ocultar/Mostrar el Menú Lateral -->
        <button class="hamburger-btn" (click)="toggleSidebar()" title="Ocultar o Mostrar Menú Lateral">
          <i class="fa-solid fa-bars"></i>
        </button>
        
        <div class="brand" routerLink="/" style="cursor: pointer;">
          <i class="fa-solid fa-layer-group"></i> SistemaGLD2026
        </div>
      </div>

      <div style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fa-solid fa-user-circle" style="font-size: 1.25rem; color: #5a9e80;"></i>
        <span>Administrador Sistema</span>
      </div>
    </header>

    <!-- Contenedor Principal con Estado de Menú Colapsable -->
    <div class="app-container" [class.sidebar-collapsed]="isSidebarCollapsed">
      <app-sidebar></app-sidebar>
      <main class="app-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class AppComponent {
  title = 'Sistema GLD';
  isSidebarCollapsed: boolean = false; /* Controla si el menú lateral está visible u oculto */

  /* Alterna la visibilidad del menú lateral (Menú Hamburguesa) */
  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }
}
