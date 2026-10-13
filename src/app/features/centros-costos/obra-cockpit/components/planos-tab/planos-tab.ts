import { ChangeDetectionStrategy, Component, HostListener, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ObraPlano } from '../../obra.interface';

@Component({
  selector: 'app-planos-tab',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './planos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanosTabComponent {
  readonly planos = input<readonly ObraPlano[]>([]);
  readonly subir = output<void>();
  readonly ver = output<ObraPlano>();
  readonly descargar = output<ObraPlano>();
  readonly nuevaVersion = output<ObraPlano>();
  readonly historial = output<ObraPlano>();
  readonly editar = output<ObraPlano>();
  readonly eliminar = output<ObraPlano>();

  protected readonly filtroQuery = signal('');
  protected readonly menuPos = signal<{ top: number; right: number; plano: ObraPlano } | null>(null);

  @HostListener('document:click')
  @HostListener('window:scroll')
  @HostListener('window:resize')
  protected onGlobalDismiss(): void {
    this.cerrarMenu();
  }

  protected toggleMenu(plano: ObraPlano, event: MouseEvent): void {
    event.stopPropagation();
    const current = this.menuPos();
    if (current && current.plano.id === plano.id) {
      this.cerrarMenu();
      return;
    }

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const menuHeight = 185;
    const espacioAbajo = window.innerHeight - rect.bottom;
    const abreHaciaArriba = espacioAbajo < menuHeight && rect.top > menuHeight;
    const top = abreHaciaArriba ? rect.top - menuHeight - 4 : rect.bottom + 4;
    const right = Math.max(16, window.innerWidth - rect.right);

    this.menuPos.set({ top, right, plano });
  }

  protected cerrarMenu(): void {
    this.menuPos.set(null);
  }

  protected readonly planosFiltrados = computed(() => {
    let p = this.planos();
    const query = this.filtroQuery().toLowerCase();

    if (query) {
      p = p.filter((pl) => pl.codigo_plano.toLowerCase().includes(query) || pl.nombre_plano.toLowerCase().includes(query) || pl.disciplina.toLowerCase().includes(query));
    }
    return p;
  });

  protected onFilterQuery(event: Event): void {
    this.filtroQuery.set((event.target as HTMLInputElement).value);
  }
}
