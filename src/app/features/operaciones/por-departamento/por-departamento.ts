import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ETIQUETAS_TRAMO, porDepartamento } from '../operaciones.calc';
import { OperacionesStore } from '../operaciones.store';

/**
 * Por departamento: ranking y cuadrícula de calor con la escala 0 · 1 · 2–3 · 4–6 · 7–12 · 13+ (RF-OP-37).
 * El mapa SVG del Perú queda pendiente de confirmar la licencia de la geometría (T02/T65).
 */
@Component({
  selector: 'app-por-departamento',
  standalone: true,
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ops-grid ops-grid--2">
      <section class="ops-card" aria-label="Mapa de calor por departamento">
        <h2 class="ops-card__titulo">Obras vigentes por departamento</h2>
        <div class="ops-grid ops-grid--3" data-testid="calor-departamentos">
          @for (d of departamentos(); track d.departamento) {
            <button type="button" class="ops-depto" [class]="'ops-depto ops-tramo--' + d.tramo" (click)="store.actualizar({ departamento: d.departamento })">
              <span>{{ d.departamento }}</span>
              <strong>{{ d.cantidad }}</strong>
            </button>
          } @empty {
            <p class="ops-vacio">Ninguna obra vigente tiene departamento registrado.</p>
          }
        </div>
        <p class="ops-tabla__sub" style="margin-top: 0.5rem">
          Escala:
          @for (t of tramos; track t) {
            <span class="ops-chip" [class]="'ops-chip ops-tramo--' + $index">{{ t }}</span>
          }
        </p>
      </section>

      <section class="ops-card" aria-label="Ranking">
        <h2 class="ops-card__titulo">Ranking</h2>
        <table class="ops-tabla" data-testid="ranking-departamentos">
          <thead>
            <tr><th>#</th><th>Departamento</th><th class="ops-tabla__num">Obras</th></tr>
          </thead>
          <tbody>
            @for (d of departamentos(); track d.departamento; let i = $index) {
              <tr>
                <td>{{ i + 1 }}</td>
                <td><button type="button" class="ops-tabla__link" (click)="store.actualizar({ departamento: d.departamento })">{{ d.departamento }}</button></td>
                <td class="ops-tabla__num">{{ d.cantidad }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    </div>
  `,
})
export class PorDepartamentoComponent {
  protected readonly store = inject(OperacionesStore);
  protected readonly tramos = ETIQUETAS_TRAMO;
  protected readonly departamentos = computed(() => porDepartamento(this.store.obras()));
}
