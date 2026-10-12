import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select';
import { DataTable } from '../../../shared/interfaces';
import { errorMessage, fmtMoney, fmtNum, todayISO } from '../../almacen/almacen.utils';
import { Area, SelectOption } from '../../requerimientos/requerimientos.models';
import { RequerimientosService } from '../../requerimientos/requerimientos.service';
import { AdministracionDocumentosService } from './administracion.service';
import {
  CLASES_DIRECTAS,
  CLASES_DOCUMENTO,
  CLASE_LABEL,
  ClaseDocumento,
  DeduccionesPayload,
  DocumentoAdmin,
  DocumentoDetalle,
  DocumentoDirectoPayload,
  DocumentoQuery,
  ESTADOS_PAGO,
  ESTADO_PAGO_LABEL,
  EstadoPago,
  estadoPagoBadge,
} from './administracion.models';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Documentos de origen del módulo administrativo: compromisos de pago, deducciones, estado de pago y expediente. */
@Component({
  selector: 'app-documentos-administracion',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DataTableComponent, ModalComponent, SearchSelectComponent],
  templateUrl: './administracion.html',
  styleUrl: './administracion.css',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentosAdministracionComponent {
  private readonly service = inject(AdministracionDocumentosService);
  private readonly requerimientos = inject(RequerimientosService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  protected readonly fmtMoney = fmtMoney;
  protected readonly fmtNum = fmtNum;
  protected readonly estadoPagoBadge = estadoPagoBadge;
  protected readonly estadosPago = ESTADOS_PAGO;
  protected readonly estadoPagoLabel = ESTADO_PAGO_LABEL;
  protected readonly clases = CLASES_DOCUMENTO;
  protected readonly clasesDirectas = CLASES_DIRECTAS;
  protected readonly claseLabel = CLASE_LABEL;

  protected readonly columns: DataTable[] = [
    { label: 'Documento', width: '170px' },
    { label: 'Proveedor / beneficiario' },
    { label: 'Centro de costos / área', width: '190px' },
    { label: 'Emisión', width: '95px' },
    { label: 'Total', align: 'right', width: '110px' },
    { label: 'Neto a pagar', align: 'right', width: '120px' },
    { label: 'Saldo', align: 'right', width: '110px' },
    { label: 'Vence', width: '110px' },
    { label: 'Estado de pago', align: 'center', width: '140px' },
    { label: 'Acciones', align: 'center', width: '80px' },
  ];

  protected readonly items = signal<DocumentoAdmin[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly isLoading = signal(false);
  protected readonly message = signal('');
  protected readonly areas = signal<Area[]>([]);
  protected readonly anexos = signal<SelectOption[]>([]);
  protected readonly centrosCostos = signal<SelectOption[]>([]);

  // ---- filtros
  protected readonly fSearch = signal('');
  protected readonly fClase = signal<ClaseDocumento | ''>('');
  protected readonly fEstadoPago = signal<EstadoPago | ''>('');
  protected readonly fEstado = signal<'REGISTRADO' | 'ANULADO' | ''>('');
  protected readonly fArea = signal('');
  protected readonly fDesde = signal('');
  protected readonly fHasta = signal('');
  protected readonly fVence = signal('');
  protected readonly fMontoMin = signal('');
  protected readonly fMontoMax = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private fRequerimiento: number | undefined;

  // ---- detalle
  protected readonly detalle = signal<DocumentoDetalle | null>(null);
  protected readonly isDetalleOpen = signal(false);
  protected readonly detalleError = signal('');
  protected readonly isSavingDetalle = signal(false);
  protected readonly esAnulado = computed(() => this.detalle()?.estado === 'ANULADO');
  protected readonly tienePagos = computed(() => (this.detalle()?.pagos ?? []).some((p) => p.estado === 'REGISTRADO'));

  protected readonly deducciones = new FormGroup({
    renta_4ta: new FormControl('0', { nonNullable: true }),
    dscto_compras: new FormControl('0', { nonNullable: true }),
    dscto_intervencion: new FormControl('0', { nonNullable: true }),
    dscto_otros: new FormControl('0', { nonNullable: true }),
    detraccion_porcentaje: new FormControl('', { nonNullable: true }),
    retencion_auto: new FormControl(true, { nonNullable: true }),
    retencion_monto: new FormControl('', { nonNullable: true }),
    afecto_igv: new FormControl(true, { nonNullable: true }),
    dias_credito: new FormControl('', { nonNullable: true }),
    fecha_vencimiento: new FormControl('', { nonNullable: true }),
    id_area: new FormControl<number | null>(null),
  });

  // ---- registro directo
  protected readonly isDirectoOpen = signal(false);
  protected readonly isSavingDirecto = signal(false);
  protected readonly directoError = signal('');
  protected readonly directo = new FormGroup({
    clase_documento: new FormControl<ClaseDocumento>('PAGO_SERVICIO', { nonNullable: true }),
    id_anexo: new FormControl<number | null>(null, { validators: [Validators.required] }),
    concepto: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    monto: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(DECIMAL)] }),
    afecto_igv: new FormControl(true, { nonNullable: true }),
    moneda_id: new FormControl<'PEN' | 'USD'>('PEN', { nonNullable: true }),
    fecha_emision: new FormControl(todayISO(), { nonNullable: true, validators: [Validators.required] }),
    forma_pago: new FormControl('Contado', { nonNullable: true }),
    dias_credito: new FormControl('', { nonNullable: true }),
    fecha_vencimiento: new FormControl('', { nonNullable: true }),
    id_centro_costo: new FormControl<number | null>(null),
    id_area: new FormControl<number | null>(null),
    detraccion_porcentaje: new FormControl('', { nonNullable: true }),
    renta_4ta: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
    this.deducciones.controls.retencion_auto.valueChanges.subscribe(() => this.sincronizarRetencion());
    this.requerimientos.getAreas().subscribe({ next: (r) => this.areas.set(r), error: () => this.areas.set([]) });
    this.requerimientos.getAnexosSelect().subscribe({ next: (r) => this.anexos.set(r), error: () => this.anexos.set([]) });
    this.requerimientos.getCentrosCostosSelect().subscribe({ next: (r) => this.centrosCostos.set(r), error: () => this.centrosCostos.set([]) });

    const params = this.route.snapshot.queryParamMap;
    const req = Number(params.get('requerimiento'));
    if (req) this.fRequerimiento = req;
    this.load();
    const doc = Number(params.get('documento'));
    if (doc) this.abrir(doc);
  }

  protected load(): void {
    this.isLoading.set(true);
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
    const query: DocumentoQuery = {
      page: this.page(),
      pageSize: this.pageSize(),
      search: this.fSearch().trim() || undefined,
      clase_documento: this.fClase() || undefined,
      estado_pago: this.fEstadoPago() || undefined,
      estado: this.fEstado() || undefined,
      id_area: num(this.fArea()),
      fecha_desde: this.fDesde() || undefined,
      fecha_hasta: this.fHasta() || undefined,
      vence_hasta: this.fVence() || undefined,
      monto_min: num(this.fMontoMin()),
      monto_max: num(this.fMontoMax()),
      id_requerimiento: this.fRequerimiento,
    };
    this.service.getAll(query).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.total.set(res.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.total.set(0);
        this.isLoading.set(false);
      },
    });
  }

  protected setFilter(target: 'clase' | 'estadoPago' | 'estado' | 'area' | 'desde' | 'hasta' | 'vence' | 'min' | 'max', value: string): void {
    switch (target) {
      case 'clase': this.fClase.set(value as ClaseDocumento | ''); break;
      case 'estadoPago': this.fEstadoPago.set(value as EstadoPago | ''); break;
      case 'estado': this.fEstado.set(value as 'REGISTRADO' | 'ANULADO' | ''); break;
      case 'area': this.fArea.set(value); break;
      case 'desde': this.fDesde.set(value); break;
      case 'hasta': this.fHasta.set(value); break;
      case 'vence': this.fVence.set(value); break;
      case 'min': this.fMontoMin.set(value); break;
      case 'max': this.fMontoMax.set(value); break;
    }
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

  protected resetFilters(): void {
    for (const s of [this.fSearch, this.fArea, this.fDesde, this.fHasta, this.fVence, this.fMontoMin, this.fMontoMax]) s.set('');
    this.fClase.set('');
    this.fEstadoPago.set('');
    this.fEstado.set('');
    this.fRequerimiento = undefined;
    this.page.set(1);
    this.load();
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

  // ------------------------------------------------------------------- detalle
  protected abrir(id: number): void {
    this.detalleError.set('');
    this.detalle.set(null);
    this.isDetalleOpen.set(true);
    this.service.getById(id).subscribe({
      next: (d) => this.mostrar(d),
      error: (err) => this.detalleError.set(errorMessage(err)),
    });
  }

  private mostrar(d: DocumentoDetalle): void {
    this.detalle.set(d);
    this.deducciones.reset({
      renta_4ta: d.renta_4ta,
      dscto_compras: d.dscto_compras,
      dscto_intervencion: d.dscto_intervencion,
      dscto_otros: d.dscto_otros,
      detraccion_porcentaje: d.detraccion_porcentaje ?? '',
      retencion_auto: !d.retencion_manual,
      retencion_monto: d.retencion_monto ?? '',
      afecto_igv: d.afecto_igv,
      dias_credito: d.dias_credito === null ? '' : String(d.dias_credito),
      fecha_vencimiento: d.fecha_vencimiento_manual ?? '',
      id_area: d.id_area,
    });
    // Con pagos registrados los montos quedan fijos: solo se editan crédito, vencimiento y área.
    const bloqueados = d.pagos.some((p) => p.estado === 'REGISTRADO');
    const montos = ['renta_4ta', 'dscto_compras', 'dscto_intervencion', 'dscto_otros', 'detraccion_porcentaje', 'retencion_auto', 'afecto_igv'] as const;
    for (const k of montos) {
      if (bloqueados) this.deducciones.controls[k].disable({ emitEvent: false });
      else this.deducciones.controls[k].enable({ emitEvent: false });
    }
    this.sincronizarRetencion(bloqueados);
  }

  /** El monto de la retención solo se escribe a mano si no es automática y no hay pagos. */
  private sincronizarRetencion(bloqueados = this.tienePagos()): void {
    const c = this.deducciones.controls;
    if (bloqueados || c.retencion_auto.value) c.retencion_monto.disable({ emitEvent: false });
    else c.retencion_monto.enable({ emitEvent: false });
  }

  protected cerrarDetalle(): void {
    this.isDetalleOpen.set(false);
    this.detalle.set(null);
  }

  protected guardarDeducciones(): void {
    const d = this.detalle();
    if (!d) return;
    const v = this.deducciones.getRawValue();
    const monto = (s: string) => (s.trim() === '' ? 0 : Number(s));
    for (const [nombre, valor] of [['Renta 4.ª', v.renta_4ta], ['Descuento de compras', v.dscto_compras], ['Descuento de intervención', v.dscto_intervencion], ['Otros descuentos', v.dscto_otros]] as const) {
      if (valor.trim() !== '' && !DECIMAL.test(valor.trim())) return this.detalleError.set(`${nombre}: monto no válido.`);
    }
    if (v.detraccion_porcentaje.trim() !== '' && !DECIMAL.test(v.detraccion_porcentaje.trim())) return this.detalleError.set('El % de detracción no es válido.');
    if (!v.retencion_auto && !DECIMAL.test(v.retencion_monto.trim() || 'x')) return this.detalleError.set('Indique el monto de la retención o márquela como automática.');
    if (v.fecha_vencimiento && !FECHA.test(v.fecha_vencimiento)) return this.detalleError.set('La fecha de vencimiento no es válida.');

    const payload: DeduccionesPayload = {
      renta_4ta: monto(v.renta_4ta),
      dscto_compras: monto(v.dscto_compras),
      dscto_intervencion: monto(v.dscto_intervencion),
      dscto_otros: monto(v.dscto_otros),
      detraccion_porcentaje: v.detraccion_porcentaje.trim() === '' ? 0 : Number(v.detraccion_porcentaje),
      retencion_monto: v.retencion_auto ? null : Number(v.retencion_monto),
      afecto_igv: v.afecto_igv,
      fecha_vencimiento: v.fecha_vencimiento,
      id_area: v.id_area ?? undefined,
    };
    if (v.dias_credito.trim() !== '') payload.dias_credito = Number(v.dias_credito);
    this.isSavingDetalle.set(true);
    this.detalleError.set('');
    this.service.actualizarDeducciones(d.id, payload).subscribe({
      next: (res) => {
        this.isSavingDetalle.set(false);
        this.mostrar(res);
        this.message.set(`${res.numero_documento ?? 'Documento'} actualizado.`);
        this.load();
      },
      error: (err) => {
        this.isSavingDetalle.set(false);
        this.detalleError.set(errorMessage(err));
      },
    });
  }

  protected anular(): void {
    const d = this.detalle();
    if (!d) return;
    const motivo = prompt(`¿Anular ${d.numero_documento ?? 'el documento'}? Indique el motivo:`);
    if (motivo === null) return;
    this.service.anular(d.id, motivo.trim() || undefined).subscribe({
      next: (res) => {
        this.mostrar(res);
        this.message.set(`${res.numero_documento ?? 'Documento'} anulado.`);
        this.load();
      },
      error: (err) => this.detalleError.set(errorMessage(err)),
    });
  }

  // ------------------------------------------------------------ registro directo
  protected nuevoDirecto(): void {
    this.directoError.set('');
    this.directo.reset({
      clase_documento: 'PAGO_SERVICIO',
      afecto_igv: true,
      moneda_id: 'PEN',
      fecha_emision: todayISO(),
      forma_pago: 'Contado',
    });
    this.isDirectoOpen.set(true);
  }

  protected cerrarDirecto(): void {
    this.isDirectoOpen.set(false);
  }

  protected guardarDirecto(): void {
    const v = this.directo.getRawValue();
    if (!v.id_anexo) return this.directoError.set('Seleccione al proveedor o beneficiario.');
    if (!v.concepto.trim()) return this.directoError.set('Indique el concepto.');
    if (!DECIMAL.test(v.monto.trim()) || Number(v.monto) <= 0) return this.directoError.set('El monto (sin IGV) debe ser mayor a 0.');
    if (v.fecha_vencimiento && !FECHA.test(v.fecha_vencimiento)) return this.directoError.set('La fecha de vencimiento no es válida.');
    const texto = (s: string) => s.trim() || undefined;
    const numero = (s: string) => (s.trim() === '' ? undefined : Number(s));
    const payload: DocumentoDirectoPayload = {
      clase_documento: v.clase_documento,
      id_anexo: v.id_anexo,
      concepto: v.concepto.trim(),
      monto: v.monto.trim(),
      fecha_emision: v.fecha_emision,
      afecto_igv: v.afecto_igv,
      id_centro_costo: v.id_centro_costo ?? undefined,
      id_area: v.id_area ?? undefined,
      moneda_id: v.moneda_id,
      moneda_simbolo: v.moneda_id === 'USD' ? '$' : 'S/',
      forma_pago: texto(v.forma_pago),
      dias_credito: numero(v.dias_credito),
      fecha_vencimiento: texto(v.fecha_vencimiento),
      detraccion_porcentaje: numero(v.detraccion_porcentaje),
      renta_4ta: numero(v.renta_4ta),
    };
    this.isSavingDirecto.set(true);
    this.directoError.set('');
    this.service.crearDirecto(payload).subscribe({
      next: (d) => {
        this.isSavingDirecto.set(false);
        this.cerrarDirecto();
        this.message.set(`${d.numero_documento ?? 'Documento'} registrado.`);
        this.load();
        this.abrir(d.id);
      },
      error: (err) => {
        this.isSavingDirecto.set(false);
        this.directoError.set(errorMessage(err));
      },
    });
  }
}
