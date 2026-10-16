import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { errorMessage } from '../../almacen/almacen.utils';
import { Cuenta, CuentaPayload, TIPOS_CUENTA, TipoCuenta } from '../tesoreria.models';
import { TesoreriaService } from '../tesoreria.service';

/** Maestro de cajas, bancos y billeteras desde las que se paga. */
@Component({
  selector: 'app-tesoreria-cuentas',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './cuentas.html',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuentasComponent {
  private readonly service = inject(TesoreriaService);
  /** Nueva → crear; Editar y Activar/Desactivar (PATCH) → editar. */
  protected readonly permisos = permisosDePantalla('tesoreria.cuentas');

  protected readonly tipos = TIPOS_CUENTA;
  protected readonly items = signal<Cuenta[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly message = signal('');
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly editando = signal<Cuenta | null>(null);

  protected readonly form = new FormGroup({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[A-Z0-9_-]{2,20}$/)] }),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tipo: new FormControl<TipoCuenta>('BANCO', { nonNullable: true }),
    banco: new FormControl('', { nonNullable: true }),
    numero_cuenta: new FormControl('', { nonNullable: true }),
    cci: new FormControl('', { nonNullable: true }),
    moneda_id: new FormControl('PEN', { nonNullable: true, validators: [Validators.required] }),
    estado: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.service.getCuentas().subscribe({
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

  protected nueva(): void {
    if (!this.permisos.crear()) return;
    this.editando.set(null);
    this.modalError.set('');
    this.form.reset({ tipo: 'BANCO', moneda_id: 'PEN', estado: true });
    this.form.controls.codigo.enable();
    this.form.controls.tipo.enable();
    this.form.controls.moneda_id.enable();
    this.isModalOpen.set(true);
  }

  protected editar(c: Cuenta): void {
    if (!this.permisos.editar()) return;
    this.editando.set(c);
    this.modalError.set('');
    this.form.reset({
      codigo: c.codigo,
      nombre: c.nombre,
      tipo: c.tipo,
      banco: c.banco ?? '',
      numero_cuenta: c.numero_cuenta ?? '',
      cci: c.cci ?? '',
      moneda_id: c.moneda_id,
      estado: c.estado,
    });
    // El código, el tipo y la moneda no se cambian: hay pagos que dependen de ellos.
    this.form.controls.codigo.disable();
    this.form.controls.tipo.disable();
    this.form.controls.moneda_id.disable();
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.modalError.set('Complete el código (mayúsculas, números, guion), el nombre y la moneda.');
    }
    const v = this.form.getRawValue();
    const texto = (s: string) => s.trim() || undefined;
    const payload: CuentaPayload = {
      nombre: v.nombre.trim(),
      banco: texto(v.banco),
      numero_cuenta: texto(v.numero_cuenta),
      cci: texto(v.cci),
    };
    const actual = this.editando();
    this.isSaving.set(true);
    this.modalError.set('');
    const request$ = actual
      ? this.service.updateCuenta(actual.id, { ...payload, estado: v.estado })
      : this.service.createCuenta({ ...payload, codigo: v.codigo.trim(), tipo: v.tipo, moneda_id: v.moneda_id.trim().toUpperCase() });
    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeModal();
        this.message.set(actual ? 'Cuenta actualizada.' : 'Cuenta creada.');
        this.load();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.modalError.set(errorMessage(err));
      },
    });
  }

  protected alternarEstado(c: Cuenta): void {
    if (!this.permisos.editar()) return;
    this.service.updateCuenta(c.id, { nombre: c.nombre, estado: !c.estado }).subscribe({
      next: () => this.load(),
      error: (err: unknown) => alert(errorMessage(err)),
    });
  }
}
