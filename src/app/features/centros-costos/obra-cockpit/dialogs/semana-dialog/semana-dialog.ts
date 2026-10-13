import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { clampPct, sinVacios, sugerenciaNuevaSemana } from '../../obra.calc';
import { ESTADOS_SEMANA, ObraSemana, SemanaPayload } from '../../obra.interface';
import { ObraService } from '../../obra.service';

@Component({
  selector: 'app-semana-dialog',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, ModalComponent],
  templateUrl: './semana-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SemanaDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly nombreObra = input<string>('');
  readonly responsables = input<readonly string[]>([]);
  /** Semana a editar; null = crear nueva. */
  readonly semana = input<ObraSemana | null>(null);
  readonly semanasExistentes = input<readonly ObraSemana[]>([]);
  readonly fechaInicioObra = input<string | undefined>(undefined);

  readonly closed = output<void>();
  readonly saved = output<ObraSemana>();

  protected readonly estados = ESTADOS_SEMANA;
  protected readonly clampPct = clampPct;
  protected readonly isSaving = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly formError = signal('');

  protected get duracionDias(): number {
    const ini = this.form.controls.fecha_inicio.value;
    const fin = this.form.controls.fecha_fin.value;
    if (!ini || !fin) return 0;
    const dIni = new Date(ini).getTime();
    const dFin = new Date(fin).getTime();
    if (isNaN(dIni) || isNaN(dFin) || dFin < dIni) return 0;
    return Math.round((dFin - dIni) / (1000 * 60 * 60 * 24)) + 1;
  }

  protected readonly form = new FormGroup({
    numero_semana: new FormControl<number | null>(null, { validators: [Validators.min(1)] }),
    etiqueta_semana: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    fecha_inicio: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fecha_fin: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fase_principal: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    responsable_nombre: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
    porcentaje_meta: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(100)] }),
    porcentaje_real: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(100)] }),
    estado: new FormControl<string>('Programado', { nonNullable: true }),
    descripcion_actividades: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const s = this.semana();
      if (s) {
        this.form.reset({
          numero_semana: s.numero_semana,
          etiqueta_semana: s.etiqueta_semana,
          fecha_inicio: s.fecha_inicio,
          fecha_fin: s.fecha_fin,
          fase_principal: s.fase_principal,
          responsable_nombre: s.responsable_nombre ?? '',
          porcentaje_meta: s.porcentaje_meta,
          porcentaje_real: s.porcentaje_real,
          estado: s.estado,
          descripcion_actividades: s.descripcion_actividades ?? '',
        });
        this.form.controls.numero_semana.disable();
      } else {
        const sug = sugerenciaNuevaSemana(this.semanasExistentes(), this.fechaInicioObra());
        this.form.reset({
          numero_semana: sug.numero,
          etiqueta_semana: '',
          fecha_inicio: sug.inicio,
          fecha_fin: sug.fin,
          fase_principal: '',
          responsable_nombre: '',
          porcentaje_meta: sug.metaAnterior,
          porcentaje_real: 0,
          estado: 'Programado',
          descripcion_actividades: '',
        });
        this.form.controls.numero_semana.enable();
      }
    });
  }

  protected get isEdit(): boolean {
    return this.semana() !== null;
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid) {
      this.formError.set('Revisa los campos obligatorios y que los porcentajes estén entre 0 y 100.');
      return;
    }
    if (v.fecha_inicio > v.fecha_fin) {
      this.formError.set('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }
    const payload = sinVacios<SemanaPayload>({
      numero_semana: this.isEdit ? undefined : (v.numero_semana ?? undefined),
      etiqueta_semana: v.etiqueta_semana.trim(),
      fecha_inicio: v.fecha_inicio,
      fecha_fin: v.fecha_fin,
      fase_principal: v.fase_principal.trim(),
      responsable_nombre: v.responsable_nombre.trim(),
      porcentaje_meta: Number(v.porcentaje_meta),
      porcentaje_real: Number(v.porcentaje_real),
      estado: v.estado,
      descripcion_actividades: v.descripcion_actividades.trim(),
    });

    const s = this.semana();
    const req$ = s
      ? this.#service.updateSemana(this.idCentroCosto(), s.id, payload)
      : this.#service.createSemana(this.idCentroCosto(), payload);

    this.isSaving.set(true);
    this.formError.set('');
    req$.subscribe({
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

  protected onDelete(): void {
    const s = this.semana();
    if (!s || !confirm(`¿Eliminar ${s.etiqueta_semana}? Esta acción no se puede deshacer.`)) return;
    this.isDeleting.set(true);
    this.#service.deleteSemana(this.idCentroCosto(), s.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.saved.emit(s);
      },
      error: (err: unknown) => {
        this.isDeleting.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }
}
