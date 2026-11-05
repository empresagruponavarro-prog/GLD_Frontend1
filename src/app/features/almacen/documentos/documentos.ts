import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { opcionValida, valorDeEvento } from '@shared/utils/eventos';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { RouterLink } from '@angular/router';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';
import { SubfaseCentroCosto } from '../../presupuestos/interfaces/presupuestos.interface';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select';
import { DataTable } from '../../../shared/interfaces';
import { AlmacenService, RutaDocumento } from '../almacen.service';
import {
  Documento,
  DocumentoPayload,
  DocumentoQuery,
  MOTIVOS_CON_COSTO,
  MOTIVOS_INGRESO,
  MOTIVOS_SALIDA,
  MOTIVO_LABEL,
  Motivo,
  Naturaleza,
  SelectOption,
} from '../almacen.models';
import { errorMessage, fmtMoney, fmtNum, todayISO } from '../almacen.utils';
import { ProductoElegido, ProductoPickerComponent } from '../producto-picker/producto-picker';

interface TipoConfig {
  titulo: string;
  subtitulo: string;
  nuevo: string;
  icono: string;
  naturaleza: Naturaleza;
  ruta: RutaDocumento;
  motivos: readonly Motivo[];
}

const TIPOS: Record<RutaDocumento, TipoConfig> = {
  ingresos: {
    titulo: 'Entradas',
    subtitulo: 'Compras, devoluciones, ingresos de clientes y ajustes positivos.',
    nuevo: 'Nueva entrada',
    icono: 'fa-solid fa-arrow-right-to-bracket',
    naturaleza: 'INGRESO',
    ruta: 'ingresos',
    motivos: MOTIVOS_INGRESO,
  },
  salidas: {
    titulo: 'Salidas',
    subtitulo: 'Consumo, venta, baja o retiro definitivo. Los préstamos se registran en Préstamos de equipos.',
    nuevo: 'Nueva salida',
    icono: 'fa-solid fa-arrow-right-from-bracket',
    naturaleza: 'SALIDA',
    ruta: 'salidas',
    motivos: MOTIVOS_SALIDA,
  },
  transferencias: {
    titulo: 'Transferencias',
    subtitulo: 'Traslado de productos entre almacenes; no cambia el stock total ni el costo.',
    nuevo: 'Nueva transferencia',
    icono: 'fa-solid fa-right-left',
    naturaleza: 'TRANSFERENCIA',
    ruta: 'transferencias',
    motivos: ['TRANSFERENCIA'],
  },
  'inventario-inicial': {
    titulo: 'Inventario inicial',
    subtitulo: 'Conteo físico validado. Se registra una sola vez por producto y almacén.',
    nuevo: 'Nuevo inventario inicial',
    icono: 'fa-solid fa-clipboard-check',
    naturaleza: 'INGRESO',
    ruta: 'inventario-inicial',
    motivos: ['INVENTARIO_INICIAL'],
  },
};

const RUTAS_DOCUMENTO: readonly RutaDocumento[] = ['ingresos', 'salidas', 'transferencias', 'inventario-inicial'];
const ESTADOS_DOCUMENTO = ['REGISTRADO', 'ANULADO'] as const;
type EstadoDocumento = (typeof ESTADOS_DOCUMENTO)[number];

/** Configuración según `data.tipo` de la ruta (las rutas siempre lo declaran; si faltara, Entradas). */
function configDeRuta(tipo: unknown): TipoConfig {
  const ruta = typeof tipo === 'string' ? opcionValida(RUTAS_DOCUMENTO, tipo) : null;
  return TIPOS[ruta ?? 'ingresos'];
}

function lineaGroup() {
  return new FormGroup({
    id_producto: new FormControl<number | null>(null, { validators: [Validators.required] }),
    etiqueta: new FormControl('', { nonNullable: true }),
    unidad: new FormControl('', { nonNullable: true }),
    disponible: new FormControl('', { nonNullable: true }),
    cantidad: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{1,12}(\.\d{1,4})?$/)] }),
    costo_unitario: new FormControl('', { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true }),
    id_ppto_detalle_categoria: new FormControl<number | null>(null),
  });
}

type LineaGroup = ReturnType<typeof lineaGroup>;

@Component({
  selector: 'app-documentos-almacen',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DataTableComponent, ModalComponent, SearchSelectComponent, ProductoPickerComponent],
  templateUrl: './documentos.html',
  styleUrl: './documentos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentosAlmacenComponent {
  private readonly service = inject(AlmacenService);
  private readonly presupuestos = inject(PresupuestosService);

  protected readonly config: TipoConfig = configDeRuta(inject(ActivatedRoute).snapshot.data['tipo']);
  /**
   * Un componente para 4 rutas: el módulo sale de `data.modulo` de la ruta activa
   * (`almacen.inventario-inicial`, `.ingresos`, `.salidas`, `.transferencias`).
   * Nuevo → crear; Anular (`POST /:id/anular`) → anular. El detalle es de solo lectura.
   */
  protected readonly permisos = permisosDePantalla();
  protected readonly valorDe = valorDeEvento;
  protected readonly motivoLabel = MOTIVO_LABEL;
  protected readonly muestraOc = this.config.ruta === 'ingresos';
  protected readonly fmtNum = fmtNum;
  protected readonly fmtMoney = fmtMoney;
  protected readonly hayLineasConSubfase = (d: Documento) => (d.lineas ?? []).some((l) => !!l.subfase);
  /** PECOSA = salida por CONSUMO a una obra: es la que se imprime. */
  protected readonly esPecosa = (d: Documento) => d.naturaleza === 'SALIDA' && d.motivo === 'CONSUMO' && !!d.id_centro_costo;

  protected readonly columns: DataTable[] = [
    { label: 'Número', width: '120px' },
    { label: 'Fecha', width: '100px' },
    { label: 'Motivo', width: '150px' },
    { label: this.config.naturaleza === 'TRANSFERENCIA' ? 'Origen → destino' : 'Almacén', width: '180px' },
    { label: 'Referencia', width: '130px' },
    { label: 'Proveedor / proyecto' },
    ...(this.config.ruta === 'ingresos' ? [{ label: 'OC', width: '110px' }] : []),
    { label: 'Líneas', align: 'center', width: '70px' },
    { label: 'Estado', align: 'center', width: '110px' },
    { label: 'Acciones', align: 'center', width: '120px' },
  ];

  // Listado y filtros
  protected readonly items = signal<Documento[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly isLoading = signal(false);
  protected readonly fDesde = signal('');
  protected readonly fHasta = signal('');
  protected readonly fAlmacen = signal<number | null>(null);
  protected readonly fMotivo = signal<Motivo | ''>('');
  protected readonly fEstado = signal<EstadoDocumento | ''>('');

  // Catálogos
  protected readonly almacenes = signal<SelectOption[]>([]);
  protected readonly proveedores = signal<SelectOption[]>([]);
  protected readonly trabajadores = signal<SelectOption[]>([]);
  protected readonly centrosCostos = signal<SelectOption[]>([]);

  // Formulario
  protected readonly isFormOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly form = new FormGroup({
    fecha: new FormControl(todayISO(), { nonNullable: true, validators: [Validators.required] }),
    motivo: new FormControl<Motivo>(this.config.motivos[0], { nonNullable: true }),
    id_almacen: new FormControl<number | null>(null, { validators: [Validators.required] }),
    id_almacen_destino: new FormControl<number | null>(null),
    documento_referencia: new FormControl('', { nonNullable: true }),
    id_proveedor: new FormControl<number | null>(null),
    id_centro_costo: new FormControl<number | null>(null),
    id_recibido_por: new FormControl<number | null>(null),
    id_solicitado_por: new FormControl<number | null>(null),
    id_entregado_a: new FormControl<number | null>(null),
    motivo_trabajo: new FormControl('', { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true }),
    lineas: new FormArray<LineaGroup>([]),
  });

  private readonly motivoActual = toSignal(this.form.controls.motivo.valueChanges, { initialValue: this.form.controls.motivo.value });
  protected readonly esIngreso = this.config.naturaleza === 'INGRESO';
  protected readonly esSalida = this.config.naturaleza === 'SALIDA';
  protected readonly esTransferencia = this.config.naturaleza === 'TRANSFERENCIA';
  protected readonly esInventarioInicial = this.config.ruta === 'inventario-inicial';
  protected readonly muestraProveedor = computed(() => this.esIngreso && this.motivoActual() === 'COMPRA');
  protected readonly costoObligatorio = computed(() => MOTIVOS_CON_COSTO.includes(this.motivoActual()));
  protected readonly muestraCosto = this.esIngreso;
  protected readonly muestraProyecto = !this.esInventarioInicial && !this.esTransferencia;

  // Subfase por línea (PECOSA): solo en salidas por CONSUMO a una obra con presupuesto aprobado.
  private readonly centroCostoActual = toSignal(this.form.controls.id_centro_costo.valueChanges, { initialValue: this.form.controls.id_centro_costo.value });
  protected readonly subfases = signal<SubfaseCentroCosto[]>([]);
  /** La obra tiene un Principal aprobado: cada línea debe indicar su subfase. */
  protected readonly subfaseRequerida = signal(false);
  protected readonly opcionesSubfase = computed(() =>
    this.subfases().map((s) => ({ id: s.id, nombre: s.fase ? `${s.fase} › ${s.subfase}` : s.subfase })),
  );
  protected readonly conSubfase = computed(
    () => this.esSalida && this.motivoActual() === 'CONSUMO' && !!this.centroCostoActual() && this.subfases().length > 0,
  );
  protected readonly columnasLineas = computed(() => {
    const sub = this.conSubfase() ? ' minmax(220px, 0.9fr)' : '';
    return this.muestraCosto ? `minmax(260px, 1fr) 140px 140px${sub} 40px` : `minmax(260px, 1fr) 140px${sub} 40px`;
  });

  // Detalle
  protected readonly detail = signal<Documento | null>(null);
  protected readonly isDetailOpen = signal(false);

  constructor() {
    this.service.getAlmacenesSelect().subscribe({ next: (r) => this.almacenes.set(r), error: () => this.almacenes.set([]) });
    if (this.esIngreso && !this.esInventarioInicial) {
      this.service.getProveedoresSelect().subscribe({ next: (r) => this.proveedores.set(r), error: () => this.proveedores.set([]) });
    }
    if (!this.esTransferencia && !this.esInventarioInicial) {
      this.service.getTrabajadoresSelect().subscribe({ next: (r) => this.trabajadores.set(r), error: () => this.trabajadores.set([]) });
      this.service.getCentrosCostosSelect().subscribe({ next: (r) => this.centrosCostos.set(r), error: () => this.centrosCostos.set([]) });
    }
    if (this.esSalida) {
      this.form.controls.id_centro_costo.valueChanges.subscribe((id) => this.cargarSubfases(id));
    }
    this.load();
  }

  /** Las subfases son de la obra elegida: al cambiarla se pierden las de las líneas. */
  private cargarSubfases(idCentroCosto: number | null): void {
    this.subfases.set([]);
    this.subfaseRequerida.set(false);
    for (const l of this.lineas.controls) l.controls.id_ppto_detalle_categoria.setValue(null, { emitEvent: false });
    if (!idCentroCosto) return;
    this.presupuestos.getSubfases(idCentroCosto).subscribe({
      next: (res) => {
        this.subfases.set(res.subfases ?? []);
        this.subfaseRequerida.set(!!res.requerida);
      },
      error: () => this.subfases.set([]),
    });
  }

  protected get lineas(): FormArray<LineaGroup> {
    return this.form.controls.lineas;
  }

  // ---------------------------------------------------------------- listado
  protected load(): void {
    this.isLoading.set(true);
    const query: DocumentoQuery = {
      page: this.page(),
      pageSize: this.pageSize(),
      desde: this.fDesde() || undefined,
      hasta: this.fHasta() || undefined,
      id_almacen: this.fAlmacen() ?? undefined,
      motivo: this.fMotivo() || undefined,
      estado: this.fEstado() || undefined,
    };
    this.service.getDocumentos(this.config.ruta, query).subscribe({
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

  protected applyFilter(target: 'desde' | 'hasta' | 'almacen' | 'motivo' | 'estado', value: string): void {
    switch (target) {
      case 'desde':
        this.fDesde.set(value);
        break;
      case 'hasta':
        this.fHasta.set(value);
        break;
      case 'almacen':
        this.fAlmacen.set(value === '' ? null : Number(value));
        break;
      case 'motivo':
        this.fMotivo.set(opcionValida(this.config.motivos, value) ?? '');
        break;
      case 'estado':
        this.fEstado.set(opcionValida(ESTADOS_DOCUMENTO, value) ?? '');
        break;
    }
    this.page.set(1);
    this.load();
  }

  protected resetFilters(): void {
    this.fDesde.set('');
    this.fHasta.set('');
    this.fAlmacen.set(null);
    this.fMotivo.set('');
    this.fEstado.set('');
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

  protected contraparte(doc: Documento): string {
    if (this.esTransferencia) return '';
    return doc.proveedor ?? doc.centro_costo ?? doc.entregado_a ?? doc.recibido_por ?? '—';
  }

  // ------------------------------------------------------------ formulario
  protected openCreate(): void {
    if (!this.permisos.crear()) return;
    this.form.reset({
      fecha: todayISO(),
      motivo: this.config.motivos[0],
      id_almacen: null,
      id_almacen_destino: null,
      documento_referencia: '',
      id_proveedor: null,
      id_centro_costo: null,
      id_recibido_por: null,
      id_solicitado_por: null,
      id_entregado_a: null,
      motivo_trabajo: '',
      observaciones: '',
    });
    this.subfases.set([]);
    this.subfaseRequerida.set(false);
    this.lineas.clear();
    this.addLinea();
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  protected closeForm(): void {
    this.isFormOpen.set(false);
  }

  protected addLinea(): void {
    this.lineas.push(lineaGroup());
  }

  protected removeLinea(index: number): void {
    if (this.lineas.length > 1) this.lineas.removeAt(index);
  }

  protected onProductoPicked(linea: LineaGroup, producto: ProductoElegido): void {
    linea.patchValue({
      id_producto: producto.id,
      etiqueta: `${producto.codigo} — ${producto.descripcion}`,
      unidad: producto.unidad,
      disponible: producto.disponible,
    });
  }

  protected save(): void {
    if (!this.permisos.crear()) return;
    const error = this.validate();
    const payload = error ? null : this.buildPayload();
    if (error || !payload) {
      this.formError.set(error ?? 'Seleccione el almacén.');
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    this.formError.set('');
    this.service.createDocumento(this.config.ruta, payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeForm();
        this.load();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }

  private validate(): string | null {
    const v = this.form.getRawValue();
    if (!v.fecha) return 'Indique la fecha.';
    if (!v.id_almacen) return this.esTransferencia ? 'Seleccione el almacén de origen.' : 'Seleccione el almacén.';
    if (this.esTransferencia) {
      if (!v.id_almacen_destino) return 'Seleccione el almacén de destino.';
      if (v.id_almacen_destino === v.id_almacen) return 'El almacén de destino debe ser distinto del origen.';
    }
    const productos = new Set<string>();
    for (const [i, l] of v.lineas.entries()) {
      const n = i + 1;
      if (!l.id_producto) return `Línea ${n}: seleccione un producto.`;
      // El mismo producto puede salir a subfases distintas; no a la misma.
      const clave = `${l.id_producto}:${this.conSubfase() ? (l.id_ppto_detalle_categoria ?? 0) : 0}`;
      if (productos.has(clave)) return `Línea ${n}: el producto está repetido${this.conSubfase() && l.id_ppto_detalle_categoria ? ' en la misma subfase' : ''}.`;
      productos.add(clave);
      if (this.conSubfase() && this.subfaseRequerida() && !l.id_ppto_detalle_categoria) {
        return `Línea ${n}: la obra tiene presupuesto aprobado, indique la subfase a la que se imputa.`;
      }
      if (!/^\d{1,12}(\.\d{1,4})?$/.test(l.cantidad.trim()) || Number(l.cantidad) <= 0) return `Línea ${n}: la cantidad debe ser mayor a 0 (hasta 4 decimales).`;
      if (this.muestraCosto) {
        const costo = l.costo_unitario.trim();
        if (this.costoObligatorio() && costo === '') return `Línea ${n}: el costo unitario es obligatorio.`;
        if (costo !== '' && !/^\d{1,12}(\.\d{1,4})?$/.test(costo)) return `Línea ${n}: el costo unitario no es válido.`;
      }
    }
    return null;
  }

  /** Payload del formulario ya validado (`null` solo si falta el almacén). */
  private buildPayload(): DocumentoPayload | null {
    const v = this.form.getRawValue();
    const idAlmacen = v.id_almacen;
    if (idAlmacen === null) return null;
    const text = (s: string) => s.trim() || undefined;
    return {
      fecha: v.fecha,
      motivo: v.motivo,
      id_almacen: idAlmacen,
      id_almacen_destino: this.esTransferencia ? (v.id_almacen_destino ?? undefined) : undefined,
      documento_referencia: text(v.documento_referencia),
      id_proveedor: this.muestraProveedor() ? (v.id_proveedor ?? undefined) : undefined,
      id_centro_costo: this.muestraProyecto ? (v.id_centro_costo ?? undefined) : undefined,
      id_recibido_por: this.esIngreso && !this.esInventarioInicial ? (v.id_recibido_por ?? undefined) : undefined,
      id_solicitado_por: this.esSalida ? (v.id_solicitado_por ?? undefined) : undefined,
      id_entregado_a: this.esSalida ? (v.id_entregado_a ?? undefined) : undefined,
      motivo_trabajo: this.esSalida ? text(v.motivo_trabajo) : undefined,
      observaciones: text(v.observaciones),
      // `validate` ya exige un producto en cada línea.
      lineas: v.lineas.flatMap((l) =>
        l.id_producto === null
          ? []
          : [
              {
                id_producto: l.id_producto,
                cantidad: l.cantidad.trim(),
                costo_unitario: this.muestraCosto ? text(l.costo_unitario) : undefined,
                observaciones: text(l.observaciones),
                id_ppto_detalle_categoria: this.conSubfase() ? (l.id_ppto_detalle_categoria ?? undefined) : undefined,
              },
            ],
      ),
    };
  }

  // ---------------------------------------------------------------- detalle
  protected openDetail(doc: Documento): void {
    this.detail.set(doc);
    this.isDetailOpen.set(true);
    this.service.getDocumento(this.config.ruta, doc.id).subscribe({
      next: (full) => this.detail.set(full),
      error: (err: unknown) => alert(errorMessage(err)),
    });
  }

  protected closeDetail(): void {
    this.isDetailOpen.set(false);
    this.detail.set(null);
  }

  protected anular(doc: Documento): void {
    if (!this.permisos.anular()) return;
    if (!confirm(`¿Anular ${doc.numero}? Se generará el movimiento inverso en el kardex.`)) return;
    this.service.anularDocumento(this.config.ruta, doc.id).subscribe({
      next: () => {
        this.closeDetail();
        this.load();
      },
      error: (err: unknown) => alert(errorMessage(err)),
    });
  }
}
