import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ESTADOS_INCIDENCIA, ObraIncidencia, PRIORIDADES_INCIDENCIA } from '../../obra.interface';

@Component({
  selector: 'app-incidencias-tab',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './incidencias-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidenciasTabComponent {
  readonly incidencias = input<readonly ObraIncidencia[]>([]);
  readonly reportar = output<void>();
  readonly verBitacora = output<ObraIncidencia>();
  readonly resolver = output<ObraIncidencia>();

  protected readonly prioridades = PRIORIDADES_INCIDENCIA;
  protected readonly estados = ESTADOS_INCIDENCIA;

  /** Filtros ('' = todos). Los valores coinciden con los que guarda el backend (mayúsculas). */
  protected readonly filtroEstado = signal('');
  protected readonly filtroPrioridad = signal('');

  protected readonly incidenciasFiltradas = computed(() => {
    const estado = this.filtroEstado();
    const prioridad = this.filtroPrioridad();
    return this.incidencias().filter(
      (i) => (!estado || this.estadoDe(i) === estado) && (!prioridad || this.prioridadDe(i) === prioridad),
    );
  });

  protected readonly pendientes = computed(() => this.incidencias().filter((i) => !this.esResuelta(i)).length);

  /** Normaliza por si algún registro antiguo quedó con otra capitalización. */
  protected prioridadDe(i: ObraIncidencia): string {
    return (i.prioridad ?? '').toUpperCase();
  }

  protected estadoDe(i: ObraIncidencia): string {
    return (i.estado ?? '').toUpperCase();
  }

  protected esResuelta(i: ObraIncidencia): boolean {
    return this.estadoDe(i) === 'RESUELTA';
  }

  protected onFiltroEstado(event: Event): void {
    this.filtroEstado.set((event.target as HTMLSelectElement).value);
  }

  protected onFiltroPrioridad(event: Event): void {
    this.filtroPrioridad.set((event.target as HTMLSelectElement).value);
  }
}
