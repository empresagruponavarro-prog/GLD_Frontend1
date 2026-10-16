import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { PermisosService } from '@app/core/auth/permisos.service';
import { valorDeEvento } from '@shared/utils/eventos';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
import { errorMessage, fmtMoney, todayISO } from '../../almacen/almacen.utils';
import { CLASES_DOCUMENTO, CLASE_LABEL, DocumentoAdmin } from '../../documentos/administracion/administracion.models';
import { SelectOption } from '../../requerimientos/requerimientos.models';
import { RequerimientosService } from '../../requerimientos/requerimientos.service';
import { Agenda, Concepto, Cuenta, MEDIOS_PAGO, MEDIO_PAGO_LABEL, MedioPago, Programacion, ProgramacionItemPayload } from '../tesoreria.models';
import { TesoreriaService } from '../tesoreria.service';
import { addDays, esViernes, proximoViernes, proximosViernes } from '../tesoreria.utils';

function itemGroup(doc: DocumentoAdmin, concepto: Concepto, monto: number) {
  return new FormGroup({
    id_documento_origen: new FormControl(doc.id, { nonNullable: true }),
    concepto: new FormControl<Concepto>(concepto, { nonNullable: true }),
    etiqueta: new FormControl(`${doc.numero_documento ?? '#' + doc.id} · ${doc.proveedor ?? '—'}`, { nonNullable: true }),
    moneda: new FormControl(concepto === 'DETRACCION' ? 'S/' : (doc.moneda_simbolo ?? 'S/'), { nonNullable: true }),
    maximo: new FormControl(String(monto), { nonNullable: true }),
    incluir: new FormControl(true, { nonNullable: true }),
    monto: new FormControl(monto.toFixed(2), { nonNullable: true }),
  });
}

type ItemGroup = ReturnType<typeof itemGroup>;

/** Monto que todavía se puede programar de cada concepto (saldo menos lo ya programado). */
export function programable(doc: DocumentoAdmin): { proveedor: number; detraccion: number } {
  return {
    proveedor: Math.max(Number(doc.saldo_por_pagar_proveedor) - Number(doc.programado_proveedor), 0),
    detraccion: Math.max(Number(doc.saldo_por_pagar_detraccion) - Number(doc.programado_detraccion), 0),
  };
}

/** Programación de pagos: se asigna fecha (viernes), medio y cuenta a los documentos con saldo por pagar. */
@Component({
  selector: 'app-tesoreria-programacion',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DataTableComponent, ModalComponent],
  templateUrl: './programacion.html',
  styleUrl: './programacion.css',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramacionComponent {
  private readonly service = inject(TesoreriaService);
  private readonly requerimientos = inject(RequerimientosService);
  private readonly destroyRef = inject(DestroyRef);
  readonly #permisos = inject(PermisosService);
  /** Programar pagos → crear; Reprogramar (PATCH) → editar; Cancelar programación → anular. */
  protected readonly permisos = permisosDePantalla('tesoreria.programacion');
  /** El enlace "Ejecutar pagos" lleva a otra pantalla: solo si se tiene acceso a ella. */
  protected readonly puedeVerPagos = computed(() => this.#permisos.puedeVer('tesoreria.pagos'));
  protected readonly valorDe = valorDeEvento;

  protected readonly fmtMoney = fmtMoney;
  protected readonly programable = programable;
  protected readonly medios = MEDIOS_PAGO;
  protected readonly medioLabel = MEDIO_PAGO_LABEL;
  protected readonly clases = CLASES_DOCUMENTO;
  protected readonly claseLabel = CLASE_LABEL;
  protected readonly hoy = todayISO();
  protected readonly viernes = proximosViernes(todayISO(), 10);

  protected readonly columns: DataTable[] = [
    { label: '', width: '44px' },
    { label: 'Documento', width: '170px' },
    { label: 'Proveedor / beneficiario' },
    { label: 'Centro de costos', width: '180px' },
    { label: 'Vence', width: '110px' },
    { label: 'Por programar', align: 'right', width: '130px' },
    { label: 'Detracción por programar', align: 'right', width: '150px' },
  ];

  protected readonly pendientes = signal<DocumentoAdmin[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly isLoading = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly cuentas = signal<Cuenta[]>([]);
  protected readonly trabajadores = signal<SelectOption[]>([]);
  protected readonly seleccion = signal<ReadonlySet<number>>(new Set());
  protected readonly agenda = signal<Agenda | null>(null);

  protected readonly fSearch = signal('');
  protected readonly fClase = signal('');
  protected readonly fVence = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly haySeleccion = computed(() => this.seleccion().size > 0);

  // ---- modal de programación
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly lote = new FormGroup({
    fecha: new FormControl(proximoViernes(todayISO()), { nonNullable: true }),
    urgente: new FormControl(false, { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true }),
    medio_pago: new FormControl<MedioPago>('TRANSFERENCIA', { nonNullable: true }),
    id_cuenta: new FormControl<number | null>(null),
    id_programado_por: new FormControl<number | null>(null),
    items: new FormArray<ItemGroup>([]),
  });
  private readonly fechaLote = signal(proximoViernes(todayISO()));
  protected readonly fechaEsViernes = computed(() => esViernes(this.fechaLote()));

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
    this.service.getCuentas(true).subscribe({ next: (r) => this.cuentas.set(r), error: () => this.cuentas.set([]) });
    this.requerimientos.getTrabajadoresSelect().subscribe({ next: (r) => this.trabajadores.set(r), error: () => this.trabajadores.set([]) });
    this.lote.controls.fecha.valueChanges.subscribe((f) => this.fechaLote.set(f));
    this.load();
    this.loadAgenda();
  }

  protected get items(): FormArray<ItemGroup> {
    return this.lote.controls.items;
  }

  protected load(): void {
    this.isLoading.set(true);
    this.service
      .getPendientes({
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.fSearch().trim() || undefined,
        clase_documento: this.fClase() || undefined,
        vence_hasta: this.fVence() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.pendientes.set(res.data);
          this.total.set(res.total);
          this.isLoading.set(false);
        },
        error: () => {
          this.pendientes.set([]);
          this.total.set(0);
          this.isLoading.set(false);
        },
      });
  }

  protected loadAgenda(): void {
    this.service.getAgenda({ desde: addDays(this.hoy, -7), hasta: addDays(this.hoy, 90) }).subscribe({
      next: (a) => this.agenda.set(a),
      error: () => this.agenda.set(null),
    });
  }

  protected setFilter(target: 'clase' | 'vence', value: string): void {
    if (target === 'clase') this.fClase.set(value);
    else this.fVence.set(value);
    this.page.set(1);
    this.load();
  }

  protected onSearch(value: string): void {
    this.fSearch.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 350);
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

  protected alternar(id: number): void {
    const s = new Set(this.seleccion());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.seleccion.set(s);
  }

  protected estaSeleccionado(id: number): boolean {
    return this.seleccion().has(id);
  }

  // ----------------------------------------------------------------- programar
  protected abrirLote(): void {
    if (!this.permisos.crear()) return;
    this.modalError.set('');
    const elegidos = this.pendientes().filter((d) => this.seleccion().has(d.id));
    this.items.clear();
    for (const d of elegidos) {
      const p = programable(d);
      if (p.proveedor > 0.005) this.items.push(itemGroup(d, 'PROVEEDOR', p.proveedor));
      if (p.detraccion > 0.005) this.items.push(itemGroup(d, 'DETRACCION', p.detraccion));
    }
    const siguiente = proximoViernes(this.hoy);
    this.lote.patchValue({ fecha: siguiente, urgente: false, observaciones: '', medio_pago: 'TRANSFERENCIA' });
    this.fechaLote.set(siguiente);
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected programar(): void {
    if (!this.permisos.crear()) return;
    const v = this.lote.getRawValue();
    if (!v.fecha) return this.modalError.set('Elija la fecha de pago.');
    if (!esViernes(v.fecha) && !v.urgente) return this.modalError.set('Los pagos se programan los viernes. Elija un viernes o marque el pago como urgente.');
    if (v.urgente && !v.observaciones.trim()) return this.modalError.set('Indique el motivo del pago urgente.');
    const filas = v.items.filter((i) => i.incluir);
    if (filas.length === 0) return this.modalError.set('Marque al menos un pago para programar.');
    const items: ProgramacionItemPayload[] = [];
    for (const f of filas) {
      const monto = Number(f.monto);
      if (!/^\d{1,12}(\.\d{1,4})?$/.test(f.monto.trim()) || monto <= 0) return this.modalError.set(`${f.etiqueta}: el monto no es válido.`);
      if (monto > Number(f.maximo) + 0.005) return this.modalError.set(`${f.etiqueta}: el monto supera el saldo por programar (${fmtMoney(f.maximo)}).`);
      items.push({
        id_documento_origen: f.id_documento_origen,
        concepto: f.concepto,
        fecha_programada: v.fecha,
        monto: f.monto.trim(),
        medio_pago: f.concepto === 'DETRACCION' ? 'DEPOSITO' : v.medio_pago,
        id_cuenta: v.id_cuenta ?? undefined,
        urgente: v.urgente || undefined,
        observaciones: v.observaciones.trim() || undefined,
      });
    }
    this.isSaving.set(true);
    this.modalError.set('');
    this.service.programar(items, v.id_programado_por ?? undefined).subscribe({
      next: (r) => {
        this.isSaving.set(false);
        this.closeModal();
        this.seleccion.set(new Set());
        this.message.set(`${r.length} ${r.length === 1 ? 'pago programado' : 'pagos programados'} para el ${v.fecha}.`);
        this.load();
        this.loadAgenda();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.modalError.set(errorMessage(err));
      },
    });
  }

  // -------------------------------------------------------------------- agenda
  protected cancelar(p: Programacion): void {
    if (!this.permisos.anular()) return;
    if (!confirm(`¿Cancelar el pago programado de ${p.proveedor ?? 'este documento'} por ${fmtMoney(p.monto)}?`)) return;
    this.service.cancelarProgramacion(p.id).subscribe({
      next: () => {
        this.message.set('Programación cancelada: el saldo vuelve a estar disponible.');
        this.load();
        this.loadAgenda();
      },
      error: (err: unknown) => this.error.set(errorMessage(err)),
    });
  }

  protected reprogramar(p: Programacion): void {
    if (!this.permisos.editar()) return;
    const fecha = prompt('Nueva fecha de pago (AAAA-MM-DD, viernes):', p.fecha_programada);
    if (fecha === null || fecha === p.fecha_programada) return;
    this.service.reprogramar(p.id, { fecha_programada: fecha.trim() }).subscribe({
      next: () => {
        this.message.set('Pago reprogramado.');
        this.loadAgenda();
      },
      error: (err: unknown) => this.error.set(errorMessage(err)),
    });
  }
}
