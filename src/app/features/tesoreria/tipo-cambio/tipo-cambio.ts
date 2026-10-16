import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { errorMessage, todayISO } from '../../almacen/almacen.utils';
import { TipoCambio } from '../tesoreria.models';
import { TesoreriaService } from '../tesoreria.service';

const DECIMAL = /^\d{1,3}(\.\d{1,4})?$/;

/** Tipo de cambio diario: se usa al pagar en otra moneda, al calcular detracciones y en el tablero. */
@Component({
  selector: 'app-tesoreria-tipo-cambio',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './tipo-cambio.html',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TipoCambioComponent {
  private readonly service = inject(TesoreriaService);
  /** Guardar y Corregir hacen `POST /tesoreria/tipo-cambio`: exigen crear (sin él se oculta el formulario). */
  protected readonly permisos = permisosDePantalla('tesoreria.tipo-cambio');

  protected readonly hoy = todayISO();
  protected readonly items = signal<TipoCambio[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  /** ¿Ya se registró el tipo de cambio de hoy en dólares? */
  protected readonly faltaHoy = computed(() => !this.items().some((t) => t.fecha === this.hoy && t.moneda_id === 'USD'));

  protected readonly form = new FormGroup({
    fecha: new FormControl(todayISO(), { nonNullable: true, validators: [Validators.required] }),
    moneda_id: new FormControl('USD', { nonNullable: true, validators: [Validators.required] }),
    compra: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(DECIMAL)] }),
    venta: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(DECIMAL)] }),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.service.getTiposCambio().subscribe({
      next: (r) => {
        this.items.set(r);
        this.isLoading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.isLoading.set(false);
      },
    });
  }

  protected editar(t: TipoCambio): void {
    if (!this.permisos.crear()) return;
    this.form.reset({ fecha: t.fecha, moneda_id: t.moneda_id, compra: t.compra, venta: t.venta });
  }

  protected guardar(): void {
    if (!this.permisos.crear()) return;
    this.error.set('');
    this.message.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.error.set('Indique fecha, moneda y los tipos de cambio de compra y venta (hasta 4 decimales).');
    }
    const v = this.form.getRawValue();
    if (Number(v.venta) < Number(v.compra)) return this.error.set('El tipo de cambio de venta no puede ser menor al de compra.');
    this.isSaving.set(true);
    this.service.saveTipoCambio({ fecha: v.fecha, moneda_id: v.moneda_id.trim().toUpperCase(), compra: v.compra.trim(), venta: v.venta.trim() }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.message.set(`Tipo de cambio del ${v.fecha} guardado.`);
        this.form.patchValue({ compra: '', venta: '' });
        this.load();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
