import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
import { errorMessage } from '../../almacen/almacen.utils';
import { CentroCostoSelect } from '../../centros-costos/interfaces/centros-costos.interface';
import { CentrosCostosService } from '../../centros-costos/centros-costos.service';
import { AnexoSelect } from '../../maestros-generales/anexos/interfaces/anexos.interface';
import { AnexosService } from '../../maestros-generales/anexos/anexos.service';
import { CategoriaSelect } from '../../maestros-generales/categorias/interfaces/categorias.interface';
import { CategoriasService } from '../../maestros-generales/categorias/categorias.service';
import { ProductoSelect, TipoProducto } from '../../maestros-generales/productos/interfaces/productos.interface';
import { ProductosService } from '../../maestros-generales/productos/productos.service';
import { FasePorCentroCosto } from '../../presupuestos/interfaces/presupuestos.interface';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';
import { Requerimiento } from '../../requerimientos/requerimientos.models';
import { RequerimientosService } from '../../requerimientos/requerimientos.service';
import { CreateDocumentoOrigen, DetalleDocumentoOrigen, DocumentoOrigen, DocumentoOrigenDetalle, DocumentoOrigenQuery, EstadoRecepcion } from './interfaces/documentos-origen.interface';
import { DocumentosOrigenService } from './documentos-origen.service';

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

@Component({
  selector: 'app-documentos-origen',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, ModalComponent],
  templateUrl: './documentos-origen.html',
  styleUrl: './documentos-origen.css'
})
export class DocumentosOrigenComponent {
  private readonly service = inject(DocumentosOrigenService);
  private readonly centrosCostosService = inject(CentrosCostosService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly anexosService = inject(AnexosService);
  private readonly productosService = inject(ProductosService);
  private readonly presupuestosService = inject(PresupuestosService);
  private readonly requerimientosService = inject(RequerimientosService);
  private readonly requerimientoInicial = inject(ActivatedRoute).snapshot.queryParamMap.get('requerimiento');

  readonly estadoRecepcionLabel: Record<EstadoRecepcion, string> = {
    PENDIENTE: 'Pendiente',
    PARCIAL: 'Parcial',
    RECIBIDA: 'Recibida',
    SIN_BIENES: 'Solo servicios',
  };

  readonly tiposOc = ['PRODUCTO', 'SERVICIO'];
  readonly formasPago = [
    'Contado',
    'Credito 45 dias',
    'Credito mayor a 45',
    'Credito 7 dias',
    'Credito 30 dias',
    'Credito 15 Dias',
    'Credito',
  ];
  readonly monedas = [
    { label: 'Soles', id: 'PEN', simbolo: 'S/' },
    { label: 'Dolares', id: 'USD', simbolo: '$' },
  ];

  centrosCostos = signal<CentroCostoSelect[]>([]);
  categorias = signal<CategoriaSelect[]>([]);
  anexos = signal<AnexoSelect[]>([]);
  productos = signal<ProductoSelect[]>([]);
  fases = signal<FasePorCentroCosto[]>([]);
  saving = signal<boolean>(false);
  editingId = signal<number | null>(null);
  formData: CreateDocumentoOrigen = this.emptyForm();
  detalles = signal<DetalleDocumentoOrigen[]>([]);

  /** Requerimiento (FUR) de origen cuando la OC nace de uno; cambia el formulario a "modo FUR". */
  furActual = signal<{ id: number; numero: string } | null>(null);
  /** La OC ya tiene recepciones en almacén: solo se puede editar la cabecera. */
  recepcionBloqueada = signal<boolean>(false);
  showFurModal = signal<boolean>(false);
  furPendientes = signal<Requerimiento[]>([]);
  furLoading = signal<boolean>(false);

  totalDetalle = computed(() =>
    this.detalles().reduce(
      (sum, d) => sum + (Number(d.cantidad) || 0) * (Number(d.precio) || 0),
      0
    )
  );

  columns: DataTable[] = [
    { label: 'Tipo OC' },
    { label: 'Tipo Costo' },
    { label: 'Centro de Costo' },
    { label: 'Período' },
    { label: 'Mes', align: 'center' },
    { label: 'Fase' },
    { label: 'Emisión' },
    { label: 'Total', align: 'right' },
    { label: 'Moneda', align: 'center' },
    { label: 'Requerimiento' },
    { label: 'Recepción', align: 'center' },
    { label: 'Usuario' },
    { label: 'Acciones', width: '110px', align: 'center' }
  ];

  items = signal<DocumentoOrigen[]>([]);
  loading = signal<boolean>(false);
  showModal = signal<boolean>(false);

  currentPage = signal<number>(1);
  pageSize = signal<number>(20);
  totalRecords = signal<number>(0);

  search = signal<string>('');
  tipoOcFilter = signal<string>('');
  periodoFilter = signal<string>('');
  mesFilter = signal<string>('');
  idCentroCostoFilter = signal<number | null>(null);
  idCategoriaFilter = signal<number | null>(null);
  idAnexoFilter = signal<number | null>(null);
  idDetalleFaseFilter = signal<number | null>(null);

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / this.pageSize())));

  activeFiltersCount = computed(() => {
    return [
      this.tipoOcFilter(),
      this.periodoFilter(),
      this.mesFilter(),
      this.idCentroCostoFilter(),
      this.idCategoriaFilter(),
      this.idAnexoFilter(),
      this.idDetalleFaseFilter()
    ].filter((value) => value !== undefined && value !== null && value !== '').length;
  });

  private searchDebounceTimer: any;

  constructor() {
    this.load();
    if (this.requerimientoInicial) this.usarRequerimiento(Number(this.requerimientoInicial));
  }

  buildFiltros(): DocumentoOrigenQuery {
    return {
      search: this.search().trim() || undefined,
      tipo_oc: this.tipoOcFilter().trim() || undefined,
      periodo: this.periodoFilter().trim() || undefined,
      mes: this.mesFilter().trim() || undefined,
      id_centro_costo: this.idCentroCostoFilter() ?? undefined,
      id_categoria: this.idCategoriaFilter() ?? undefined,
      id_anexo: this.idAnexoFilter() ?? undefined,
      id_detalle_fase_categoria: this.idDetalleFaseFilter() ?? undefined,
    };
  }

  load() {
    this.loading.set(true);
    this.service.getAll({
      page: this.currentPage(),
      pageSize: this.pageSize(),
      ...this.buildFiltros()
    }).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.totalRecords.set(res.total);
        this.currentPage.set(res.page);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.items.set([]);
        this.totalRecords.set(0);
        this.loading.set(false);
      }
    });
  }

  onSearch(value: string) {
    this.search.set(value);
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage.set(1);
      this.load();
    }, 350);
  }

  onFilterChange() {
    this.currentPage.set(1);
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.load();
    }
  }

  resetFilters() {
    this.search.set('');
    this.tipoOcFilter.set('');
    this.periodoFilter.set('');
    this.mesFilter.set('');
    this.idCentroCostoFilter.set(null);
    this.idCategoriaFilter.set(null);
    this.idAnexoFilter.set(null);
    this.idDetalleFaseFilter.set(null);
    this.currentPage.set(1);
    this.load();
  }

  openPdf(item: DocumentoOrigen) {
    if (!item.oc_pdf) return;
    let url: URL;
    try {
      url = new URL(item.oc_pdf, window.location.origin);
    } catch {
      return;
    }
    // Solo https: o rutas relativas (que resuelven al mismo origen de la app).
    const esRelativa = url.origin === window.location.origin && !/^[a-z][a-z0-9+.-]*:/i.test(item.oc_pdf.trim());
    if (url.protocol !== 'https:' && !esRelativa) return;
    window.open(url.href, '_blank', 'noopener,noreferrer');
  }

  openModal() {
    this.editingId.set(null);
    this.furActual.set(null);
    this.recepcionBloqueada.set(false);
    this.formData = this.emptyForm();
    this.detalles.set([this.emptyDetalle()]);
    this.fases.set([]);
    this.saving.set(false);
    this.showModal.set(true);
    this.loadCatalogos();
    this.loadProductos();
  }

  openEdit(item: DocumentoOrigen) {
    this.editingId.set(item.id);
    this.furActual.set(null);
    this.recepcionBloqueada.set(false);
    this.saving.set(false);
    this.showModal.set(true);
    this.loadCatalogos();

    this.service.getById(item.id).subscribe({
      next: (doc: DocumentoOrigenDetalle) => {
        const base = this.emptyForm();
        this.formData = {
          ...base,
          id_oc: item.id_oc ?? '',
          numero_oc: item.numero_oc ?? '',
          tipo_costo: item.tipo_costo ?? base.tipo_costo,
          tipo_oc: doc.tipo_oc ?? item.tipo_oc ?? base.tipo_oc,
          periodo: item.periodo ?? base.periodo,
          mes: item.mes ?? base.mes,
          fecha_emision: item.fecha_emision ?? base.fecha_emision,
          usuario: item.usuario ?? '',
          id_centro_costo: doc.id_centro_costo ?? item.id_centro_costo ?? 0,
          id_fase: doc.id_fase ?? 0,
          id_categoria: doc.id_categoria ?? item.id_categoria ?? 0,
          id_anexo: doc.id_anexo ?? item.id_anexo ?? 0,
          forma_pago: doc.forma_pago ?? item.forma_pago ?? base.forma_pago,
          moneda_id: doc.moneda_id ?? item.moneda_id ?? base.moneda_id,
          moneda_simbolo: doc.moneda_simbolo ?? item.moneda_simbolo ?? base.moneda_simbolo,
          igv: Number(doc.igv) || 0,
        };

        const detalles: DetalleDocumentoOrigen[] = (doc.detalles || []).map((d) => ({
          id_producto: Number(d.id_producto) || 0,
          cantidad: Number(d.cantidad) || 0,
          precio: Number(d.precio) || 0,
          ...(d.id_requerimiento_detalle ? { id_requerimiento_detalle: d.id_requerimiento_detalle } : {}),
          etiqueta: `${d.producto_codigo ?? ''} — ${d.producto_descripcion ?? 'Sin descripción'}`,
        }));
        this.detalles.set(detalles.length ? detalles : [this.emptyDetalle()]);
        this.recepcionBloqueada.set(doc.estado_recepcion === 'PARCIAL' || doc.estado_recepcion === 'RECIBIDA');

        if (doc.id_requerimiento) {
          this.formData.id_requerimiento = doc.id_requerimiento;
          this.furActual.set({ id: doc.id_requerimiento, numero: doc.numero_requerimiento ?? `#${doc.id_requerimiento}` });
          this.limitarPorSaldo(doc.id_requerimiento);
        }

        this.loadProductos(this.formData.tipo_oc as TipoProducto);
        if (this.formData.id_centro_costo) {
          this.loadFases(this.formData.id_centro_costo, this.formData.id_fase);
        }
      },
      error: (err) => {
        console.error(err);
        alert('No se pudo cargar el documento origen.');
        this.closeModal();
      },
    });
  }

  onCentroCostoChange(idCentroCosto: number) {
    this.formData.id_fase = 0;
    this.loadFases(idCentroCosto);
  }

  private loadFases(idCentroCosto: number, selectedId = 0) {
    this.fases.set([]);
    if (!idCentroCosto) return;
    this.presupuestosService.getFasesPorCentroCosto(idCentroCosto).subscribe({
      next: (res: any) => {
        this.fases.set(Array.isArray(res) ? res : (res?.data || []));
        if (selectedId) this.formData.id_fase = selectedId;
      },
      error: () => this.fases.set([]),
    });
  }

  closeModal() {
    this.showModal.set(false);
    this.furActual.set(null);
    this.recepcionBloqueada.set(false);
  }

  onTipoOcChange(tipoOc: string) {
    this.detalles.update((list) => list.map((d) => ({ ...d, id_producto: 0 })));
    this.loadProductos(tipoOc as TipoProducto);
  }

  addDetalle() {
    this.detalles.update((list) => [...list, this.emptyDetalle()]);
  }

  removeDetalle(index: number) {
    this.detalles.update((list) => list.filter((_, i) => i !== index));
  }

  onDetalleChange() {
    this.detalles.set([...this.detalles()]);
  }

  updateDetalle(index: number, field: 'id_producto' | 'cantidad' | 'precio', value: any) {
    const list = this.detalles();
    if (list[index]) {
      list[index][field] = value;
      this.detalles.set([...list]);
    }
  }

  onMonedaChange(monedaId: string) {
    const moneda = this.monedas.find((m) => m.id === monedaId);
    this.formData.moneda_simbolo = moneda?.simbolo ?? '';
  }

  save() {
    this.saving.set(true);

    // monto y total los calcula el servidor a partir de los detalles.
    const payload: CreateDocumentoOrigen = {
      ...this.formData,
      igv: Number(this.formData.igv) || 0,
      fecha_emision: this.formData.fecha_emision ? new Date(this.formData.fecha_emision).toISOString() : '',
      detalles: this.detalles()
        .filter((d) => d.id_producto)
        .map((d) => ({
          id_producto: Number(d.id_producto),
          cantidad: Number(d.cantidad) || 0,
          precio: Number(d.precio) || 0,
          ...(d.id_requerimiento_detalle ? { id_requerimiento_detalle: d.id_requerimiento_detalle } : {}),
        })),
    };
    if (this.furActual()) {
      const error = this.validarContraRequerimiento(payload.detalles);
      if (error) {
        this.saving.set(false);
        alert(error);
        return;
      }
    }

    const id = this.editingId();
    const request$ = id !== null
      ? this.service.update(id, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: (err) => {
        console.error(err);
        this.saving.set(false);
        alert(errorMessage(err));
      },
    });
  }

  // ---------------------------------------------------------------- desde requerimiento (FUR)

  /** Abre el selector con los requerimientos aprobados que aún tienen cantidad por ordenar. */
  openFurPicker() {
    this.showFurModal.set(true);
    this.furLoading.set(true);
    this.requerimientosService.getPendientesOc().subscribe({
      next: (rows) => {
        this.furPendientes.set(rows);
        this.furLoading.set(false);
      },
      error: (err) => {
        this.furPendientes.set([]);
        this.furLoading.set(false);
        alert(errorMessage(err));
      },
    });
  }

  closeFurPicker() {
    this.showFurModal.set(false);
  }

  /** Precarga el formulario con las líneas del FUR que todavía tienen saldo por ordenar. */
  usarRequerimiento(id: number) {
    this.showFurModal.set(false);
    this.requerimientosService.getById(id).subscribe({
      next: (fur) => {
        if (fur.estado !== 'APROBADO') {
          alert(`El requerimiento ${fur.numero} está ${fur.estado}; solo un requerimiento aprobado genera órdenes de compra.`);
          return;
        }
        const lineas = (fur.lineas ?? []).filter((l) => Number(l.saldo_por_ordenar) > 0);
        if (!lineas.length) {
          alert(`El requerimiento ${fur.numero} no tiene cantidades pendientes de ordenar.`);
          return;
        }
        const base = this.emptyForm();
        this.editingId.set(null);
        this.recepcionBloqueada.set(false);
        this.furActual.set({ id: fur.id, numero: fur.numero });
        this.formData = {
          ...base,
          id_requerimiento: fur.id,
          tipo_oc: lineas.some((l) => l.tipo_producto === 'PRODUCTO') ? 'PRODUCTO' : 'SERVICIO',
          id_centro_costo: fur.id_centro_costo,
          id_fase: 0,
        };
        this.detalles.set(
          lineas.map((l) => ({
            id_producto: l.id_producto,
            cantidad: Number(l.saldo_por_ordenar),
            precio: Number(l.precio_referencial) || 0,
            id_requerimiento_detalle: l.id,
            etiqueta: `${l.codigo} — ${l.descripcion} (${l.tipo_producto === 'PRODUCTO' ? 'producto' : 'servicio'})`,
            maximo: Number(l.saldo_por_ordenar),
          })),
        );
        this.fases.set([]);
        this.saving.set(false);
        this.showModal.set(true);
        this.loadCatalogos();
        this.loadFases(fur.id_centro_costo, fur.id_fase ?? 0);
      },
      error: (err) => alert(errorMessage(err)),
    });
  }

  /** Al editar una OC con requerimiento, el tope de cada línea es su saldo más lo que la propia OC ya ordenó. */
  private limitarPorSaldo(idRequerimiento: number) {
    this.requerimientosService.getById(idRequerimiento).subscribe({
      next: (fur) => {
        const saldoPorLinea = new Map((fur.lineas ?? []).map((l) => [l.id, Number(l.saldo_por_ordenar)]));
        this.detalles.update((list) =>
          list.map((d) =>
            d.id_requerimiento_detalle
              ? { ...d, maximo: (saldoPorLinea.get(d.id_requerimiento_detalle) ?? 0) + (Number(d.cantidad) || 0) }
              : d,
          ),
        );
      },
      error: () => undefined,
    });
  }

  private validarContraRequerimiento(detalles: DetalleDocumentoOrigen[]): string | null {
    if (!detalles.length) return 'Una OC de requerimiento necesita al menos una línea.';
    const maximos = new Map(this.detalles().map((d) => [d.id_requerimiento_detalle, d.maximo]));
    for (const d of detalles) {
      if (d.cantidad <= 0) return 'Todas las cantidades deben ser mayores a 0 (quite las líneas que no va a ordenar).';
      const tope = maximos.get(d.id_requerimiento_detalle);
      if (tope !== undefined && d.cantidad > tope) return `La cantidad ordenada (${d.cantidad}) supera el saldo aprobado del requerimiento (${tope}).`;
    }
    return null;
  }

  private loadCatalogos() {
    if (!this.centrosCostos().length) {
      this.centrosCostosService.getSelect().subscribe({
        next: (res: any) => this.centrosCostos.set(Array.isArray(res) ? res : (res?.data || [])),
        error: () => this.centrosCostos.set([]),
      });
    }
    if (!this.categorias().length) {
      this.categoriasService.getSelect().subscribe({
        next: (res: any) => this.categorias.set(Array.isArray(res) ? res : (res?.data || [])),
        error: () => this.categorias.set([]),
      });
    }
    if (!this.anexos().length) {
      this.anexosService.getSelect('Proveedor').subscribe({
        next: (res: any) => this.anexos.set(Array.isArray(res) ? res : (res?.data || [])),
        error: () => this.anexos.set([]),
      });
    }
  }

  private loadProductos(tipoProducto: TipoProducto = this.formData.tipo_oc as TipoProducto) {
    this.productosService.getSelect(tipoProducto).subscribe({
      next: (res: any) => this.productos.set(Array.isArray(res) ? res : (res?.data || [])),
      error: () => this.productos.set([]),
    });
  }

  confirmDelete(item: { id?: number; numero_oc?: string }): void {
    if (!item.id) return;
    const label = item.numero_oc ? `"${item.numero_oc}"` : `ID ${item.id}`;
    if (!confirm(`¿Eliminar el documento de origen ${label}? Esta acción no se puede deshacer.`)) return;
    this.service.delete(item.id).subscribe({
      next: () => this.load(),
      error: (err) => alert(errorMessage(err)),
    });
  }

  private emptyForm(): CreateDocumentoOrigen {
    return {
      id_oc: '',
      tipo_costo: 'DIRECTO',
      tipo_oc: 'PRODUCTO',
      numero_oc: '',
      id_centro_costo: 0,
      id_categoria: 0,
      id_fase: 0,
      periodo: new Date().getFullYear().toString(),
      mes: MESES[new Date().getMonth()],
      id_anexo: 0,
      fecha_emision: new Date().toISOString(),
      forma_pago: 'Contado',
      moneda_id: 'PEN',
      moneda_simbolo: 'S/',
      igv: 0,
      usuario: '',
      detalles: [],
    };
  }

  private emptyDetalle(): DetalleDocumentoOrigen {
    return { id_producto: 0, cantidad: 0, precio: 0 };
  }
}
