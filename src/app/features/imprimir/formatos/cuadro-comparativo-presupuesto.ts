import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage, fmtMoney, fmtNum } from '../../almacen/almacen.utils';
import { CotizacionesPptoService } from '../../presupuestos/cotizaciones-ppto/cotizaciones-ppto.service';
import { CuadroLineaPpto, CuadroOfertaPpto, CuadroProveedorPpto } from '../../presupuestos/cotizaciones-ppto/cotizaciones-ppto.models';

/**
 * Cuadro comparativo de las cotizaciones de una fase de un presupuesto (plan 09): ítem × proveedor, con el ganador de cada ítem marcado y
 * las condiciones de cada cotización. Lo usa la ruta `/imprimir/cuadro-comparativo-presupuesto/:id?fase=`.
 */
@Component({
  selector: 'app-formato-cuadro-comparativo-presupuesto',
  standalone: true,
  styleUrl: './formato.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recurso.error()) {
      <p class="imp-error" role="alert">{{ error() }}</p>
    } @else if (recurso.isLoading() || !c()) {
      <p>Cargando cuadro comparativo…</p>
    } @else {
      @let d = c()!;
      <section class="imp-seccion" data-testid="formato-cuadro-presupuesto">
        <p class="imp-numero">{{ d.codigo_presupuesto }} · {{ d.fase }}</p>
        <p class="imp-nota">
          Presupuesto {{ d.estado }}. {{ d.items_adjudicados }} de {{ d.items_total }} ítem(s) con proveedor elegido.
          Las cotizaciones de un presupuesto sin aprobar son referenciales.
        </p>
        @if (d.proveedores.length === 0) {
          <p class="imp-nota">Esta fase no tiene cotizaciones registradas.</p>
        } @else {
          <table class="imp-table imp-table--cuadro">
            <thead>
              <tr>
                <th>Ítem</th><th class="num">Cant.</th><th class="num">Meta</th>
                @for (p of d.proveedores; track p.id_cotizacion) {
                  <th class="num">{{ p.proveedor ?? '—' }}<br /><small>{{ p.numero }}</small></th>
                }
                <th>Elegido</th>
              </tr>
            </thead>
            <tbody>
              @for (l of d.lineas; track l.id_ppto_item) {
                <tr>
                  <td>{{ l.codigo }} {{ l.descripcion }}<br /><small>{{ l.subfase }}</small></td>
                  <td class="num">{{ fmtNum(l.cantidad) }} {{ l.unidad }}</td>
                  <td class="num">{{ fmtMoney(l.costo_unitario_meta) }}</td>
                  @for (p of d.proveedores; track p.id_cotizacion) {
                    @let o = oferta(l, p.id_cotizacion);
                    <td class="num" [class.imp-ganadora]="l.id_cotizacion_ganadora === p.id_cotizacion">
                      @if (o && o.cotiza) {
                        {{ fmtMoney(o.precio_sin_igv) }}
                        @if (!o.cantidad_completa) { <br /><small>solo {{ fmtNum(o.cantidad) }}</small> }
                      } @else { No cotiza }
                    </td>
                  }
                  <td>{{ nombreGanador(l) }}</td>
                </tr>
              }
              <tr class="imp-total">
                <td colspan="3">Total sin IGV</td>
                @for (p of d.proveedores; track p.id_cotizacion) { <td class="num">{{ p.moneda_simbolo ?? p.moneda_id }} {{ fmtMoney(p.total_sin_igv) }}</td> }
                <td></td>
              </tr>
              <tr class="imp-total">
                <td colspan="3">Total a pagar</td>
                @for (p of d.proveedores; track p.id_cotizacion) { <td class="num">{{ p.moneda_simbolo ?? p.moneda_id }} {{ fmtMoney(p.total) }}{{ p.afecto_igv ? '' : ' (no afecto)' }}</td> }
                <td></td>
              </tr>
              <tr><td colspan="3">Forma de pago</td>@for (p of d.proveedores; track p.id_cotizacion) { <td class="num">{{ p.forma_pago }}{{ p.dias_credito ? ' (' + p.dias_credito + ' d)' : '' }}{{ adelanto(p) }}</td> }<td></td></tr>
              <tr><td colspan="3">Disponibilidad</td>@for (p of d.proveedores; track p.id_cotizacion) { <td class="num">{{ p.plazo_entrega_dias === null ? '—' : p.plazo_entrega_dias === 0 ? 'Inmediata' : p.plazo_entrega_dias + ' días' }}</td> }<td></td></tr>
              <tr><td colspan="3">Validez · Garantía</td>@for (p of d.proveedores; track p.id_cotizacion) { <td class="num">{{ p.validez_dias === null ? '—' : p.validez_dias + ' d' }} · {{ p.garantia ?? '—' }}</td> }<td></td></tr>
              <tr><td colspan="3">Condiciones</td>@for (p of d.proveedores; track p.id_cotizacion) { <td class="num">{{ p.condiciones ?? '—' }}</td> }<td></td></tr>
            </tbody>
          </table>
          @for (m of motivos(); track m) {
            <p class="imp-nota"><strong>Motivo de la elección:</strong> {{ m }}</p>
          }
        }
        <div class="imp-firmas"><div>Logística</div><div>Administración</div><div>Gerencia</div></div>
      </section>
    }
  `,
})
export class FormatoCuadroComparativoPresupuestoComponent {
  readonly #cotizaciones = inject(CotizacionesPptoService);

  readonly idPresupuesto = input.required<number>();
  readonly idFase = input.required<number>();

  protected readonly recurso = rxResource({
    params: () => ({ ppto: this.idPresupuesto(), fase: this.idFase() }),
    stream: ({ params }) => this.#cotizaciones.getCuadro(params.ppto, params.fase),
  });

  protected readonly c = computed(() => (this.recurso.hasValue() ? this.recurso.value() : undefined));
  protected readonly error = computed(() => errorMessage(this.recurso.error()));
  /** Motivos de elección distintos, en el orden en que aparecen. */
  protected readonly motivos = computed(() => [...new Set((this.c()?.lineas ?? []).map((l) => l.comentario_adjudicacion).filter((m): m is string => !!m))]);

  protected readonly fmtMoney = fmtMoney;
  protected readonly fmtNum = fmtNum;

  protected oferta(l: CuadroLineaPpto, idCotizacion: number): CuadroOfertaPpto | undefined {
    return l.ofertas.find((o) => o.id_cotizacion === idCotizacion);
  }

  protected nombreGanador(l: CuadroLineaPpto): string {
    const p = this.c()?.proveedores.find((x) => x.id_cotizacion === l.id_cotizacion_ganadora);
    return p?.proveedor ?? '—';
  }

  protected adelanto(p: CuadroProveedorPpto): string {
    return p.adelanto_porcentaje && Number(p.adelanto_porcentaje) > 0 ? ` · adel. ${fmtNum(p.adelanto_porcentaje)} %` : '';
  }
}
