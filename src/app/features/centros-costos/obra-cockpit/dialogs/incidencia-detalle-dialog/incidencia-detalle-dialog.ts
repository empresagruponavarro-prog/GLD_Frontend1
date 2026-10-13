import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ModalComponent } from '@shared/components/modal/modal';
import { ObraIncidencia } from '../../obra.interface';

@Component({
  selector: 'app-incidencia-detalle-dialog',
  standalone: true,
  imports: [CommonModule, DatePipe, ModalComponent],
  templateUrl: './incidencia-detalle-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidenciaDetalleDialogComponent {
  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly nombreObra = input<string>('');
  readonly incidencia = input<ObraIncidencia | null>(null);

  readonly closed = output<void>();
  readonly editar = output<ObraIncidencia>();
  readonly resolver = output<ObraIncidencia>();

  protected readonly esResuelta = computed(() => {
    return (this.incidencia()?.estado ?? '').toUpperCase() === 'RESUELTA';
  });

  protected readonly prioridadColor = computed(() => {
    const p = (this.incidencia()?.prioridad ?? '').toUpperCase();
    switch (p) {
      case 'CRITICA':
      case 'ALTA':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'MEDIA':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  });

  protected onImprimir(): void {
    window.print();
  }

  protected onEditar(): void {
    const inc = this.incidencia();
    if (inc) {
      this.editar.emit(inc);
    }
  }

  protected onResolver(): void {
    const inc = this.incidencia();
    if (inc) {
      this.resolver.emit(inc);
    }
  }
}
