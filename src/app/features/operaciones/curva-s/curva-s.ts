import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurvaSControlComponent } from '../../centros-costos/obra-cockpit/components/control-tab/curva-s-control/curva-s-control';
import { SituacionChipComponent } from '../../centros-costos/obra-cockpit/components/control-tab/situacion-chip/situacion-chip';
import { pctMostrado, textoDesviacion } from '../../centros-costos/obra-cockpit/obra-control.calc';
import { valorDeEvento } from '@shared/utils/eventos';
import { estadoDe } from '../operaciones.calc';
import { ObraResumen } from '../operaciones.interface';
import { OperacionesStore } from '../operaciones.store';
import { BarraAvanceComponent } from '../ui/barra-avance/barra-avance';
import { CurvaMiniComponent } from '../ui/curva-mini/curva-mini';

/** Curva S por obra con KPI y una tabla de todas las obras en ejecución con su mini curva (RF-OP-40, RC-22). */
@Component({
  selector: 'app-curva-s',
  standalone: true,
  imports: [CurvaSControlComponent, SituacionChipComponent, BarraAvanceComponent, CurvaMiniComponent],
  templateUrl: './curva-s.html',
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurvaSComponent {
  protected readonly store = inject(OperacionesStore);
  protected readonly valorDe = valorDeEvento;
  protected readonly pct = pctMostrado;
  protected readonly desviacion = textoDesviacion;

  constructor() {
    this.store.pedirArboles();
  }

  protected readonly enEjecucion = computed(() => this.store.obras().filter((o) => estadoDe(o) === 'EN_EJECUCION'));
  /** Obras que pueden mostrar curva (EN_EJECUCION y POST_VENTA tienen árbol). */
  protected readonly conCurva = computed(() => this.store.obras().filter((o) => (estadoDe(o) === 'EN_EJECUCION' || estadoDe(o) === 'POST_VENTA') && o.curva));

  readonly #elegida = signal<number | null>(null);
  /** La obra elegida o, si no hay (o ya no pasa los filtros), la primera con curva. */
  protected readonly obra = computed<ObraResumen | null>(() => {
    const lista = this.conCurva();
    return lista.find((o) => o.id_centro_costo === this.#elegida()) ?? lista[0] ?? null;
  });
  protected readonly curva = computed(() => {
    const o = this.obra();
    return o ? (this.store.arboles().get(o.id_centro_costo)?.curvaS ?? null) : null;
  });
  protected readonly kpi = computed(() => {
    const c = this.curva();
    if (!c || c.semanaCorte === 0) return null;
    const p = c.semanas[c.semanaCorte - 1];
    const real = p.real ?? 0;
    return { pactado: p.pactado, real, desviacion: real - p.pactado, restantes: c.semanas.length - c.semanaCorte, corte: c.semanaCorte };
  });

  protected elegir(v: string): void {
    this.#elegida.set(Number(v) || null);
  }
}
