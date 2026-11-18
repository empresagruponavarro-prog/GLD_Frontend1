import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { fmtMoney } from '../../almacen/almacen.utils';
import { CotizacionesPptoService } from '../cotizaciones-ppto/cotizaciones-ppto.service';
import { mensajeDeError } from '../presupuestos.orchestration';

/** Cuántos ítems sin proveedor se listan antes de resumir el resto («y N más»). */
const MAX_PENDIENTES = 8;

/**
 * Compromisos de un presupuesto (plan 09): los FUR y las órdenes de compra y de servicio que se generan al grabar las cotizaciones y elegir
 * a los ganadores. Las órdenes son **provisionales** hasta que se aprueba el presupuesto: se ven y se imprimen, pero no se programan,
 * pagan ni reciben. Al aprobar pasan a registradas y entran a programación y pago.
 */
@Component({
  selector: 'app-compromisos-panel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './compromisos-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompromisosPanelComponent {
  readonly #service = inject(CotizacionesPptoService);

  /** `ppto_Principal.id` del presupuesto guardado. */
  readonly idPresupuesto = input.required<number>();
  /** Se incrementa para volver a leer (después de cotizar, adjudicar o aprobar). */
  readonly refresco = input(0);

  protected readonly fmtMoney = fmtMoney;

  protected readonly res = rxResource({
    params: () => ({ id: this.idPresupuesto(), n: this.refresco() }),
    stream: ({ params }) => this.#service.getCompromisos(params.id),
  });

  protected readonly datos = computed(() => (this.res.hasValue() ? this.res.value() : null));
  protected readonly errorCarga = computed(() => (this.res.error() ? mensajeDeError(this.res.error()) : ''));
  protected readonly pendientesVisibles = computed(() => (this.datos()?.items_sin_adjudicar ?? []).slice(0, MAX_PENDIENTES));
  protected readonly pendientesOcultos = computed(() => Math.max(0, (this.datos()?.items_sin_adjudicar.length ?? 0) - MAX_PENDIENTES));
  /** Avance de la adjudicación, en %, para la barra. */
  protected readonly avance = computed(() => {
    const d = this.datos();
    return d && d.items_total > 0 ? Math.round((d.items_adjudicados / d.items_total) * 100) : 0;
  });
  protected readonly hayProvisionales = computed(() => (this.datos()?.compromisos ?? []).some((c) => c.estado === 'PROVISIONAL'));

  protected etiqueta(estado: string): string {
    return estado === 'PROVISIONAL' ? 'Provisional' : estado === 'REGISTRADO' ? 'Registrada' : estado === 'ANULADO' ? 'Anulada' : estado;
  }

  protected clase(estado: string): string {
    if (estado === 'REGISTRADO') return 'text-emerald-800 bg-emerald-50 border-emerald-200';
    if (estado === 'PROVISIONAL') return 'text-amber-800 bg-amber-50 border-amber-200';
    return 'text-slate-500 bg-slate-50 border-slate-200 line-through';
  }

  protected tipo(clase: string): string {
    return clase === 'ORDEN_SERVICIO' ? 'OS' : 'OC';
  }

  protected recargar(): void {
    this.res.reload();
  }
}
