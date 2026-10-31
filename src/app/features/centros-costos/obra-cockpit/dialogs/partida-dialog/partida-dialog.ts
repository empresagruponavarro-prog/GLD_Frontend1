import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { ObraPartida, TipoPartida } from '../../obra-control.interface';
import { PermisosObra, SIN_PERMISOS_OBRA, puedeGuardarObra } from '../../obra-permisos';
import { ObraService } from '../../obra.service';

/** Alta y edición de una partida (RF-OP-06, RF-OP-09). El ítem es único por obra. */
@Component({
  selector: 'app-partida-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './partida-dialog.html',
  styleUrl: '../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartidaDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  /** Partida a editar; `null` = alta. */
  readonly partida = input<ObraPartida | null>(null);
  /** Ítem sugerido para un alta (el siguiente número libre). */
  readonly itemSugerido = input('');
  /** Permisos de `obra`: alta exige `crear`; edición, `editar`. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly esEdicion = computed(() => this.partida() !== null);
  protected readonly puedeGuardar = computed(() => puedeGuardarObra(this.permisos(), this.esEdicion()));

  protected readonly form = new FormGroup({
    item: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    tipo: new FormControl<TipoPartida>('CONTRACTUAL', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const p = this.partida();
      this.form.reset({ item: p?.item ?? this.itemSugerido(), nombre: p?.nombre ?? '', tipo: p?.tipo ?? 'CONTRACTUAL' });
      if (this.puedeGuardar()) this.form.enable({ emitEvent: false });
      else this.form.disable({ emitEvent: false });
    });
  }

  protected onSubmit(): void {
    if (!this.puedeGuardar()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Complete el ítem (máx. 20) y el nombre de la partida.');
      return;
    }
    const v = this.form.getRawValue();
    const payload = { item: v.item.trim(), nombre: v.nombre.trim(), tipo: v.tipo };
    const p = this.partida();
    this.isSaving.set(true);
    this.formError.set('');
    (p ? this.#service.updatePartida(this.idCentroCosto(), p.id, payload) : this.#service.createPartida(this.idCentroCosto(), payload)).subscribe({
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
