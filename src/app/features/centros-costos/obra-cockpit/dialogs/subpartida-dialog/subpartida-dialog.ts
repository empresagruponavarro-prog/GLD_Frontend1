import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { ObraPartida, ObraSubpartida, TipoPartida } from '../../obra-control.interface';
import { PermisosObra, SIN_PERMISOS_OBRA, puedeGuardarObra } from '../../obra-permisos';
import { ObraService } from '../../obra.service';

/** Alta y edición de una subpartida con sus fechas programadas (RF-OP-06). */
@Component({
  selector: 'app-subpartida-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './subpartida-dialog.html',
  styleUrl: '../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubpartidaDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  /** Partida a la que pertenece (alta) o pertenece ya (edición). */
  readonly partida = input<ObraPartida | null>(null);
  readonly subpartida = input<ObraSubpartida | null>(null);
  readonly itemSugerido = input('');
  /** Rango de la obra: las fechas de un alta nacen con él y el usuario las ajusta. */
  readonly inicioObra = input('');
  readonly finObra = input('');
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly esEdicion = computed(() => this.subpartida() !== null);
  protected readonly puedeGuardar = computed(() => puedeGuardarObra(this.permisos(), this.esEdicion()));

  protected readonly form = new FormGroup({
    item: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    /** Vacío = hereda el tipo de la partida. */
    tipo: new FormControl<TipoPartida | ''>('', { nonNullable: true }),
    fecha_inicio: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fecha_fin: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    observacion: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const s = this.subpartida();
      this.form.reset({
        item: s?.item ?? this.itemSugerido(),
        nombre: s?.nombre ?? '',
        tipo: s?.tipo_propio ?? '',
        fecha_inicio: s?.fecha_inicio ?? this.inicioObra(),
        fecha_fin: s?.fecha_fin ?? this.finObra(),
        observacion: s?.observacion ?? '',
      });
      if (this.puedeGuardar()) this.form.enable({ emitEvent: false });
      else this.form.disable({ emitEvent: false });
    });
  }

  protected onSubmit(): void {
    if (!this.puedeGuardar()) return;
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid) {
      this.formError.set('Complete ítem, nombre y las fechas de inicio y fin.');
      return;
    }
    if (v.fecha_fin < v.fecha_inicio) {
      this.formError.set('El fin programado no puede ser anterior al inicio.');
      return;
    }
    const payload = {
      item: v.item.trim(),
      nombre: v.nombre.trim(),
      tipo: v.tipo === '' ? null : v.tipo,
      fecha_inicio: v.fecha_inicio,
      fecha_fin: v.fecha_fin,
      observacion: v.observacion.trim() || null,
    };
    const s = this.subpartida();
    const p = this.partida();
    if (!s && !p) return;
    this.isSaving.set(true);
    this.formError.set('');
    (s ? this.#service.updateSubpartida(this.idCentroCosto(), s.id, payload) : this.#service.createSubpartida(this.idCentroCosto(), p!.id, payload)).subscribe({
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
