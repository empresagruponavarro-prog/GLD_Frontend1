import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { estadoDe, ordenarObras } from '../operaciones.calc';
import { OperacionesStore } from '../operaciones.store';
import { GanttComponent } from '../ui/gantt/gantt';
import { filasConPartidas } from '../ui/gantt/filas';

/** Cronograma (Gantt) de obras en ejecución y post venta, con partidas desplegables (RF-OP-41, RC-13). */
@Component({
  selector: 'app-cronograma',
  standalone: true,
  imports: [GanttComponent],
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ops-card" aria-label="Cronograma">
      <h2 class="ops-card__titulo">Cronograma de obras en ejecución y post venta</h2>
      @if (store.cargandoArboles() && store.arboles().size === 0) {
        <p class="ops-vacio">Cargando cronograma…</p>
      }
      <app-ops-gantt [filas]="filas()" [hoy]="store.hoy()" (alternar)="alternar($event)" (seleccion)="alternar($event)" />
    </section>
  `,
})
export class CronogramaComponent {
  protected readonly store = inject(OperacionesStore);
  protected readonly expandidas = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.store.pedirArboles();
  }

  protected readonly obras = computed(() => ordenarObras(this.store.obras().filter((o) => estadoDe(o) === 'EN_EJECUCION' || estadoDe(o) === 'POST_VENTA')));
  protected readonly filas = computed(() => this.obras().flatMap((o) => filasConPartidas(o, this.store.arboles().get(o.id_centro_costo), this.expandidas(), this.store.hoy())));

  /** Clic en una fila o en su triángulo: despliega o pliega sus partidas. */
  protected alternar(id: string): void {
    this.expandidas.update((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  }
}
