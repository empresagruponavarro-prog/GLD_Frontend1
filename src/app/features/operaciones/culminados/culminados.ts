import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { fechaCorta } from '../../centros-costos/obra-cockpit/obra-control.calc';
import { culminadas, distribuir } from '../operaciones.calc';
import { OperacionesStore } from '../operaciones.store';
import { DonaComponent } from '../ui/dona/dona';

/** Culminados: % entregadas a tiempo, por cliente y desfase de cada una (RF-OP-38, RC-19). */
@Component({
  selector: 'app-culminados',
  standalone: true,
  imports: [DonaComponent],
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ops-grid">
      <section class="ops-grid ops-grid--2">
        <div class="ops-kpi" data-testid="kpi-a-tiempo">
          <span class="ops-kpi__valor">{{ resumen().pctATiempo === null ? '—' : resumen().pctATiempo + '%' }}</span>
          <span class="ops-kpi__etiqueta">Entregadas a tiempo</span>
          <span class="ops-kpi__detalle">{{ resumen().filas.length }} culminada(s)</span>
        </div>
        <div class="ops-card">
          <h2 class="ops-card__titulo">Por cliente</h2>
          <app-ops-dona [porciones]="porCliente()" titulo="Obras culminadas por cliente" [clicable]="true" (seleccion)="store.actualizar({ cliente: +$event })" />
        </div>
      </section>

      <section class="ops-card" aria-label="Obras culminadas">
        @if (resumen().filas.length === 0) {
          <p class="ops-vacio" data-testid="sin-culminadas">No hay obras culminadas con estos filtros.</p>
        } @else {
          <div class="ops-tabla-wrap">
            <table class="ops-tabla" data-testid="tabla-culminadas">
              <thead>
                <tr><th>Obra</th><th>Cliente</th><th>Inicio</th><th>Fin vigente</th><th>Entrega</th><th class="ops-tabla__num">Desfase</th><th class="ops-tabla__num">Días post venta</th></tr>
              </thead>
              <tbody>
                @for (f of resumen().filas; track f.obra.id_centro_costo) {
                  <tr>
                    <td>{{ f.obra.nombre }}<span class="ops-tabla__sub">{{ f.obra.codigo_obra }}</span></td>
                    <td>{{ f.obra.cliente?.nombre ?? '—' }}</td>
                    <td>{{ fecha(f.obra.inicio) }}</td>
                    <td>{{ fecha(f.obra.resultado.plazos.finVigente) }}</td>
                    <td>{{ fecha(f.obra.resultado.postVenta?.inicio) }}</td>
                    <td class="ops-tabla__num">
                      @if (f.desfase === null) {
                        —
                      } @else {
                        <span [style.color]="f.aTiempo ? 'var(--ops-good)' : 'var(--ops-crit)'">{{ f.desfase > 0 ? '+' : '' }}{{ f.desfase }} d</span>
                      }
                    </td>
                    <td class="ops-tabla__num">{{ f.obra.resultado.postVenta?.dias ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
})
export class CulminadosComponent {
  protected readonly store = inject(OperacionesStore);
  protected readonly fecha = fechaCorta;
  protected readonly resumen = computed(() => culminadas(this.store.obras()));
  protected readonly porCliente = computed(() =>
    distribuir(
      this.resumen().filas.map((f) => f.obra),
      (o) => (o.cliente ? { id: String(o.cliente.id), etiqueta: o.cliente.nombre } : null),
    ),
  );
}
