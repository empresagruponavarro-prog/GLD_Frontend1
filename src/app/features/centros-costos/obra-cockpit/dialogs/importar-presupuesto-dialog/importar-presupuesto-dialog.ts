import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { PresupuestoDisponible } from '../../obra-control.interface';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';
import { ObraService } from '../../obra.service';

/**
 * Importa la estructura (fase → partida, categoría → subpartida) desde un presupuesto aprobado
 * del centro de costo (RF-OP-05). Si ya hay estructura, pide confirmar el reemplazo.
 */
@Component({
  selector: 'app-importar-presupuesto-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './importar-presupuesto-dialog.html',
  styleUrl: '../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportarPresupuestoDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  /** Hay partidas cargadas: importar las reemplaza. */
  readonly hayEstructura = input(false);
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly presupuestos = signal<PresupuestoDisponible[]>([]);
  protected readonly cargando = signal(false);
  protected readonly elegido = signal<number | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeGuardar = computed(() => this.permisos().editar);

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      this.elegido.set(null);
      this.cargando.set(true);
      this.#service.getPresupuestosDisponibles(this.idCentroCosto()).subscribe({
        next: (lista) => {
          this.presupuestos.set(lista);
          this.elegido.set(lista.length === 1 ? lista[0].id : null);
          this.cargando.set(false);
        },
        error: (err: unknown) => {
          this.presupuestos.set([]);
          this.cargando.set(false);
          this.formError.set(errorMessage(err));
        },
      });
    });
  }

  protected elegir(id: number): void {
    this.elegido.set(id);
  }

  protected onSubmit(): void {
    const id = this.elegido();
    if (!this.puedeGuardar() || id === null) return;
    this.isSaving.set(true);
    this.formError.set('');
    this.#service.importarPresupuesto(this.idCentroCosto(), id, this.hayEstructura()).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }
}
