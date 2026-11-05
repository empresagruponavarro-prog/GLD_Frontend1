import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PermisosService } from '../auth/permisos.service';

/**
 * Inicio de la aplicación (`/`, GRP S-10): lleva a **Centros de Costos** a quien puede verlos. Es también el destino al
 * negar el acceso a una pantalla (`permisoGuard`), por eso nunca redirige a una pantalla que exija un permiso que la
 * persona no tiene: sin `centros-costos` va al menú de módulos si lo tiene, y si no, avisa en lugar de dar vueltas.
 */
@Component({
  selector: 'app-inicio',
  standalone: true,
  template: `
    <section class="page-scroll" style="padding: 2rem; text-align: center">
      @if (sinAcceso()) {
        <h1 class="content-title" data-testid="inicio-sin-acceso">No tiene módulos asignados</h1>
        <p class="content-subtitle">Pida al administrador que le conceda acceso a los módulos que necesita.</p>
      } @else {
        <p class="content-subtitle" data-testid="inicio-cargando">Cargando…</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioComponent {
  readonly #permisos = inject(PermisosService);
  readonly #router = inject(Router);

  protected readonly sinAcceso = signal(false);

  constructor() {
    void this.resolver();
  }

  private async resolver(): Promise<void> {
    await this.#permisos.listo();
    if (this.#permisos.puedeVer('centros-costos')) {
      await this.#router.navigateByUrl('/centros-costos', { replaceUrl: true });
    } else if (this.#permisos.puedeVer('modulos')) {
      await this.#router.navigateByUrl('/modulos', { replaceUrl: true });
    } else {
      this.sinAcceso.set(true);
    }
  }
}
