import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { clampPct, ordenarSemanas } from '../../../obra.calc';
import { ObraSemana } from '../../../obra.interface';

export interface ChartPoint {
  semana: ObraSemana;
  x: number;
  yMeta: number;
  yReal: number;
  tieneReal: boolean;
  desviacion: number;
}

@Component({
  selector: 'app-curva-s-chart',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './curva-s-chart.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurvaSChartComponent {
  readonly semanas = input<readonly ObraSemana[]>([]);
  readonly semanaActiva = input<number | undefined>(undefined);
  /** Clic en un punto abre el avance de la semana (exige `editar` en `obra`); false = solo consulta. */
  readonly seleccionable = input(false);

  readonly seleccionarSemana = output<ObraSemana>();

  protected readonly hoveredPoint = signal<ChartPoint | null>(null);

  // Dimensiones del viewBox del SVG
  protected readonly width = 860;
  protected readonly height = 280;
  protected readonly padLeft = 45;
  protected readonly padRight = 35;
  protected readonly padTop = 30;
  protected readonly padBottom = 45;

  protected readonly chartWidth = computed(() => this.width - this.padLeft - this.padRight);
  protected readonly chartHeight = computed(() => this.height - this.padTop - this.padBottom);
  protected readonly yBase = computed(() => this.height - this.padBottom);

  protected readonly semanasOrdenadas = computed(() => ordenarSemanas(this.semanas()));

  // Puntos calculados para cada semana
  protected readonly points = computed<ChartPoint[]>(() => {
    const sems = this.semanasOrdenadas();
    if (sems.length === 0) return [];

    const w = this.chartWidth();
    const h = this.chartHeight();
    const top = this.padTop;
    const left = this.padLeft;
    const n = sems.length;

    // Determinar hasta qué semana hay avance real reportado
    return sems.map((s, idx) => {
      const x = n === 1 ? left + w / 2 : left + (idx / (n - 1)) * w;
      const metaClamped = clampPct(s.porcentaje_meta);
      const realClamped = clampPct(s.porcentaje_real);

      // Y: 0% en yBase, 100% en padTop
      const yMeta = top + h * (1 - metaClamped / 100);
      const yReal = top + h * (1 - realClamped / 100);

      const tieneReal = s.porcentaje_real > 0 || s.estado === 'Completado' || s.estado === 'En Plazo' || (this.semanaActiva() !== undefined && s.numero_semana <= this.semanaActiva()!);

      return {
        semana: s,
        x,
        yMeta,
        yReal,
        tieneReal,
        desviacion: s.porcentaje_real - s.porcentaje_meta,
      };
    });
  });

  // Path SVG para la curva meta (programada)
  protected readonly pathMeta = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yMeta.toFixed(1)}`, '');
  });

  // Puntos con avance real para la curva ejecutada
  protected readonly pointsReal = computed(() => {
    return this.points().filter((p) => p.tieneReal);
  });

  // Path SVG para la curva real (ejecutada)
  protected readonly pathReal = computed(() => {
    const pts = this.pointsReal();
    if (pts.length === 0) return '';
    return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yReal.toFixed(1)}`, '');
  });

  // Path SVG para el área sombreada bajo la curva real
  protected readonly pathAreaReal = computed(() => {
    const pts = this.pointsReal();
    if (pts.length === 0) return '';
    const line = this.pathReal();
    const lastX = pts[pts.length - 1].x;
    const firstX = pts[0].x;
    const base = this.yBase();
    return `${line} L ${lastX.toFixed(1)} ${base} L ${firstX.toFixed(1)} ${base} Z`;
  });

  // Línea de corte de la semana actual
  protected readonly xSemanaActiva = computed<number | null>(() => {
    const activa = this.semanaActiva();
    if (!activa) return null;
    const pt = this.points().find((p) => p.semana.numero_semana === activa);
    return pt ? pt.x : null;
  });

  // Ejes Y con líneas guía horizontales al 0%, 25%, 50%, 75%, 100%
  protected readonly gridLinesY = computed(() => {
    const h = this.chartHeight();
    const top = this.padTop;
    const levels = [0, 25, 50, 75, 100];
    return levels.map((lvl) => ({
      level: lvl,
      y: top + h * (1 - lvl / 100),
    }));
  });

  protected onPointHover(pt: ChartPoint): void {
    this.hoveredPoint.set(pt);
  }

  protected onPointLeave(): void {
    this.hoveredPoint.set(null);
  }

  protected onPointClick(pt: ChartPoint): void {
    if (!this.seleccionable()) return;
    this.seleccionarSemana.emit(pt.semana);
  }
}
