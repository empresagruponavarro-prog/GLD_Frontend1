import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PermisosService } from '../auth/permisos.service';
import { EnlaceMenu, IdSubmenu, MENU_LATERAL, SeccionMenu, filtrarMenu } from './sidebar.menu';

@Component({
  selector: 'app-sidebar',
  imports: [RouterModule],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  readonly #permisos = inject(PermisosService);

  /**
   * Menú visible: cada enlace exige el permiso `ver` de su módulo (el Administrador ve todo);
   * los submenús y secciones sin enlaces visibles se ocultan.
   */
  protected readonly secciones = computed<SeccionMenu[]>(() =>
    filtrarMenu(MENU_LATERAL, (e: EnlaceMenu) => this.#permisos.puedeVer(e.modulo)),
  );

  readonly #abiertos = signal<Readonly<Record<IdSubmenu, boolean>>>({
    documentos: true,
    tesoreria: true,
    almacen: true,
    maestros: true,
    'activo-fijo': true,
  });

  protected abierto(id: IdSubmenu): boolean {
    return this.#abiertos()[id];
  }

  protected alternar(id: IdSubmenu): void {
    this.#abiertos.update((a) => ({ ...a, [id]: !a[id] }));
  }
}
