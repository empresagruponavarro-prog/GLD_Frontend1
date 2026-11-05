import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage, fmtMoney } from '@app/features/almacen/almacen.utils';
import { ObraService } from '../../obra.service';
import { DosierObra, LiquidacionObra } from '../../obra-liquidacion.interface';

/**
 * Pestaña «Liquidación» del cockpit (GRP T59): requisitos para cerrar la obra, planos obligatorios que faltan,
 * emisión del dosier y la acción de liquidar (exige `aprobar` en el módulo `obra`). Una obra no se cierra a mano:
 * liquidar pasa el centro de costo a CERRADO y sus presupuestos a LIQUIDADO.
 */
@Component({
  selector: 'app-liquidacion-tab',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './liquidacion-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiquidacionTabComponent {
  readonly #service = inject(ObraService);

  readonly idCentroCosto = input<number | null>(null);
  readonly puedeLiquidar = input(false);
  /** La obra cambió de estado (liquidada): el cockpit debe recargar la cabecera. */
  readonly liquidada = output<void>();

  protected readonly recarga = signal(0);
  protected readonly cargada = rxResource({
    params: () => {
      const id = this.idCentroCosto();
      return id === null ? undefined : { id, recarga: this.recarga() };
    },
    stream: ({ params }) => this.#service.getLiquidacion(params.id),
  });

  /** El gasto no depende de liquidar, pero se vuelve a leer al liquidar junto con los requisitos. */
  protected readonly gasto = rxResource({
    params: () => {
      const id = this.idCentroCosto();
      return id === null ? undefined : { id, recarga: this.recarga() };
    },
    stream: ({ params }) => this.#service.getGasto(params.id),
  });
  protected readonly fmtMoney = fmtMoney;

  protected readonly confirmando = signal(false);
  protected readonly liquidando = signal(false);
  protected readonly emitiendo = signal(false);
  protected readonly dosier = signal<DosierObra | null>(null);
  protected readonly error = signal('');
  protected readonly errorDosier = signal('');

  protected datosGasto() {
    return this.gasto.hasValue() ? this.gasto.value() : undefined;
  }

  protected datos(): LiquidacionObra | undefined {
    return this.cargada.hasValue() ? this.cargada.value() : undefined;
  }

  protected emitirDosier(): void {
    const id = this.idCentroCosto();
    if (id === null || this.emitiendo()) return;
    this.errorDosier.set('');
    this.dosier.set(null);
    this.emitiendo.set(true);
    this.#service.getDosier(id).subscribe({
      next: (d) => {
        this.dosier.set(d);
        this.emitiendo.set(false);
      },
      error: (err: unknown) => {
        this.errorDosier.set(errorMessage(err));
        this.emitiendo.set(false);
      },
    });
  }

  /** Confirmación en dos pasos: el primer clic la pide, el segundo liquida. */
  protected liquidar(): void {
    const id = this.idCentroCosto();
    const d = this.datos();
    if (id === null || !d?.puede_liquidar || !this.puedeLiquidar() || this.liquidando()) return;
    if (!this.confirmando()) {
      this.confirmando.set(true);
      return;
    }
    this.error.set('');
    this.liquidando.set(true);
    this.#service.liquidar(id).subscribe({
      next: () => {
        this.liquidando.set(false);
        this.confirmando.set(false);
        this.recarga.update((n) => n + 1);
        this.liquidada.emit();
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.liquidando.set(false);
        this.confirmando.set(false);
      },
    });
  }

  protected cancelar(): void {
    this.confirmando.set(false);
  }
}
