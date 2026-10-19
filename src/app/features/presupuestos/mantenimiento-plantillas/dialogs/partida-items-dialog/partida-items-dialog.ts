import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import {
  PresupuestosService,
  PartidaItemsResponse,
  SyncPartidaItemsDto,
} from '@app/features/presupuestos/presupuestos.service';
import { ProductosService } from '@app/features/maestros-generales/productos/productos.service';
import {
  Producto,
  SelectOption,
  TipoProducto,
} from '@app/features/maestros-generales/productos/interfaces/productos.interface';

/** Fila editable de ítem en el diálogo. */
export interface ItemFila {
  id?: number;
  Item: string;
  id_producto: number;
  codigo_producto: string;
  descripcion_producto: string;
  tipo_producto: TipoProducto;
  categoria_producto?: string | null;
  id_categoria?: number;
  id_unidad_medida: number;
  simbolo_unidad?: string | null;
  Cantidad: number;
  CostoUnitario: number;
  PrecioVenta: number;
  // Campos calculados
  CostoTotal: number;
  VentaTotal: number;
}

export interface PartidaInfo {
  id: number;
  IdpptoFaseCategoria: string;
  NombreCategoria?: string;
  NombreFase?: string;
}

export interface GuardadoEvent {
  idPartida: number;
  costoTotal: number;
  ventaTotal: number;
  totalItems: number;
}

function redondear(n: number): number {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}

@Component({
  selector: 'app-partida-items-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './partida-items-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartidaItemsDialogComponent implements OnInit {
  private presupuestosService = inject(PresupuestosService);
  private productosService = inject(ProductosService);

  @Input({ required: true }) partida!: PartidaInfo;
  @Input() soloLectura = false;
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<GuardadoEvent>();

  // Estado del diálogo
  cargando = signal(true);
  guardando = signal(false);
  errorMensaje = signal<string | null>(null);
  filas = signal<ItemFila[]>([]);
  unidadesMedida = signal<SelectOption[]>([]);
  categorias = signal<SelectOption[]>([]);

  // Búsqueda interactiva de productos para selector rápido
  busquedaProducto = signal('');
  resultadosBusqueda = signal<Producto[]>([]);
  buscandoProductos = signal(false);
  mostrarResultados = signal(false);
  indiceFilaSeleccionando = signal<number | null>(null);
  private searchSubject = new Subject<string>();

  // Totales calculados
  totales = computed(() => {
    let costo = 0;
    for (const f of this.filas()) {
      costo += f.CostoTotal;
    }
    const c = redondear(costo);
    return {
      costoTotal: c,
      cantidadFilas: this.filas().length,
    };
  });

  ngOnInit(): void {
    this.cargarUnidades();
    this.cargarCategorias();
    this.cargarItems();
    this.configurarBuscador();
  }

  private cargarUnidades(): void {
    this.productosService.getUnidadesMedidaSelect().subscribe({
      next: (res) => this.unidadesMedida.set(res || []),
      error: (err) => console.error('Error cargando unidades de medida:', err),
    });
  }

  private cargarCategorias(): void {
    this.productosService.getCategoriasSelect().subscribe({
      next: (res) => this.categorias.set(res || []),
      error: (err) => console.error('Error cargando categorías:', err),
    });
  }

  cargarItems(): void {
    this.cargando.set(true);
    this.errorMensaje.set(null);
    this.presupuestosService.getPartidaItems(this.partida.id).subscribe({
      next: (res: PartidaItemsResponse) => {
        const convertidas: ItemFila[] = (res.items || []).map((it) => {
          const cant = redondear(it.Cantidad);
          const cu = redondear(it.CostoUnitario);
          const pv = redondear(it.PrecioVenta);
          return {
            id: it.id,
            Item: it.Item || '',
            id_producto: it.id_producto,
            codigo_producto: it.producto?.codigo || '',
            descripcion_producto: it.producto?.descripcion || '',
            tipo_producto: it.producto?.tipo_producto || 'PRODUCTO',
            categoria_producto: it.producto?.categoria,
            id_categoria: it.producto?.id_categoria,
            id_unidad_medida: it.id_unidad_medida,
            simbolo_unidad: it.unidad?.simbolo || it.unidad?.codigo,
            Cantidad: cant,
            CostoUnitario: cu,
            PrecioVenta: pv,
            CostoTotal: redondear(cant * cu),
            VentaTotal: redondear(cant * pv),
          };
        });
        this.filas.set(convertidas);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorMensaje.set('Error cargando ítems: ' + (err.error?.message || err.message));
      },
    });
  }

  private configurarBuscador(): void {
    this.searchSubject
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.trim().length < 2) {
            this.buscandoProductos.set(false);
            return of([]);
          }
          this.buscandoProductos.set(true);
          return this.productosService.getAll({ descripcion: term.trim(), pageSize: 25 });
        }),
      )
      .subscribe({
        next: (res) => {
          this.buscandoProductos.set(false);
          const data: Producto[] = Array.isArray(res) ? res : res.data || [];
          this.resultadosBusqueda.set(data);
          this.mostrarResultados.set(data.length > 0);
        },
        error: () => {
          this.buscandoProductos.set(false);
          this.resultadosBusqueda.set([]);
        },
      });
  }

  onBuscarInput(term: string, indexFila: number): void {
    this.indiceFilaSeleccionando.set(indexFila);
    this.busquedaProducto.set(term);
    this.searchSubject.next(term);
  }

  seleccionarProducto(producto: Producto, indexFila: number): void {
    const list = [...this.filas()];
    const fila = list[indexFila];
    if (!fila) return;

    fila.id_producto = producto.id;
    fila.codigo_producto = producto.codigo;
    fila.descripcion_producto = producto.descripcion;
    fila.tipo_producto = producto.tipo_producto;
    fila.id_categoria = producto.id_categoria;
    const cat = this.categorias().find((opt) => opt.id === producto.id_categoria);
    fila.categoria_producto = cat?.nombre || '';
    fila.id_unidad_medida = producto.id_unidad_medida;
    const u = this.unidadesMedida().find((opt) => opt.id === producto.id_unidad_medida);
    fila.simbolo_unidad = u?.nombre || '';

    this.filas.set(list);
    this.mostrarResultados.set(false);
    this.indiceFilaSeleccionando.set(null);
    this.busquedaProducto.set('');
  }

  onCambiarCategoria(fila: ItemFila, valor: unknown): void {
    const idCat = valor && valor !== 'undefined' ? Number(valor) : undefined;
    fila.id_categoria = idCat;
    const cat = this.categorias().find((opt) => opt.id === idCat);
    fila.categoria_producto = cat?.nombre || '';
    this.filas.set([...this.filas()]);
  }

  cerrarDropdown(): void {
    setTimeout(() => {
      this.mostrarResultados.set(false);
      this.indiceFilaSeleccionando.set(null);
    }, 200);
  }

  recalcularFila(fila: ItemFila): void {
    const cant = redondear(fila.Cantidad);
    const cu = redondear(fila.CostoUnitario);
    const pv = redondear(fila.PrecioVenta);
    fila.CostoTotal = redondear(cant * cu);
    fila.VentaTotal = redondear(cant * pv);
    this.filas.set([...this.filas()]);
  }

  agregarFila(): void {
    if (this.soloLectura) return;
    const unidadDefault = this.unidadesMedida()[0];
    const catDefault = this.categorias()[0];
    const nueva: ItemFila = {
      Item: '',
      id_producto: 0,
      codigo_producto: '',
      descripcion_producto: '',
      tipo_producto: 'PRODUCTO',
      id_categoria: catDefault ? catDefault.id : undefined,
      categoria_producto: catDefault ? catDefault.nombre : '',
      id_unidad_medida: unidadDefault ? unidadDefault.id : 1,
      simbolo_unidad: unidadDefault ? unidadDefault.nombre : 'UND',
      Cantidad: 1,
      CostoUnitario: 0,
      PrecioVenta: 0,
      CostoTotal: 0,
      VentaTotal: 0,
    };
    this.filas.set([...this.filas(), nueva]);
  }

  duplicarFila(index: number): void {
    if (this.soloLectura) return;
    const origen = this.filas()[index];
    if (!origen) return;
    const clon: ItemFila = {
      ...origen,
      id: undefined, // nuevo ítem
    };
    const list = [...this.filas()];
    list.splice(index + 1, 0, clon);
    this.filas.set(list);
  }

  eliminarFila(index: number): void {
    if (this.soloLectura) return;
    const list = [...this.filas()];
    list.splice(index, 1);
    this.filas.set(list);
  }

  guardar(): void {
    if (this.soloLectura || this.guardando()) return;
    this.errorMensaje.set(null);

    // Validar que todas las filas tengan producto asignado
    const incompletas = this.filas().filter((f) => !f.id_producto);
    if (incompletas.length > 0) {
      this.errorMensaje.set(`Hay ${incompletas.length} fila(s) sin producto asignado.`);
      return;
    }

    const payload: SyncPartidaItemsDto = {
      items: this.filas().map((f) => ({
        id: f.id,
        id_producto: f.id_producto,
        id_unidad_medida: f.id_unidad_medida,
        id_categoria: f.id_categoria,
        Item: f.Item ? f.Item.trim() : undefined,
        Cantidad: redondear(f.Cantidad),
        CostoUnitario: redondear(f.CostoUnitario),
        PrecioVenta: redondear(f.PrecioVenta),
      })),
    };

    this.guardando.set(true);
    this.presupuestosService.syncPartidaItems(this.partida.id, payload).subscribe({
      next: (res) => {
        this.guardando.set(false);
        this.guardado.emit({
          idPartida: this.partida.id,
          costoTotal: res.costoTotal,
          ventaTotal: res.ventaTotal,
          totalItems: res.items.length,
        });
        this.cerrar.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorMensaje.set('Error guardando ítems: ' + (err.error?.message || err.message));
      },
    });
  }

  onCerrar(): void {
    this.cerrar.emit();
  }
}
