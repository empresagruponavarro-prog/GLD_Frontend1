import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
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
import { CreateDocumentoOrigen, DetalleDocumentoOrigen, DocumentoOrigen, DocumentoOrigenDetalle, DocumentoOrigenQuery } from './interfaces/documentos-origen.interface';
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
    window.open(item.oc_pdf, '_blank');
  }

  openModal() {
    this.editingId.set(null);
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
          monto: Number(doc.monto) || 0,
          igv: Number(doc.igv) || 0,
          total: Number(doc.total) || 0,
        };

        const detalles = (doc.detalles || []).map((d) => ({
          id_producto: Number(d.id_producto) || 0,
          cantidad: Number(d.cantidad) || 0,
          precio: Number(d.precio) || 0,
        }));
        this.detalles.set(detalles.length ? detalles : [this.emptyDetalle()]);

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

  updateDetalle(index: number, field: 'id_producto' | 'cantidad' | 'precio', value: number) {
    this.detalles.update((list) =>
      list.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  }

  onMonedaChange(monedaId: string) {
    const moneda = this.monedas.find((m) => m.id === monedaId);
    this.formData.moneda_simbolo = moneda?.simbolo ?? '';
  }

  recalcTotal() {
    const monto = Number(this.formData.monto) || 0;
    const igv = Number(this.formData.igv) || 0;
    this.formData.total = Number((monto + igv).toFixed(2));
  }

  save() {
    this.recalcTotal();
    this.saving.set(true);

    const payload: CreateDocumentoOrigen = {
      ...this.formData,
      monto: Number(this.formData.monto) || 0,
      igv: Number(this.formData.igv) || 0,
      total: Number(this.formData.total) || 0,
      fecha_emision: this.formData.fecha_emision ? new Date(this.formData.fecha_emision).toISOString() : '',
      detalles: this.detalles()
        .filter((d) => d.id_producto)
        .map((d) => ({
          id_producto: Number(d.id_producto),
          cantidad: Number(d.cantidad) || 0,
          precio: Number(d.precio) || 0,
        })),
    };

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
        alert(id !== null ? 'Error al actualizar el documento origen.' : 'Error al crear el documento origen.');
      },
    });
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
      error: () => alert('Error al eliminar el documento de origen.'),
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
      monto: 0,
      igv: 0,
      total: 0,
      usuario: '',
      detalles: [],
    };
  }

  private emptyDetalle(): DetalleDocumentoOrigen {
    return { id_producto: 0, cantidad: 0, precio: 0 };
  }
}
