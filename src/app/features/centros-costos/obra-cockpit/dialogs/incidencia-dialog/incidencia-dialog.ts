import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { sinVacios } from '../../obra.calc';
import { ESTADOS_INCIDENCIA, IncidenciaPayload, ObraIncidencia, PRIORIDADES_INCIDENCIA } from '../../obra.interface';
import { ObraService } from '../../obra.service';

@Component({
  selector: 'app-incidencia-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './incidencia-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidenciaDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly nombreObra = input<string>('');
  readonly incidencia = input<ObraIncidencia | null>(null);
  /** Sugerencias para el campo responsable (residentes de la obra). */
  readonly responsables = input<readonly string[]>([]);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly opcionesPrioridad = [
    { value: 'BAJA', label: 'Baja (Seguimiento Rutinario)' },
    { value: 'MEDIA', label: 'Media (Severidad Estándar)' },
    { value: 'ALTA', label: 'Alta (Atención Requerida)' },
    { value: 'CRITICA', label: 'Crítica (Paraliza Frente)' },
  ];
  protected readonly plazosRapidos = [
    { label: '24h (Urgente)', valor: '24 horas', urgente: true },
    { label: '48h', valor: '48 horas', urgente: false },
    { label: '72h', valor: '72 horas', urgente: false },
    { label: 'Fin de Semana', valor: 'Fin de semana', urgente: false },
  ];
  protected readonly prioridades = PRIORIDADES_INCIDENCIA;
  protected readonly estados = ESTADOS_INCIDENCIA;
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');

  protected readonly form = new FormGroup({
    titulo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    descripcion: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(1000)] }),
    prioridad: new FormControl<string>('MEDIA', { nonNullable: true }),
    responsable: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    accion_solicitada_o_ejecutada: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    plazo_resolucion: new FormControl('24 horas', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    estado: new FormControl<string>('PENDIENTE', { nonNullable: true }),
  });

  protected setPlazo(valor: string): void {
    this.form.controls.plazo_resolucion.setValue(valor);
  }

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const i = this.incidencia();
      this.form.reset({
        titulo: i?.titulo ?? '',
        descripcion: i?.descripcion ?? '',
        prioridad: i?.prioridad ?? 'MEDIA',
        responsable: i?.responsable ?? '',
        accion_solicitada_o_ejecutada: i?.accion_solicitada_o_ejecutada ?? '',
        plazo_resolucion: i?.plazo_resolucion ?? '',
        estado: i?.estado ?? 'PENDIENTE',
      });
    });
  }

  protected get isEdit(): boolean {
    return this.incidencia() !== null;
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Completa el título y la descripción de la incidencia.');
      return;
    }
    const v = this.form.getRawValue();
    const payload = sinVacios<IncidenciaPayload>({
      titulo: v.titulo.trim(),
      descripcion: v.descripcion.trim(),
      prioridad: v.prioridad,
      responsable: v.responsable.trim(),
      accion_solicitada_o_ejecutada: v.accion_solicitada_o_ejecutada.trim(),
      plazo_resolucion: v.plazo_resolucion.trim(),
      estado: this.isEdit ? v.estado : undefined,
    });
    const i = this.incidencia();
    const req$ = i
      ? this.#service.updateIncidencia(this.idCentroCosto(), i.id, payload)
      : this.#service.createIncidencia(this.idCentroCosto(), payload);

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
    const i = this.incidencia();
    if (!i || !confirm(`¿Eliminar la incidencia ${i.codigo_incidencia}?`)) return;
    this.isSaving.set(true);
    this.#service.deleteIncidencia(this.idCentroCosto(), i.id).subscribe({
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
