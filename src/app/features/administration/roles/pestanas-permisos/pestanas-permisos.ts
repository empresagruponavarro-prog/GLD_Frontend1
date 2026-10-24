import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Pestañas de "Roles y permisos": lo que puede hacer cada rol y los módulos que tiene cada área.
 * Las dos pantallas comparten el permiso `admin.roles`.
 */
@Component({
  selector: 'app-pestanas-permisos',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="pestanas-permisos" aria-label="Secciones de permisos">
      <a
        class="pestanas-permisos__tab"
        routerLink="/admin/roles"
        routerLinkActive="pestanas-permisos__tab--activa"
        [routerLinkActiveOptions]="{ exact: true }"
        data-testid="pestana-roles"
      >
        <i class="fa-solid fa-user-shield" aria-hidden="true"></i> Permisos por rol
      </a>
      <a
        class="pestanas-permisos__tab"
        routerLink="/admin/roles/areas"
        routerLinkActive="pestanas-permisos__tab--activa"
        data-testid="pestana-areas"
      >
        <i class="fa-solid fa-sitemap" aria-hidden="true"></i> Módulos por área
      </a>
    </nav>
  `,
  styles: `
    .pestanas-permisos {
      display: flex;
      gap: 0.25rem;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 1rem;
    }
    .pestanas-permisos__tab {
      padding: 0.6rem 1rem;
      border: 1px solid transparent;
      border-bottom: 0;
      border-radius: 0.5rem 0.5rem 0 0;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
    }
    .pestanas-permisos__tab:hover {
      color: var(--text-main, #0f172a);
      background: #f8fafc;
    }
    .pestanas-permisos__tab--activa {
      color: #0f172a;
      background: #ffffff;
      border-color: var(--border-color);
      margin-bottom: -1px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PestanasPermisosComponent {}
