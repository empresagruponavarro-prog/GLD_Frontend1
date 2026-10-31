import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SituacionChipComponent } from '../../centros-costos/obra-cockpit/components/control-tab/situacion-chip/situacion-chip';
import { fechaCorta, textoDesviacion } from '../../centros-costos/obra-cockpit/obra-control.calc';
import { valorDeEvento } from '@shared/utils/eventos';
import { estadoDe, iniciadasPorMes, kpisDe, porAnioDeInicio, proximoInicio, requierenAtencion, resumenPostVenta } from '../operaciones.calc';
import { ObraResumen } from '../operaciones.interface';
import { OperacionesStore } from '../operaciones.store';

/** Indicadores: proyectos por año, activos, próximos, post venta, iniciadas por mes y obras que requieren atención (RF-OP-32..35). */
@Component({
  selector: 'app-indicadores',
  standalone: true,
  imports: [SituacionChipComponent],
  templateUrl: './indicadores.html',
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadoresComponent {
  readonly #router = inject(Router);
  protected readonly store = inject(OperacionesStore);
  protected readonly fecha = fechaCorta;
  protected readonly desviacion = textoDesviacion;
  protected readonly valorDe = valorDeEvento;

  /** Año del gráfico por mes; `null` = el año de hoy. */
  protected readonly anioElegido = signal<number | null>(null);
  protected readonly anio = computed(() => this.anioElegido() ?? (Number(this.store.hoy().slice(0, 4)) || new Date().getFullYear()));

  protected readonly kpis = computed(() => kpisDe(this.store.obras()));
  protected readonly porAnio = computed(() => porAnioDeInicio(this.store.obras()));
  protected readonly enEjecucion = computed(() => this.store.obras().filter((o) => estadoDe(o) === 'EN_EJECUCION'));
  protected readonly conRetraso = computed(() => this.enEjecucion().filter((o) => o.resultado.situacion.clave === 'crit').length);
  protected readonly siguiente = computed(() => proximoInicio(this.store.obras()));
  protected readonly postVenta = computed(() => resumenPostVenta(this.store.obras()));
  protected readonly enPostVenta = computed(() => this.store.obras().filter((o) => estadoDe(o) === 'POST_VENTA'));
  protected readonly meses = computed(() => iniciadasPorMes(this.store.obras(), this.anio(), this.store.hoy()));
  protected readonly maxMes = computed(() => Math.max(1, ...this.meses().map((m) => m.cantidad)));
  protected readonly atencion = computed(() => requierenAtencion(this.store.obras()));
  /** Años con obras, para el selector del gráfico. */
  protected readonly anios = computed(() => this.store.catalogos().anios);

  protected elegirAnio(v: string): void {
    this.anioElegido.set(Number(v) || null);
  }

  /** «Ver en Partidas»: deja solo esa obra y abre la vista de partidas (RF-OP-34, 47). */
  protected verEnPartidas(o: ObraResumen): void {
    this.store.enfocarObra(o);
    void this.#router.navigate(['/operaciones/partidas']);
  }
}
