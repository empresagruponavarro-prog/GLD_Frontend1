import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { etiquetaEstadoObra, transicionesDe } from '../../obra-control.calc';
import { CambioEstado, ESTADOS_OBRA, EstadoObra, ETIQUETAS_ESTADO_OBRA } from '../../obra-control.interface';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';
import { ObraService } from '../../obra.service';

/**
 * Cambio de estado de la obra (RF-OP-20). Solo ofrece las transiciones permitidas; al entregar
 * (Post venta) pide la fecha de entrega y, si el avance es menor a 100 %, una confirmación (RV-17);
 * al cerrar (Culminado) pide la fecha de cierre de la post venta.
 */
@Component({
  selector: 'app-estado-obra-dialog',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, ModalComponent],
  templateUrl: './estado-obra-dialog.html',
  styleUrl: '../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoObraDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  /** Estado actual; `null` = la obra todavía no entra al control. */
  readonly estadoActual = input<EstadoObra | null>(null);
  /** Avance real de la obra (0-100), para advertir al entregar incompleta. */
  readonly realActual = input<number | null>(null);
  /** Permisos de `obra`: cambiar el estado (`POST …/estado`) exige `editar`. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<CambioEstado>();

  protected readonly etiquetas = ETIQUETAS_ESTADO_OBRA;
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeGuardar = computed(() => this.permisos().editar);
  protected readonly opciones = computed(() => transicionesDe(this.estadoActual()));
  protected readonly etiquetaActual = computed(() => etiquetaEstadoObra(this.estadoActual()));

  protected readonly form = new FormGroup({
    estado: new FormControl<EstadoObra | ''>('', { nonNullable: true, validators: [Validators.required] }),
    fecha: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)] }),
    observaciones: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    confirmar: new FormControl(false, { nonNullable: true }),
  });

  readonly #estadoElegido = toSignal(this.form.controls.estado.valueChanges, { initialValue: this.form.controls.estado.value });
  protected readonly pideFecha = computed(() => this.#estadoElegido() === 'POST_VENTA' || this.#estadoElegido() === 'CULMINADO');
  protected readonly etiquetaFecha = computed(() => (this.#estadoElegido() === 'POST_VENTA' ? 'Fecha de entrega real' : 'Fecha de cierre de la post venta'));
  /** RV-17: entregar sin llegar al 100 % exige confirmar. */
  protected readonly entregaIncompleta = computed(() => this.#estadoElegido() === 'POST_VENTA' && (this.realActual() ?? 0) < 100);
  protected readonly esAlta = computed(() => this.estadoActual() === null);

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const primera = this.opciones()[0] ?? '';
      this.form.reset({ estado: primera, fecha: '', observaciones: '', confirmar: false });
      if (this.puedeGuardar()) this.form.enable({ emitEvent: false });
      else this.form.disable({ emitEvent: false });
    });
  }

  protected onSubmit(): void {
    if (!this.puedeGuardar()) return;
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid || v.estado === '' || !ESTADOS_OBRA.includes(v.estado)) {
      this.formError.set('Elija el nuevo estado y revise la fecha (AAAA-MM-DD) y las observaciones.');
      return;
    }
    if (this.entregaIncompleta() && !v.confirmar) {
      this.formError.set(`La obra está al ${Math.floor(this.realActual() ?? 0)} % de avance: marque la confirmación para entregarla incompleta.`);
      return;
    }
    this.isSaving.set(true);
    this.formError.set('');
    this.#service
      .cambiarEstado(this.idCentroCosto(), {
        estado: v.estado,
        ...(this.pideFecha() && v.fecha ? { fecha: v.fecha } : {}),
        ...(v.observaciones.trim() ? { observaciones: v.observaciones.trim() } : {}),
        ...(this.entregaIncompleta() ? { confirmar: true } : {}),
      })
      .subscribe({
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
