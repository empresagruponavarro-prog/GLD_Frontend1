import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage, fmtMoney, fmtNum } from '../../almacen/almacen.utils';
import { AdministracionDocumentosService } from '../../documentos/administracion/administracion.service';

/**
 * Valorización de una orden de servicio de un presupuesto (plan 09): lo ejecutado según el avance de obra por línea, el adelanto, lo que
 * ya se liberó y lo que falta. Acompaña a cada pago parcial. Ruta `/imprimir/valorizacion/:id` (id de la orden).
 */
@Component({
  selector: 'app-formato-valorizacion',
  standalone: true,
  styleUrl: './formato.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recurso.error()) {
      <p class="imp-error" role="alert">{{ error() }}</p>
    } @else if (recurso.isLoading() || !v()) {
      <p>Cargando valorización…</p>
    } @else {
      @let d = v()!;
      @let m = d.moneda_simbolo ?? 'S/';
      <section class="imp-seccion" data-testid="formato-valorizacion">
        <p class="imp-numero">{{ d.numero_documento ?? '#' + d.id }}</p>
        <table class="imp-grid">
          <tr><th>Proveedor</th><td>{{ d.proveedor ?? '—' }}</td><th>Obra</th><td>{{ d.centro_costo ?? '—' }}</td></tr>
          <tr><th>Total de la orden</th><td>{{ m }} {{ fmtMoney(d.total) }}</td><th>Neto a pagar</th><td>{{ m }} {{ fmtMoney(d.neto_proveedor) }}</td></tr>
        </table>
        <table class="imp-table">
          <thead><tr><th>Servicio</th><th>Subfase</th><th class="num">Monto</th><th class="num">Avance</th><th class="num">Valorizado</th></tr></thead>
          <tbody>
            @for (l of d.lineas; track l.id) {
              <tr>
                <td>{{ l.descripcion ?? '—' }}</td><td>{{ l.subfase ?? '—' }}</td>
                <td class="num">{{ fmtMoney(l.monto) }}</td>
                <td class="num">{{ l.avance_pct === null ? 'sin avance' : fmtNum(l.avance_pct) + ' %' }}</td>
                <td class="num">{{ fmtMoney(l.monto_valorizado) }}</td>
              </tr>
            }
          </tbody>
        </table>
        <table class="imp-resumen">
          <tr><th>Adelanto pactado</th><td>{{ fmtNum(d.adelanto_porcentaje) }} %</td></tr>
          <tr><th>Avance ponderado de la obra</th><td>{{ fmtNum(d.avance_pct) }} %</td></tr>
          <tr><th>Porcentaje liberado (mayor de ambos)</th><td>{{ fmtNum(d.pct_aplicado) }} %</td></tr>
          <tr class="imp-total"><th>Liberado hasta hoy</th><td>{{ m }} {{ fmtMoney(d.liberado) }}</td></tr>
          <tr><th>Pagado</th><td>{{ m }} {{ fmtMoney(d.pagado) }}</td></tr>
          <tr><th>Programado</th><td>{{ m }} {{ fmtMoney(d.programado) }}</td></tr>
          <tr class="imp-total"><th>Disponible para pago</th><td>{{ m }} {{ fmtMoney(d.disponible) }}</td></tr>
        </table>
        <p class="imp-nota">El avance es el que informa Operaciones en el Control de Avance de la obra; se actualiza solo.</p>
        <div class="imp-firmas"><div>Residente de obra</div><div>Operaciones</div><div>Administración</div></div>
      </section>
    }
  `,
})
export class FormatoValorizacionComponent {
  readonly #documentos = inject(AdministracionDocumentosService);

  readonly idDocumento = input.required<number>();

  protected readonly recurso = rxResource({
    params: () => this.idDocumento(),
    stream: ({ params }) => this.#documentos.getValorizacion(params),
  });

  protected readonly v = computed(() => (this.recurso.hasValue() ? this.recurso.value() : undefined));
  protected readonly error = computed(() => errorMessage(this.recurso.error()));
  protected readonly fmtMoney = fmtMoney;
  protected readonly fmtNum = fmtNum;
}
