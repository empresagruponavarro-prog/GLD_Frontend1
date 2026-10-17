import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { ObraIncidencia } from '../../obra.interface';
import { ObraService } from '../../obra.service';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';

@Component({
  selector: 'app-incidencia-resolver-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './incidencia-resolver-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidenciaResolverDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly nombreObra = input<string>('');
  readonly incidencia = input<ObraIncidencia | null>(null);
  readonly responsables = input<readonly string[]>([]);
  /** Permisos de `obra`: resolver (`PATCH …/incidencias/:id`) exige `editar`. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeGuardar = computed(() => this.permisos().editar);
  /** Sin permiso de guardar, el formulario se muestra en solo lectura. */
  protected readonly soloLectura = computed(() => !this.puedeGuardar());

  protected readonly form = new FormGroup({
    accion_solicitada_o_ejecutada: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(1000)],
    }),
    responsable: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(150)],
    }),
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const inc = this.incidencia();
      this.form.reset({
        accion_solicitada_o_ejecutada: inc?.accion_solicitada_o_ejecutada ?? '',
        responsable: inc?.responsable ?? '',
      });
      if (this.soloLectura()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });
  }

  protected onSubmit(): void {
    if (!this.puedeGuardar()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Por favor, indica la solución técnica ejecutada en obra.');
      return;
    }
    const inc = this.incidencia();
    if (!inc) return;

    this.isSaving.set(true);
    this.formError.set('');

    const val = this.form.getRawValue();
    this.#service
      .updateIncidencia(this.idCentroCosto(), inc.id, {
        estado: 'RESUELTA',
        accion_solicitada_o_ejecutada: val.accion_solicitada_o_ejecutada.trim(),
        responsable: val.responsable.trim() || inc.responsable,
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.saved.emit();
        },
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.formError.set(errorMessage(err) || 'No se pudo resolver la incidencia');
        },
      });
  }
}
