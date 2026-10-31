import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { fechaCorta } from '../../../centros-costos/obra-cockpit/obra-control.calc';
import { ClaveSituacion } from '../../../centros-costos/obra-cockpit/obra-control.interface';
import { escalaDe, marcasDeMes } from '../../operaciones.calc';

/** Una fila del Gantt: una obra (nivel 0) o una partida/subpartida (nivel 1). */
export interface FilaGantt {
  id: string;
  etiqueta: string;
  detalle?: string;
  nivel: 0 | 1;
  inicio: string;
  /** Fin vigente. */
  fin: string;
  /** Fin programado original, si se reprogramó. */
  finOriginal?: string | null;
  clave: ClaveSituacion;
  /** Fin de la post venta; dibuja una banda desde `fin`. */
  postVentaHasta?: string | null;
  /** La obra sigue abierta y su fin vigente ya pasó. */
  vencida?: boolean;
  /** Semanas enteras en pausa por reprogramación. */
  pausas?: { desde: string; hasta: string }[];
  /** Domingo de la última semana cerrada. */
  corte?: string | null;
  /** Etiqueta corta a la derecha (p. ej. «45% · Retrasada»). */
  nota?: string;
  expandible?: boolean;
  expandida?: boolean;
}

/** Diagrama de barras con línea base, corte, hoy, fin original, pausas y post venta (RF-OP-29, 41). */
@Component({
  selector: 'app-ops-gantt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../operaciones.css',
  templateUrl: './gantt.html',
})
export class GanttComponent {
  readonly filas = input<readonly FilaGantt[]>([]);
  readonly hoy = input('');

  /** Clic en el nombre de una fila. */
  readonly seleccion = output<string>();
  /** Clic en el triángulo de una fila expandible. */
  readonly alternar = output<string>();

  protected readonly fecha = fechaCorta;
  protected readonly escala = computed(() => {
    const fechas: string[] = [];
    for (const f of this.filas()) {
      fechas.push(f.inicio, f.fin);
      if (f.finOriginal) fechas.push(f.finOriginal);
      if (f.postVentaHasta) fechas.push(f.postVentaHasta);
    }
    if (this.hoy()) fechas.push(this.hoy());
    return escalaDe(fechas);
  });
  protected readonly meses = computed(() => marcasDeMes(this.escala()));
  protected readonly posHoy = computed(() => (this.hoy() ? this.escala().pos(this.hoy()) : null));
}
