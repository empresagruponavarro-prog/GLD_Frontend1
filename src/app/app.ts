import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, RouterModule } from '@angular/router';
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
  /** Las vistas /imprimir/* se muestran sin cabecera ni menú lateral (para imprimir o guardar como PDF). */
  isPrintView = signal(false);

  constructor() {
    const router = inject(Router);
    this.isPrintView.set(router.url.startsWith('/imprimir'));
    router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.isPrintView.set(e.urlAfterRedirects.startsWith('/imprimir'));
    });
  }

  isSidebarCollapsed: boolean = false; /* Controla si el menú lateral está visible u oculto */

  /* Alterna la visibilidad del menú lateral (Menú Hamburguesa) */
  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }
}
