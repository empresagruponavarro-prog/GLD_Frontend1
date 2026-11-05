import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage, fmtMoney } from '../../almacen/almacen.utils';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';
import { PresupuestoComercial } from '../../presupuestos/interfaces/presupuestos.interface';

/**
 * Formato del **presupuesto Comercial** (GRP T68, SP-16): cada fase del Meta con el monto de la cotización ganadora de su FUR
 * (sin IGV); sin ganadora iguala al Meta. Lo usa la ruta `/imprimir/presupuesto-comercial/:id` y el dosier.
 */
@Component({
  selector: 'app-formato-presupuesto-comercial',
  standalone: true,
  styleUrl: './formato.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recurso.error()) {
      <p class="imp-error" role="alert">{{ error() }}</p>
    } @else if (recurso.isLoading() || !c()) {
      <p>Cargando presupuesto comercial…</p>
    } @else {
      @let d = c()!;
      <section class="imp-seccion" data-testid="formato-presupuesto-comercial">
        <h2 class="imp-sub">Presupuesto Comercial · {{ d.proyecto ?? d.id_presupuesto }}</h2>
        <p class="imp-nota">Derivado del presupuesto Meta {{ d.id_presupuesto }}. Cada fase toma el monto sin IGV de la cotización ganadora de su requerimiento; las fases sin ganadora conservan el monto del Meta.</p>
        <table class="imp-table">
          <thead><tr><th>Fase</th><th>Origen</th><th>Requerimiento / proveedor</th><th class="num">Meta</th><th class="num">Comercial</th></tr></thead>
          <tbody>
            @for (f of d.fases; track f.id_fase) {
              <tr>
                <td>{{ f.nombre_fase }}</td>
                <td>{{ f.fuente === 'COTIZACION' ? 'Cotización ganadora' : 'Meta (sin cotización)' }}{{ f.sin_tipo_cambio ? ' · falta tipo de cambio' : '' }}</td>
                <td>
                  @for (r of f.requerimientos; track r.id) { <div>{{ r.numero }} · {{ r.proveedor ?? '—' }}</div> } @empty { — }
                </td>
                <td class="num">{{ fmt(f.meta) }}</td>
                <td class="num">{{ fmt(f.comercial) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5">El presupuesto no tiene fases.</td></tr>
            }
          </tbody>
        </table>
        <table class="imp-resumen">
          <tr><th>Total Meta</th><td>{{ fmt(d.total.meta) }}</td></tr>
          <tr class="imp-total"><th>Total Comercial</th><td>{{ fmt(d.total.comercial) }}</td></tr>
          <tr><th>Diferencia (Comercial − Meta)</th><td>{{ fmt(d.total.diferencia) }}</td></tr>
          <tr><th>Fases con cotización</th><td>{{ d.fases_cotizadas }} de {{ d.fases.length }}</td></tr>
        </table>
      </section>
    }
  `,
})
export class FormatoPresupuestoComercialComponent {
  readonly #presupuestos = inject(PresupuestosService);

  readonly presupuesto = input.required<string | number>();

  protected readonly recurso = rxResource<PresupuestoComercial, string | number>({
    params: () => this.presupuesto(),
    stream: ({ params }) => this.#presupuestos.getComercial(params),
  });

  protected readonly c = computed(() => (this.recurso.hasValue() ? this.recurso.value() : undefined));
  protected readonly error = computed(() => errorMessage(this.recurso.error()));
  protected readonly fmt = (v: number) => fmtMoney(v);
}
