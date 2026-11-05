import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { ObraService } from '../../obra.service';
import { PlanoRequerido, PlanosRequeridosObra } from '../../obra-liquidacion.interface';

/**
 * Lista de verificación de planos de la obra (copiada del tipo de proyecto, GRP T58): cada plano se marca como
 * entregado y el contador «n de m» cuenta los obligatorios. Carga sus propios datos.
 */
@Component({
  selector: 'app-planos-requeridos',
  standalone: true,
  templateUrl: './planos-requeridos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanosRequeridosComponent {
  readonly #service = inject(ObraService);

  readonly idCentroCosto = input<number | null>(null);
  /** Marcar o quitar el check exige la acción `editar` del módulo `obra`. */
  readonly puedeEditar = input(false);

  /** Última respuesta de un check (el PUT devuelve la lista completa); tiene prioridad sobre la carga inicial. */
  protected readonly actualizada = signal<PlanosRequeridosObra | null>(null);
  protected readonly guardando = signal<number | null>(null);
  protected readonly error = signal('');

  protected readonly cargada = rxResource({
    params: () => this.idCentroCosto() ?? undefined,
    stream: ({ params }) => this.#service.getPlanosRequeridos(params),
  });

  protected datos(): PlanosRequeridosObra | undefined {
    return this.actualizada() ?? (this.cargada.hasValue() ? this.cargada.value() : undefined);
  }

  protected alternar(item: PlanoRequerido): void {
    const id = this.idCentroCosto();
    if (id === null || !this.puedeEditar() || this.guardando() !== null) return;
    this.error.set('');
    this.guardando.set(item.id_tipo_plano);
    this.#service.marcarPlanoRequerido(id, item.id_tipo_plano, !item.entregado).subscribe({
      next: (resp) => {
        this.actualizada.set(resp);
        this.guardando.set(null);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.guardando.set(null);
      },
    });
  }
}
