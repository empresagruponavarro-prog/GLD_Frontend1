import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
import {
  Alternativa,
  CLASE_INVENTARIO_LABEL,
  ClaseInventario,
  ESTADO_OPERATIVO_LABEL,
  EstadoOperativo,
  FamiliaOption,
  Producto,
  ProductoQuery,
  SelectOption,
  TipoProducto,
} from './interfaces/productos.interface';
import { ProductoElegido, ProductoPickerComponent } from '../../almacen/producto-picker/producto-picker';
import { ProductosService } from './productos.service';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, ModalComponent, ProductoPickerComponent],
  templateUrl: './productos.html',
  styleUrl: './productos.css',
})
export class ProductosComponent {
  private readonly service = inject(ProductosService);

  readonly tiposProducto: TipoProducto[] = ['PRODUCTO', 'SERVICIO'];
  readonly claseLabel = CLASE_INVENTARIO_LABEL;
  readonly estadoOperativoLabel = ESTADO_OPERATIVO_LABEL;
  readonly clases = Object.keys(CLASE_INVENTARIO_LABEL) as ClaseInventario[];
  readonly estadosOperativos = Object.keys(ESTADO_OPERATIVO_LABEL) as EstadoOperativo[];
  readonly prioridades = [1, 2, 3] as const;

  columns: DataTable[] = [
    { label: 'ID', width: '60px' },
    { label: 'Código' },
    { label: 'Descripción' },
    { label: 'Categoría' },
    { label: 'Unidad de Medida' },
    { label: 'Tipo', align: 'center', width: '110px' },
    { label: 'Clase', width: '130px' },
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
  familias = signal<FamiliaOption[]>([]);
  almacenes = signal<SelectOption[]>([]);

  // Alternativas (hasta 3), solo al editar. Índice = prioridad - 1.
  alternativas = signal<(Alternativa | null)[]>([null, null, null]);

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
    this.alternativas.set([null, null, null]);
    this.saving.set(false);
    this.showModal.set(true);
  }

  openEdit(item: Producto) {
    this.editingId.set(item.id);
    this.formData = { ...this.emptyForm(), ...item };
    this.saving.set(false);
    this.alternativas.set([null, null, null]);
    this.service.getAlternativas(item.id).subscribe({
      next: (alts) => {
        const slots: (Alternativa | null)[] = [null, null, null];
        for (const a of alts) slots[a.prioridad - 1] = a;
        this.alternativas.set(slots);
      },
      error: () => this.alternativas.set([null, null, null]),
    });
    this.showModal.set(true);
  }

  onAlternativaPicked(prioridad: number, p: ProductoElegido) {
    if (this.editingId() === p.id) {
      alert('Un producto no puede ser alternativa de sí mismo.');
      return;
    }
    const slots = [...this.alternativas()];
    slots[prioridad - 1] = {
      id_producto_alternativo: p.id,
      prioridad,
      codigo: p.codigo,
      descripcion: p.descripcion,
    };
    this.alternativas.set(slots);
  }

  clearAlternativa(prioridad: number) {
    const slots = [...this.alternativas()];
    slots[prioridad - 1] = null;
    this.alternativas.set(slots);
  }

  alternativaLabel(prioridad: number): string {
    const a = this.alternativas()[prioridad - 1];
    return a ? `${a.codigo} — ${a.descripcion}` : '';
  }

  onFamiliaChange() {
    // El código es automático cuando hay familia; se limpia el que se haya escrito.
    if (this.formData.id_familia) this.formData.codigo = '';
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
    const editing = this.editingId() !== null;
    const codigoAutomatico = !!this.formData.id_familia;

    if (!codigoAutomatico && !codigo) {
      alert('El campo "Código" es obligatorio (o elija una Familia para generarlo automáticamente).');
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

    for (const [campo, valor] of [
      ['Stock mínimo', this.formData.stock_minimo],
      ['Stock objetivo', this.formData.stock_objetivo],
    ] as const) {
      if (!/^\d+(\.\d+)?$/.test((valor ?? '').trim() || '0')) {
        alert(`"${campo}" debe ser un número válido.`);
        return;
      }
    }

    // El stock y el costo promedio los mueve el control de almacén: nunca se envían.
    const payload: Partial<Producto> = {
      descripcion,
      id_categoria: this.formData.id_categoria,
      id_unidad_medida: this.formData.id_unidad_medida,
      tipo_producto: this.formData.tipo_producto,
      clase_inventario: this.formData.clase_inventario,
      uso_principal: this.formData.uso_principal || null,
      stock_minimo: (this.formData.stock_minimo ?? '').trim() || '0',
      stock_objetivo: (this.formData.stock_objetivo ?? '').trim() || '0',
      estado_operativo: this.formData.estado_operativo,
      id_almacen_default: this.formData.id_almacen_default || null,
      comentarios: this.formData.comentarios || null,
      imagen_url: this.formData.imagen_url || null,
      estado: this.formData.estado,
    };
    if (!editing) {
      if (codigoAutomatico) payload.id_familia = this.formData.id_familia;
      else payload.codigo = codigo;
    } else if (!this.formData.id_familia) {
      payload.codigo = codigo;
    }

    this.saving.set(true);
    const id = this.editingId();
    const request$ = id !== null ? this.service.update(id, payload) : this.service.create(payload);

    request$.subscribe({
      next: (saved) => {
        const productoId = id ?? saved.id;
        const pares = this.alternativas()
          .filter((a): a is Alternativa => a !== null)
          .map((a) => ({ id_producto_alternativo: a.id_producto_alternativo, prioridad: a.prioridad }));
        // Solo se tocan las alternativas al editar (o si se eligieron al crear).
        if (id === null && pares.length === 0) {
          this.finishSave();
          return;
        }
        this.service.replaceAlternativas(productoId, pares).subscribe({
          next: () => this.finishSave(),
          error: (err) => {
            this.finishSave();
            alert('El producto se guardó, pero no las alternativas: ' + (err.error?.message || err.message));
          },
        });
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

  private finishSave() {
    this.saving.set(false);
    this.closeModal();
    this.load();
  }

  nombreFamilia(id: number | null): string {
    if (id === null || id === undefined) return '—';
    return this.familias().find((f) => f.id === id)?.nombre ?? `ID ${id}`;
  }

  nombreAlmacen(id: number | null): string {
    if (id === null || id === undefined) return '—';
    return this.almacenes().find((a) => a.id === id)?.nombre ?? `ID ${id}`;
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
    this.service.getFamiliasSelect().subscribe({
      next: (res) => this.familias.set(Array.isArray(res) ? res : []),
      error: () => this.familias.set([]),
    });
    this.service.getAlmacenesSelect().subscribe({
      next: (res) => this.almacenes.set(Array.isArray(res) ? res : []),
      error: () => this.almacenes.set([]),
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
      id_familia: null,
      clase_inventario: 'CONSUMIBLE',
      uso_principal: null,
      stock_minimo: '0',
      stock_objetivo: '0',
      estado_operativo: 'NORMAL',
      id_almacen_default: null,
      costo_promedio: '0',
      comentarios: null,
      imagen_url: null,
      estado: true,
    };
  }
}
