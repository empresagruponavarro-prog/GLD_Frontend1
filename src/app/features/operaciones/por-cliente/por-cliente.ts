import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SituacionChipComponent } from '../../centros-costos/obra-cockpit/components/control-tab/situacion-chip/situacion-chip';
import { fechaCorta } from '../../centros-costos/obra-cockpit/obra-control.calc';
import { ordenarObras, porCliente } from '../operaciones.calc';
import { OperacionesStore } from '../operaciones.store';
import { EstadoChipComponent } from '../ui/estado-chip/estado-chip';

/** Por cliente: una tarjeta por cliente y el listado de todas sus obras; un clic filtra todo (RF-OP-36). */
@Component({
  selector: 'app-por-cliente',
  standalone: true,
  imports: [SituacionChipComponent, EstadoChipComponent],
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ops-grid">
      <section class="ops-grid ops-grid--3" aria-label="Clientes">
        @for (c of clientes(); track c.cliente.id) {
          <div class="ops-card" data-testid="tarjeta-cliente">
            <button type="button" class="ops-tabla__link" (click)="store.actualizar({ cliente: c.cliente.id })">{{ c.cliente.nombre }}</button>
            <p class="ops-tabla__sub">{{ c.total }} obra(s)</p>
            <p style="font-size: 0.75rem; margin: 0.25rem 0 0">
              <strong>{{ c.ejecucion }}</strong> ejecución · <strong>{{ c.proximos }}</strong> próximos · <strong>{{ c.postVenta }}</strong> post venta ·
              <strong>{{ c.culminadas }}</strong> culminadas
            </p>
          </div>
        } @empty {
          <p class="ops-vacio">No hay clientes con obras para estos filtros.</p>
        }
      </section>

      <section class="ops-card" aria-label="Listado de obras">
        <h2 class="ops-card__titulo">Todas las obras</h2>
        <div class="ops-tabla-wrap">
          <table class="ops-tabla" data-testid="listado-obras">
            <thead>
              <tr><th>Cliente</th><th>Obra</th><th>Estado</th><th>Inicio</th><th>Fin vigente</th><th>Situación</th></tr>
            </thead>
            <tbody>
              @for (o of obras(); track o.id_centro_costo) {
                <tr>
                  <td>{{ o.cliente?.nombre ?? '—' }}</td>
                  <td>
                    <button type="button" class="ops-tabla__link" (click)="store.enfocarObra(o)">{{ o.tienda ?? o.nombre }}</button>
                    <span class="ops-tabla__sub">{{ o.codigo_obra }}</span>
                  </td>
                  <td><app-ops-estado-chip [estado]="o.resultado.estadoEfectivo" /></td>
                  <td>{{ fecha(o.inicio) }}</td>
                  <td>{{ fecha(o.resultado.plazos.finVigente) }}</td>
                  <td><app-situacion-chip [situacion]="o.resultado.situacion" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class PorClienteComponent {
  protected readonly store = inject(OperacionesStore);
  protected readonly fecha = fechaCorta;
  protected readonly clientes = computed(() => porCliente(this.store.obras()));
  protected readonly obras = computed(() => ordenarObras(this.store.obras().filter((o) => o.estado_obra !== 'CANCELADA')));
}
