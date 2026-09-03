import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { SidebarComponent } from './core/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, SidebarComponent],
  template: `
    <header class="app-header">
      <div class="brand" routerLink="/" style="cursor: pointer;">
        <i class="fa-solid fa-layer-group"></i> SistemaGLD2026
      </div>
      <div style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fa-solid fa-user-circle" style="font-size: 1.25rem;"></i>
        <span>Administrador Sistema</span>
      </div>
    </header>

    <div class="app-container">
      <app-sidebar></app-sidebar>
      <main class="app-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class AppComponent {
  title = 'Sistema GLD';
}
