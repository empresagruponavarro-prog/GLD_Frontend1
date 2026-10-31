import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { ETIQUETAS_MOTIVO, MOTIVOS_REPROGRAMACION, MotivoReprogramacion, ObraReprogramacion } from '../../obra-control.interface';
import { PermisosObra, SIN_PERMISOS_OBRA, puedeGuardarObra } from '../../obra-permisos';
import { ObraService } from '../../obra.service';

/**
 * Registra o edita una reprogramación (RF-OP-10): desplaza el plan N días desde una fecha.
 * Un motivo externo mueve el fin vigente; «Interno» es atraso y no lo mueve (RC-09).
 */
@Component({
  selector: 'app-reprogramacion-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './reprogramacion-dialog.html',
  styleUrl: '../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReprogramacionDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly reprogramacion = input<ObraReprogramacion | null>(null);
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly motivos = MOTIVOS_REPROGRAMACION.map((m) => ({ valor: m, etiqueta: ETIQUETAS_MOTIVO[m] }));
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly esEdicion = computed(() => this.reprogramacion() !== null);
  protected readonly puedeGuardar = computed(() => puedeGuardarObra(this.permisos(), this.esEdicion()));

  protected readonly form = new FormGroup({
    desde: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    dias: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(1), Validators.max(60)] }),
    motivo: new FormControl<MotivoReprogramacion>('CLIENTE', { nonNullable: true, validators: [Validators.required] }),
    detalle: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const r = this.reprogramacion();
      this.form.reset({ desde: r?.desde ?? '', dias: r?.dias ?? null, motivo: r?.motivo ?? 'CLIENTE', detalle: r?.detalle ?? '' });
      if (this.puedeGuardar()) this.form.enable({ emitEvent: false });
      else this.form.disable({ emitEvent: false });
    });
  }

  protected onSubmit(): void {
    if (!this.puedeGuardar()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Indique desde cuándo, de 1 a 60 días y el motivo.');
      return;
    }
    const v = this.form.getRawValue();
    const payload = { desde: v.desde, dias: Number(v.dias), motivo: v.motivo, detalle: v.detalle.trim() || null };
    const r = this.reprogramacion();
    this.isSaving.set(true);
    this.formError.set('');
    (r ? this.#service.updateReprogramacion(this.idCentroCosto(), r.id, payload) : this.#service.createReprogramacion(this.idCentroCosto(), payload)).subscribe({
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
