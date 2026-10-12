import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { sinVacios } from '../../obra.calc';
import { ESTADOS_PLANTA, ObraResidente, ResidentePayload } from '../../obra.interface';
import { ObraService } from '../../obra.service';

@Component({
  selector: 'app-residente-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './residente-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResidenteDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly residente = input<ObraResidente | null>(null);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly estadosPlanta = ESTADOS_PLANTA;
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');

  protected readonly form = new FormGroup({
    nombre_completo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    rol_obra: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    cip_cap: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    especialidad: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50), Validators.pattern(/^[+\d\s()-]*$/)] }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(150)] }),
    turno: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    estado_planta: new FormControl<string>('En Planta', { nonNullable: true }),
    orden: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const r = this.residente();
      this.form.reset({
        nombre_completo: r?.nombre_completo ?? '',
        rol_obra: r?.rol_obra ?? '',
        cip_cap: r?.cip_cap ?? '',
        especialidad: r?.especialidad ?? '',
        telefono: r?.telefono ?? '',
        correo: r?.correo ?? '',
        turno: r?.turno ?? 'Lun - Sáb 07:00 - 18:00',
        estado_planta: r?.estado_planta ?? 'En Planta',
        orden: r?.orden ?? null,
      });
    });
  }

  protected get isEdit(): boolean {
    return this.residente() !== null;
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Completa nombre y rol; verifica el formato del correo y teléfono.');
      return;
    }
    const v = this.form.getRawValue();
    const payload = sinVacios<ResidentePayload>({
      nombre_completo: v.nombre_completo.trim(),
      rol_obra: v.rol_obra.trim(),
      cip_cap: v.cip_cap.trim(),
      especialidad: v.especialidad.trim(),
      telefono: v.telefono.trim(),
      correo: v.correo.trim(),
      turno: v.turno.trim(),
      estado_planta: v.estado_planta,
      orden: v.orden ?? undefined,
    });
    const r = this.residente();
    const req$ = r
      ? this.#service.updateResidente(this.idCentroCosto(), r.id, payload)
      : this.#service.createResidente(this.idCentroCosto(), payload);

    this.isSaving.set(true);
    req$.subscribe({
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

  protected onDelete(): void {
    const r = this.residente();
    if (!r || !confirm(`¿Desasignar a ${r.nombre_completo} de la obra?`)) return;
    this.isSaving.set(true);
    this.#service.deleteResidente(this.idCentroCosto(), r.id).subscribe({
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
