import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ordenarObras, esVigente } from '../operaciones.calc';
import { OperacionesStore } from '../operaciones.store';

/** Equipo por proyecto: quién es quién en cada obra vigente, tomado de la ficha (RF-OP-44). */
@Component({
  selector: 'app-equipo',
  standalone: true,
  imports: [RouterLink],
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ops-card" aria-label="Equipo por proyecto">
      <h2 class="ops-card__titulo">Equipo por proyecto</h2>
      @if (obras().length === 0) {
        <p class="ops-vacio" data-testid="sin-equipos">No hay obras vigentes con estos filtros.</p>
      } @else {
        <div class="ops-tabla-wrap">
          <table class="ops-tabla" data-testid="tabla-equipo">
            <thead>
              <tr><th>Cliente</th><th>Obra</th><th>Jefe de proyecto</th><th>Coordinador</th><th>Residente</th><th>Resp. presupuesto</th><th>Resp. procura</th></tr>
            </thead>
            <tbody>
              @for (o of obras(); track o.id_centro_costo) {
                <tr>
                  <td>{{ o.cliente?.nombre ?? '—' }}</td>
                  <td>
                    <a class="ops-tabla__link" [routerLink]="['/centros-costos', o.id_centro_costo, 'datos']">{{ o.tienda ?? o.nombre }}</a>
                    <span class="ops-tabla__sub">{{ o.codigo_obra }}</span>
                  </td>
                  <td>{{ o.equipo.jefe_proyecto?.nombre ?? '—' }}</td>
                  <td>{{ o.equipo.coordinador?.nombre ?? '—' }}</td>
                  <td>{{ o.equipo.residente?.nombre ?? '—' }}</td>
                  <td>{{ o.equipo.resp_presupuesto?.nombre ?? '—' }}</td>
                  <td>{{ o.equipo.resp_procura?.nombre ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class EquipoComponent {
  protected readonly store = inject(OperacionesStore);
  protected readonly obras = computed(() => ordenarObras(this.store.obras().filter(esVigente)));
}
