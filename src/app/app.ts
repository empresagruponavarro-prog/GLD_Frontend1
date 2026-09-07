import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { SidebarComponent } from './core/sidebar/sidebar';

/* Componente Principal de la Aplicación con Menú Hamburguesa Integrado */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, SidebarComponent],
  templateUrl: './app.html'
})
export class AppComponent {
  title = 'Sistema GLD';
  isSidebarCollapsed: boolean = false; /* Controla si el menú lateral está visible u oculto */

  /* Alterna la visibilidad del menú lateral (Menú Hamburguesa) */
  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }
}
