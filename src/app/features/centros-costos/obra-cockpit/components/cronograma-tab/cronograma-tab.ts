import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { clampPct, estadoSemanaClass, ordenarSemanas } from '../../obra.calc';
import { ESTADOS_SEMANA, ObraCabecera, ObraKpi, ObraSemana } from '../../obra.interface';
import { CurvaSChartComponent } from './curva-s-chart/curva-s-chart';
import { valorDeEvento } from '@shared/utils/eventos';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';

@Component({
  selector: 'app-cronograma-tab',
  standalone: true,
  imports: [DatePipe, DecimalPipe, CurvaSChartComponent],
  templateUrl: './cronograma-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CronogramaTabComponent {
  readonly semanas = input<readonly ObraSemana[]>([]);
  readonly kpis = input<ObraKpi | undefined>(undefined);
  readonly cabecera = input<ObraCabecera | undefined>(undefined);
  /** Permisos del módulo `obra`; sin ellos la pestaña queda en solo lectura. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly nueva = output<void>();
  readonly editar = output<ObraSemana>();
  readonly evidencias = output<ObraSemana>();
  readonly registrarAvance = output<ObraSemana>();
  readonly eliminar = output<ObraSemana>();
  readonly generarLote = output<void>();

  protected readonly estados = ESTADOS_SEMANA;
  protected readonly estadoClass = estadoSemanaClass;
  protected readonly clampPct = clampPct;
  protected readonly filtroEstado = signal('');
  protected readonly vistaActiva = signal<'ambos' | 'grafico' | 'tabla'>('ambos');

  protected setVista(v: 'ambos' | 'grafico' | 'tabla'): void {
    this.vistaActiva.set(v);
  }

  protected readonly semanasFiltradas = computed(() => {
    const f = this.filtroEstado();
    const ordenadas = ordenarSemanas(this.semanas());
    return f ? ordenadas.filter((s) => s.estado === f) : ordenadas;
  });

  protected readonly fechaInicio = computed(() => this.cabecera()?.fecha_inicio || ordenarSemanas(this.semanas())[0]?.fecha_inicio || '');
  protected readonly fechaFin = computed(() => {
    const ord = ordenarSemanas(this.semanas());
    return this.cabecera()?.fecha_fin_prog || ord[ord.length - 1]?.fecha_fin || '';
  });

  protected onFiltro(event: Event): void {
    this.filtroEstado.set(valorDeEvento(event));
  }
}
