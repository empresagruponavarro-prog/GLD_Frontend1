import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
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
  readonly eliminar = output<ObraPlano>();

  protected readonly filtroQuery = signal('');

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
