import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { PermisosService } from '@app/core/auth/permisos.service';
import { valorDeEvento } from '@shared/utils/eventos';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
import { errorMessage, fmtMoney, todayISO } from '../../almacen/almacen.utils';
import { SelectOption } from '../../requerimientos/requerimientos.models';
import { RequerimientosService } from '../../requerimientos/requerimientos.service';
import {
  Cuenta,
  MEDIOS_CON_OPERACION,
  MEDIOS_PAGO,
  MEDIO_PAGO_LABEL,
  MedioPago,
  Pago,
  Programacion,
  TipoCambioVigente,
} from '../tesoreria.models';
import { TesoreriaService } from '../tesoreria.service';
import { addDays } from '../tesoreria.utils';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;

/** Ejecución de pagos: se ejecuta lo programado, se emite el comprobante CP- y se completa el expediente. */
@Component({
  selector: 'app-tesoreria-pagos',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DataTableComponent, ModalComponent],
  templateUrl: './pagos.html',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagosComponent {
  private readonly service = inject(TesoreriaService);
  private readonly requerimientos = inject(RequerimientosService);
  readonly #permisos = inject(PermisosService);
  /**
   * Ejecutar / Registrar pago (`POST /tesoreria/pagos`) exige solo `ver` (acceso a la pantalla), así que
   * siempre se muestra; Anular pago → anular.
   */
  protected readonly permisos = permisosDePantalla('tesoreria.pagos');
  /** El enlace "Programación" lleva a otra pantalla: solo si se tiene acceso a ella. */
  protected readonly puedeVerProgramacion = computed(() => this.#permisos.puedeVer('tesoreria.programacion'));
  protected readonly valorDe = valorDeEvento;

  protected readonly fmtMoney = fmtMoney;
  protected readonly medios = MEDIOS_PAGO;
  protected readonly medioLabel = MEDIO_PAGO_LABEL;
  protected readonly hoy = todayISO();

  protected readonly columns: DataTable[] = [
    { label: 'Comprobante', width: '120px' },
    { label: 'Fecha', width: '100px' },
    { label: 'Documento', width: '150px' },
    { label: 'Proveedor' },
    { label: 'Concepto', width: '100px' },
    { label: 'Monto', align: 'right', width: '130px' },
    { label: 'Cuenta', width: '170px' },
    { label: 'Operación', width: '130px' },
    { label: 'Estado', align: 'center', width: '110px' },
    { label: 'Acciones', align: 'center', width: '110px' },
  ];

  // ---- programados por ejecutar
  protected readonly desde = signal(addDays(todayISO(), -7));
  protected readonly hasta = signal(addDays(todayISO(), 14));
  protected readonly programados = signal<Programacion[]>([]);
  protected readonly isLoadingProg = signal(false);
  protected readonly cuentas = signal<Cuenta[]>([]);
  protected readonly trabajadores = signal<SelectOption[]>([]);
  protected readonly tcDolar = signal<TipoCambioVigente | null>(null);

  // ---- pagos ejecutados
  protected readonly pagos = signal<Pago[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly isLoading = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  // ---- modal de ejecución
  protected readonly ejecutando = signal<Programacion | null>(null);
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly cuentaElegida = signal<Cuenta | null>(null);
  protected readonly requiereTc = computed(() => {
    const p = this.ejecutando();
    const c = this.cuentaElegida();
    if (!p || !c) return false;
    const importeEnSoles = p.concepto === 'DETRACCION' || !p.moneda_id || ['PEN', 'S/'].includes(p.moneda_id.toUpperCase());
    const cuentaEnSoles = ['PEN', 'S/'].includes(c.moneda_id.toUpperCase());
    return importeEnSoles !== cuentaEnSoles;
  });

  protected readonly form = new FormGroup({
    fecha_pago: new FormControl(todayISO(), { nonNullable: true, validators: [Validators.required] }),
    monto: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(DECIMAL)] }),
    id_cuenta: new FormControl<number | null>(null, { validators: [Validators.required] }),
    medio_pago: new FormControl<MedioPago>('TRANSFERENCIA', { nonNullable: true }),
    numero_operacion: new FormControl('', { nonNullable: true }),
    tipo_cambio: new FormControl('', { nonNullable: true }),
    id_ejecutado_por: new FormControl<number | null>(null),
    observaciones: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.service.getCuentas(true).subscribe({ next: (r) => this.cuentas.set(r), error: () => this.cuentas.set([]) });
    this.requerimientos.getTrabajadoresSelect().subscribe({ next: (r) => this.trabajadores.set(r), error: () => this.trabajadores.set([]) });
    this.service.getTipoCambioVigente('USD').subscribe({ next: (t) => this.tcDolar.set(t), error: () => this.tcDolar.set(null) });
    this.form.controls.id_cuenta.valueChanges.subscribe((id) => this.cuentaElegida.set(this.cuentas().find((c) => c.id === id) ?? null));
    this.loadProgramados();
    this.load();
  }

  protected loadProgramados(): void {
    this.isLoadingProg.set(true);
    this.service.getAgenda({ desde: this.desde(), hasta: this.hasta(), estado: 'PROGRAMADO' }).subscribe({
      next: (a) => {
        this.programados.set(a.items);
        this.isLoadingProg.set(false);
      },
      error: () => {
        this.programados.set([]);
        this.isLoadingProg.set(false);
      },
    });
  }

  protected setRango(target: 'desde' | 'hasta', value: string): void {
    if (target === 'desde') this.desde.set(value);
    else this.hasta.set(value);
    this.loadProgramados();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.service.getPagos({ page: this.page(), pageSize: this.pageSize() }).subscribe({
      next: (res) => {
        this.pagos.set(res.data);
        this.total.set(res.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.pagos.set([]);
        this.total.set(0);
        this.isLoading.set(false);
      },
    });
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  // ------------------------------------------------------------------ ejecutar
  protected ejecutar(p: Programacion): void {
    this.ejecutando.set(p);
    this.modalError.set('');
    this.form.reset({
      fecha_pago: this.hoy,
      monto: p.monto,
      id_cuenta: p.id_cuenta,
      medio_pago: p.medio_pago,
      numero_operacion: '',
      tipo_cambio: '',
      id_ejecutado_por: null,
      observaciones: '',
    });
    this.cuentaElegida.set(this.cuentas().find((c) => c.id === p.id_cuenta) ?? null);
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
    this.ejecutando.set(null);
  }

  protected confirmar(): void {
    const p = this.ejecutando();
    if (!p) return;
    const v = this.form.getRawValue();
    if (!v.fecha_pago) return this.modalError.set('Indique la fecha de pago.');
    if (!DECIMAL.test(v.monto.trim()) || Number(v.monto) <= 0) return this.modalError.set('El monto no es válido.');
    if (Number(v.monto) > Number(p.monto) + 0.005) return this.modalError.set(`El monto supera lo programado (${fmtMoney(p.monto)}).`);
    if (!v.id_cuenta) return this.modalError.set('Elija la cuenta desde la que se paga.');
    if (MEDIOS_CON_OPERACION.includes(v.medio_pago) && !v.numero_operacion.trim()) {
      return this.modalError.set(`El medio ${this.medioLabel[v.medio_pago]} exige el n.º de operación, cheque o constancia.`);
    }
    if (v.tipo_cambio.trim() && !DECIMAL.test(v.tipo_cambio.trim())) return this.modalError.set('El tipo de cambio no es válido.');
    this.isSaving.set(true);
    this.modalError.set('');
    this.service
      .ejecutar({
        id_pago_programado: p.id,
        fecha_pago: v.fecha_pago,
        monto: v.monto.trim(),
        id_cuenta: v.id_cuenta,
        medio_pago: v.medio_pago,
        numero_operacion: v.numero_operacion.trim() || undefined,
        tipo_cambio: v.tipo_cambio.trim() || undefined,
        id_ejecutado_por: v.id_ejecutado_por ?? undefined,
        observaciones: v.observaciones.trim() || undefined,
      })
      .subscribe({
        next: (pago) => {
          this.isSaving.set(false);
          this.closeModal();
          this.message.set(`Pago ${pago.numero} registrado.`);
          this.loadProgramados();
          this.load();
        },
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.modalError.set(errorMessage(err));
        },
      });
  }

  protected anular(p: Pago): void {
    if (!this.permisos.anular()) return;
    const motivo = prompt(`¿Anular el pago ${p.numero}? El saldo se libera y la programación vuelve a pendiente.\nMotivo:`);
    if (motivo === null) return;
    this.service.anularPago(p.id, motivo.trim() || undefined).subscribe({
      next: () => {
        this.message.set(`Pago ${p.numero} anulado.`);
        this.error.set('');
        this.loadProgramados();
        this.load();
      },
      error: (err: unknown) => this.error.set(errorMessage(err)),
    });
  }
}
