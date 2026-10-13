import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { clampPct } from '../../obra.calc';
import { ESTADOS_SEMANA, ObraSemana, UpdateAvancePayload } from '../../obra.interface';
import { ObraService } from '../../obra.service';

@Component({
  selector: 'app-semana-avance-dialog',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, ModalComponent],
  templateUrl: './semana-avance-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SemanaAvanceDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly nombreObra = input<string>('');
  readonly semana = input.required<ObraSemana>();

  readonly closed = output<void>();
  readonly saved = output<ObraSemana>();

  protected readonly estados = ESTADOS_SEMANA;
  protected readonly clampPct = clampPct;
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');

  protected readonly form = new FormGroup({
    porcentaje_real: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(100)] }),
    estado: new FormControl<string>('En Plazo', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const s = this.semana();
      if (s) {
        this.form.reset({
          porcentaje_real: s.porcentaje_real,
          estado: s.estado,
        });
      }
    });
  }

  protected setMeta(): void {
    const s = this.semana();
    if (!s) return;
    this.form.controls.porcentaje_real.setValue(s.porcentaje_meta);
    this.sugerirEstado(s.porcentaje_meta);
  }

  protected setCien(): void {
    this.form.controls.porcentaje_real.setValue(100);
    this.form.controls.estado.setValue('Completado');
  }

  protected onRealChange(val: number): void {
    this.sugerirEstado(val);
  }

  private sugerirEstado(real: number): void {
    const s = this.semana();
    if (!s) return;
    if (real >= 100) {
      this.form.controls.estado.setValue('Completado');
    } else if (real >= s.porcentaje_meta) {
      this.form.controls.estado.setValue('En Plazo');
    } else if (real < s.porcentaje_meta && s.porcentaje_meta > 0) {
      this.form.controls.estado.setValue('Retrasado');
    }
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Ingresa un porcentaje de avance válido entre 0 y 100.');
      return;
    }
    const s = this.semana();
    if (!s) return;

    const v = this.form.getRawValue();
    const payload: UpdateAvancePayload = {
      porcentaje_real: Number(v.porcentaje_real),
      estado: v.estado,
    };

    this.isSaving.set(true);
    this.formError.set('');
    this.#service.updateAvanceSemanal(this.idCentroCosto(), s.id, payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.saved.emit(res);
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }
}
