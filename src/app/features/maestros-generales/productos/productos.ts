import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
import { Producto, ProductoQuery, SelectOption, TipoProducto } from './interfaces/productos.interface';
import { ProductosService } from './productos.service';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, ModalComponent],
  templateUrl: './productos.html',
  styleUrl: './productos.css',
})
export class ProductosComponent {
  private readonly service = inject(ProductosService);

  readonly tiposProducto: TipoProducto[] = ['PRODUCTO', 'SERVICIO'];

  columns: DataTable[] = [
    { label: 'ID', width: '60px' },
    { label: 'Código' },
    { label: 'Descripción' },
    { label: 'Categoría' },
    { label: 'Unidad de Medida' },
    { label: 'Tipo', align: 'center', width: '110px' },
    { label: 'Stock', align: 'right', width: '100px' },
    { label: 'Estado', align: 'center', width: '90px' },
    { label: 'Acciones', align: 'center', width: '150px' },
  ];

  // Listado
  productos = signal<Producto[]>([]);
  loading = signal<boolean>(false);
  currentPage = signal<number>(1);
  pageSize = signal<number>(20);
  totalRecords = signal<number>(0);

  // Filtros
  codigoFilter = signal<string>('');
  descripcionFilter = signal<string>('');
  tipoProductoFilter = signal<TipoProducto | ''>('');
  categoriaFilter = signal<number | null>(null);
  unidadMedidaFilter = signal<number | null>(null);
  estadoFilter = signal<boolean | null>(null);

  // Modal formulario
  showModal = signal<boolean>(false);
  saving = signal<boolean>(false);
  editingId = signal<number | null>(null);
  formData: Producto = this.emptyForm();

  // Modal detalle
  showDetail = signal<boolean>(false);
  detail = signal<Producto | null>(null);

  // Combos
  categorias = signal<SelectOption[]>([]);
  unidadesMedida = signal<SelectOption[]>([]);

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / this.pageSize())));

  private searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.loadCombos();
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.getAll(this.buildQuery()).subscribe({
      next: (res) => {
        this.productos.set(res.data ?? []);
        this.totalRecords.set(res.total ?? 0);
        this.currentPage.set(res.page ?? 1);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
        this.productos.set([]);
        this.totalRecords.set(0);
        this.loading.set(false);
      },
    });
  }

  private buildQuery(): ProductoQuery {
    return {
      page: this.currentPage(),
      pageSize: this.pageSize(),
      codigo: this.codigoFilter().trim() || undefined,
      descripcion: this.descripcionFilter().trim() || undefined,
      tipo_producto: this.tipoProductoFilter() || undefined,
      id_categoria: this.categoriaFilter() ?? undefined,
      id_unidad_medida: this.unidadMedidaFilter() ?? undefined,
      estado: this.estadoFilter() ?? undefined,
    };
  }

  onSearchCodigo(value: string) {
    this.codigoFilter.set(value);
    this.debouncedLoad();
  }

  onSearchDescripcion(value: string) {
    this.descripcionFilter.set(value);
    this.debouncedLoad();
  }

  private debouncedLoad() {
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

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load();
  }

  resetFilters() {
    this.codigoFilter.set('');
    this.descripcionFilter.set('');
    this.tipoProductoFilter.set('');
    this.categoriaFilter.set(null);
    this.unidadMedidaFilter.set(null);
    this.estadoFilter.set(null);
    this.currentPage.set(1);
    this.load();
  }

  openCreate() {
    this.editingId.set(null);
    this.formData = this.emptyForm();
    this.saving.set(false);
    this.showModal.set(true);
  }

  openEdit(item: Producto) {
    this.editingId.set(item.id);
    this.formData = { ...this.emptyForm(), ...item };
    this.saving.set(false);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
  }

  openDetail(item: Producto) {
    this.detail.set(item);
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.detail.set(null);
  }

  saveProducto() {
    const codigo = (this.formData.codigo ?? '').trim();
    const descripcion = (this.formData.descripcion ?? '').trim();

    if (!codigo) {
      alert('El campo "Código" es obligatorio.');
      return;
    }
    if (!descripcion) {
      alert('El campo "Descripción" es obligatorio.');
      return;
    }
    if (!this.formData.id_categoria) {
      alert('Debe seleccionar una Categoría.');
      return;
    }
    if (!this.formData.id_unidad_medida) {
      alert('Debe seleccionar una Unidad de Medida.');
      return;
    }

    const payload: Partial<Producto> = {
      codigo,
      descripcion,
      id_categoria: this.formData.id_categoria,
      id_unidad_medida: this.formData.id_unidad_medida,
      tipo_producto: this.formData.tipo_producto,
      stock: (this.formData.stock ?? '').trim() || '0',
      comentarios: this.formData.comentarios || null,
      imagen_url: this.formData.imagen_url || null,
      estado: this.formData.estado,
    };

    this.saving.set(true);
    const id = this.editingId();
    const request$ = id !== null ? this.service.update(id, payload) : this.service.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: (err) => {
        console.error('Error al guardar producto:', err);
        this.saving.set(false);
        alert(
          (id !== null ? 'Error al actualizar: ' : 'Error al crear: ') +
            (err.error?.message || err.message),
        );
      },
    });
  }

  deleteProducto(item: Producto) {
    const label = item.descripcion || item.codigo || `ID ${item.id}`;
    if (!confirm(`¿Desactivar el producto "${label}"? El registro quedará inactivo.`)) return;
    this.service.delete(item.id).subscribe({
      next: () => this.load(),
      error: (err) => alert('Error al desactivar: ' + (err.error?.message || err.message)),
    });
  }

  nombreCategoria(id: number | null): string {
    if (id === null || id === undefined) return '—';
    return this.categorias().find((c) => c.id === id)?.nombre ?? `ID ${id}`;
  }

  nombreUnidadMedida(id: number | null): string {
    if (id === null || id === undefined) return '—';
    return this.unidadesMedida().find((u) => u.id === id)?.nombre ?? `ID ${id}`;
  }

  private loadCombos() {
    this.service.getCategoriasSelect().subscribe({
      next: (res) => this.categorias.set(Array.isArray(res) ? res : []),
      error: () => this.categorias.set([]),
    });
    this.service.getUnidadesMedidaSelect().subscribe({
      next: (res) => this.unidadesMedida.set(Array.isArray(res) ? res : []),
      error: () => this.unidadesMedida.set([]),
    });
  }

  private emptyForm(): Producto {
    return {
      id: 0,
      codigo: '',
      descripcion: '',
      id_categoria: 0,
      id_unidad_medida: 0,
      tipo_producto: 'PRODUCTO',
      stock: '0',
      comentarios: null,
      imagen_url: null,
      estado: true,
    };
  }
}
