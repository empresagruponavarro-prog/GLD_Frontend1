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
        <p class="imp-nota">Derivado del presupuesto Meta {{ d.id_presupuesto }}. Cada ítem con proveedor elegido toma su precio sin IGV; los ítems sin proveedor conservan el monto del Meta.</p>
        <table class="imp-table">
          <thead><tr><th>Fase</th><th>Origen</th><th>Requerimiento / proveedor</th><th class="num">Meta</th><th class="num">Comercial</th></tr></thead>
          <tbody>
            @for (f of d.fases; track f.id_fase) {
              <tr>
                <td>{{ f.nombre_fase }}</td>
                <td>{{ origen(f.fuente) }}{{ f.items_adjudicados > 0 ? ' (' + f.items_adjudicados + ' de ' + f.items.length + ' ítems)' : '' }}{{ f.sin_tipo_cambio ? ' · falta tipo de cambio' : '' }}</td>
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
        @if (hayDetalle()) {
          <h2 class="imp-sub">Detalle por ítem con proveedor elegido</h2>
          <table class="imp-table">
            <thead><tr><th>Fase</th><th>Ítem</th><th>Proveedor</th><th class="num">Meta</th><th class="num">Comercial</th><th class="num">Diferencia</th><th class="num">%</th></tr></thead>
            <tbody>
              @for (f of d.fases; track f.id_fase) {
                @for (i of f.items; track i.id_item) {
                  @if (i.adjudicado) {
                    <tr>
                      <td>{{ f.nombre_fase }}</td><td>{{ i.codigo }} {{ i.descripcion }}</td><td>{{ i.proveedor ?? '—' }}</td>
                      <td class="num">{{ fmt(i.meta) }}</td><td class="num">{{ fmt(i.comercial) }}</td>
                      <td class="num">{{ fmt(i.diferencia) }}</td><td class="num">{{ i.diferencia_pct === null ? '—' : i.diferencia_pct + ' %' }}</td>
                    </tr>
                  }
                }
              }
            </tbody>
          </table>
        }
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
  protected readonly hayDetalle = computed(() => (this.c()?.fases ?? []).some((f) => f.items.some((i) => i.adjudicado)));

  protected origen(fuente: string): string {
    switch (fuente) {
      case 'ADJUDICACION': return 'Proveedores elegidos';
      case 'MIXTA': return 'Parte con proveedor, el resto Meta';
      case 'COTIZACION': return 'Cotización ganadora';
      default: return 'Meta (sin proveedor)';
    }
  }
}
