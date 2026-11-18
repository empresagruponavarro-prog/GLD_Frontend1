import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { fmtMoney } from '../../almacen/almacen.utils';
import { FaseComercial, PresupuestosService } from '../presupuestos.service';
import { mensajeDeError } from '../presupuestos.orchestration';

const FUENTE: Record<FaseComercial['fuente'], string> = {
  ADJUDICACION: 'Todos los ítems con proveedor',
  MIXTA: 'Parte con proveedor, el resto al Meta',
  COTIZACION: 'Cotización ganadora del FUR',
  META: 'Igual al Meta',
};

/**
 * Presupuesto Comercial por fase (plan 09, respuesta 3): el Meta conserva el costo de la plantilla y el Comercial sale de los proveedores
 * elegidos; la diferencia se ve por fase y por ítem. Se calcula en el servidor (`GET :id/comercial`): aquí solo se muestra.
 */
@Component({
  selector: 'app-comercial-panel',
  standalone: true,
  templateUrl: './comercial-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComercialPanelComponent {
  readonly #service = inject(PresupuestosService);

  /** Código `IdPresupuesto` (o id) del presupuesto guardado. */
  readonly idPresupuesto = input.required<string>();
  /** Se incrementa para volver a leer (después de cotizar o elegir un proveedor). */
  readonly refresco = input(0);

  protected readonly fmtMoney = fmtMoney;

  protected readonly res = rxResource({
    params: () => ({ id: this.idPresupuesto(), n: this.refresco() }),
    stream: ({ params }) => this.#service.getComercial(params.id),
  });

  protected readonly datos = computed(() => (this.res.hasValue() ? this.res.value() : null));
  protected readonly errorCarga = computed(() => (this.res.error() ? mensajeDeError(this.res.error()) : ''));
  /** Solo se muestra si algún ítem tiene proveedor: antes el Comercial es igual al Meta y no aporta nada. */
  protected readonly hayAdjudicados = computed(() => (this.datos()?.fases ?? []).some((f) => f.items_adjudicados > 0 || f.fuente === 'COTIZACION'));

  protected fuente(f: FaseComercial): string {
    return FUENTE[f.fuente];
  }

  protected claseDif(d: number): string {
    return d < 0 ? 'text-emerald-700' : d > 0 ? 'text-rose-700' : 'text-slate-500';
  }

  protected signo(d: number): string {
    return d > 0 ? '+' : '';
  }
}
