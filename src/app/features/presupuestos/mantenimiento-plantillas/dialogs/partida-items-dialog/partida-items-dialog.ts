import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import {
  PresupuestosService,
  PartidaItemsResponse,
  SyncPartidaItemsDto,
} from '@app/features/presupuestos/presupuestos.service';
import { ProductosService } from '@app/features/maestros-generales/productos/productos.service';
import { CotizacionesFaseDialogComponent } from '@app/features/presupuestos/cotizaciones-ppto/cotizaciones-fase-dialog/cotizaciones-fase-dialog';
import { ResumenCotizacionItem } from '@app/features/presupuestos/cotizaciones-ppto/cotizaciones-ppto.models';
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
  /** Solo en un presupuesto guardado: cotizaciones, proveedor ganador y compromiso del ítem (plan 09). */
  cotizacion?: ResumenCotizacionItem;
}

export interface PartidaInfo {
  id: number;
  IdpptoFaseCategoria: string;
  NombreCategoria?: string;
  NombreFase?: string;
  /** Posición de la partida dentro de su fase (1, 2, 3…): da el prefijo de sus ítems (partida 1 → 1.01, 1.02…). */
  numeroPartida?: number;
  /** Presupuesto (`ppto_Principal.id`) y fase (`ppto_DetalleFases.id`) de la partida: habilitan las cotizaciones por ítem (plan 09). */
  id_presupuesto?: number;
  id_detalle_fase?: number;
}

export interface GuardadoEvent {
  idPartida: number;
  costoTotal: number;
  ventaTotal: number;
  totalItems: number;
}

/**
 * Origen de los ítems del diálogo:
 * - `plantilla`: partida de plantilla (`/presupuestos/plantillas/categorias/:id/items`).
 * - `presupuesto`: partida de un presupuesto ya guardado (`/presupuestos/categorias-asignadas/:id/items`).
 * - `local`: partida de un presupuesto nuevo (aún sin guardar): no llama a la API, devuelve las filas
 *   por `guardadoLocal` y el padre las persiste al emitir el presupuesto.
 */
export type ModoItemsDialog = 'plantilla' | 'presupuesto' | 'local';

/** Dónde dibujar la lista de resultados: por encima de todo, pegada al campo (hacia abajo o hacia arriba). */
export interface PosicionLista {
  left: number;
  width: number;
  top: number | null;
  bottom: number | null;
  maxHeight: number;
}

const ALTO_LISTA = 240;
const ANCHO_MINIMO_LISTA = 340;
const MARGEN = 8;

/**
 * Calcula la posición de la lista (coordenadas de la ventana del navegador) para un campo ubicado en `campo`.
 * Se abre debajo del campo; si abajo no cabe y arriba hay más lugar, se abre hacia arriba.
 */
export function posicionarLista(campo: DOMRect, ventana: { ancho: number; alto: number }): PosicionLista {
  const abajo = ventana.alto - campo.bottom - MARGEN;
  const arriba = campo.top - MARGEN;
  const haciaArriba = abajo < ALTO_LISTA && arriba > abajo;
  const ancho = Math.min(Math.max(campo.width, ANCHO_MINIMO_LISTA), ventana.ancho - MARGEN * 2);
  return {
    left: Math.max(MARGEN, Math.min(campo.left, ventana.ancho - ancho - MARGEN)),
    width: ancho,
    top: haciaArriba ? null : campo.bottom + 4,
    bottom: haciaArriba ? ventana.alto - campo.top + 4 : null,
    maxHeight: Math.max(96, Math.min(ALTO_LISTA, (haciaArriba ? arriba : abajo) - 4)),
  };
}

function redondear(n: number): number {
  return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
}

@Component({
  selector: 'app-partida-items-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, CotizacionesFaseDialogComponent],
  templateUrl: './partida-items-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartidaItemsDialogComponent implements OnInit {
  private presupuestosService = inject(PresupuestosService);
  private productosService = inject(ProductosService);

  @Input({ required: true }) partida!: PartidaInfo;
  @Input() soloLectura = false;
  @Input() modo: ModoItemsDialog = 'plantilla';
  /** Solo modo `local`: ítems con los que abre el diálogo. */
  @Input() itemsIniciales: ItemFila[] = [];
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<GuardadoEvent>();
  /** Solo modo `local`: filas confirmadas por el usuario. */
  @Output() guardadoLocal = new EventEmitter<ItemFila[]>();

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
  /** Lugar de la lista de resultados, calculado desde el campo que se está escribiendo. */
  posicionLista = signal<PosicionLista | null>(null);
  private campoActivo: HTMLElement | null = null;
  private searchSubject = new Subject<string>();

  /** Las acciones «Cotizar» y «Cuadro» por ítem solo existen en un presupuesto guardado (plan 09, lámina 5). */
  get conCotizaciones(): boolean {
    return this.modo === 'presupuesto' && !!this.partida.id_presupuesto && !!this.partida.id_detalle_fase;
  }

  /** Diálogo de cotizaciones de la fase, abierto desde un ítem (`itemInicial`) o para registrar una cotización nueva. */
  cotizando = signal<{ itemInicial: number | null; registrar: boolean } | null>(null);

  /** Abre las cotizaciones de la fase desde un ítem: `registrar` = directo al formulario de una cotización con ese ítem marcado. */
  abrirCotizaciones(fila: ItemFila, registrar: boolean): void {
    if (!this.conCotizaciones || fila.id === undefined) return;
    this.cotizando.set({ itemInicial: fila.id, registrar });
  }

  cerrarCotizaciones(): void {
    this.cotizando.set(null);
  }

  /** Hay al menos un ítem ya guardado (sin id no se puede cotizar). */
  hayItemsGuardados(): boolean {
    return this.filas().some((f) => f.id !== undefined);
  }

  /** Abre las cotizaciones de la fase desde la barra de arriba: `registrar` = directo al formulario de una cotización nueva. */
  abrirCotizacionesFase(registrar: boolean): void {
    if (!this.conCotizaciones || !this.hayItemsGuardados()) return;
    this.cotizando.set({ itemInicial: null, registrar });
  }

  /** Hubo cotizaciones o un ganador nuevo: al cerrar el diálogo se avisa al presupuesto para que refresque sus fases y sus montos. */
  private huboCambiosCotizacion = false;

  /** Se cotizó, se eligió un ganador o cambió un compromiso: se vuelve a leer lo que muestra cada ítem. */
  onCotizacionesCambio(): void {
    this.huboCambiosCotizacion = true;
    this.cargarItems();
  }

  /** Diferencia del proveedor ganador contra el Meta del ítem (precio sin IGV × cantidad − costo total), en la moneda del ganador. */
  diferenciaGanador(fila: ItemFila): number | null {
    const a = fila.cotizacion?.adjudicado;
    if (!a) return null;
    return redondear(Number(a.precio_sin_igv) * fila.Cantidad - fila.CostoTotal);
  }

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
    if (this.modo === 'local') {
      this.filas.set(this.itemsIniciales.map((it) => ({ ...it })));
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.errorMensaje.set(null);
    const peticion = this.modo === 'presupuesto'
      ? this.presupuestosService.getItemsCategoriaAsignada(this.partida.id)
      : this.presupuestosService.getPartidaItems(this.partida.id);
    peticion.subscribe({
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
            cotizacion: it.cotizacion,
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
        debounceTime(180),
        distinctUntilChanged(),
        switchMap((term) => {
          this.buscandoProductos.set(true);
          const t = (term || '').trim();
          if (!t) {
            return this.productosService.getAll({ pageSize: 25 });
          }
          return this.productosService.getAll({ descripcion: t, pageSize: 25 });
        }),
      )
      .subscribe({
        next: (res) => {
          this.buscandoProductos.set(false);
          const data: Producto[] = Array.isArray(res) ? res : res.data || [];
          this.resultadosBusqueda.set(data);
          this.colocarLista();
          this.mostrarResultados.set(data.length > 0);
        },
        error: () => {
          this.buscandoProductos.set(false);
          this.resultadosBusqueda.set([]);
        },
      });
  }

  /** Pone la lista junto al campo activo, por encima de la tabla y del pie del diálogo. */
  private colocarLista(): void {
    if (!this.campoActivo) return;
    this.posicionLista.set(
      posicionarLista(this.campoActivo.getBoundingClientRect(), { ancho: window.innerWidth, alto: window.innerHeight }),
    );
  }

  /** Al mover el scroll de la tabla o cambiar el tamaño de la ventana, la lista se cierra en vez de quedar suelta. */
  @HostListener('window:resize')
  cerrarLista(): void {
    this.mostrarResultados.set(false);
    this.indiceFilaSeleccionando.set(null);
  }

  /** Nombre completo de la unidad elegida (el desplegable lo corta; se muestra en varias líneas debajo). */
  nombreUnidad(id: number | undefined | null): string {
    return id ? (this.unidadesMedida().find((u) => u.id === id)?.nombre ?? '') : '';
  }

  /** Nombre completo de la categoría elegida (el desplegable lo corta; se muestra en varias líneas debajo). */
  nombreCategoria(id: number | undefined | null): string {
    return id == null ? '' : (this.categorias().find((c) => c.id === id)?.nombre ?? '');
  }

  abrirBuscador(fila: ItemFila, indexFila: number, evento?: Event): void {
    if (this.soloLectura) return;
    if (evento?.target instanceof HTMLElement) this.campoActivo = evento.target;
    this.colocarLista();
    this.indiceFilaSeleccionando.set(indexFila);
    const term = fila.descripcion_producto || '';
    this.busquedaProducto.set(term);
    this.searchSubject.next(term);
  }

  onBuscarInput(fila: ItemFila, term: string, indexFila: number): void {
    fila.descripcion_producto = term;
    this.indiceFilaSeleccionando.set(indexFila);
    this.busquedaProducto.set(term);
    this.searchSubject.next(term);
  }

  seleccionarProducto(fila: ItemFila, producto: Producto): void {
    const cat = this.categorias().find((opt) => opt.id === producto.id_categoria);
    const u = this.unidadesMedida().find((opt) => opt.id === producto.id_unidad_medida);

    const actualizadas = this.filas().map((f) => {
      if (f === fila) {
        return {
          ...f,
          id_producto: producto.id,
          codigo_producto: producto.codigo,
          descripcion_producto: producto.descripcion,
          tipo_producto: producto.tipo_producto,
          id_categoria: producto.id_categoria,
          categoria_producto: cat?.nombre || '',
          id_unidad_medida: producto.id_unidad_medida,
          simbolo_unidad: u?.nombre || '',
        };
      }
      return f;
    });

    this.filas.set(actualizadas);
    this.mostrarResultados.set(false);
    this.indiceFilaSeleccionando.set(null);
    this.busquedaProducto.set('');
  }

  onCambiarCategoria(fila: ItemFila, valor: unknown): void {
    const idCat = valor && valor !== 'undefined' ? Number(valor) : undefined;
    const cat = this.categorias().find((opt) => opt.id === idCat);
    const actualizadas = this.filas().map((f) => {
      if (f === fila) {
        return {
          ...f,
          id_categoria: idCat,
          categoria_producto: cat?.nombre || '',
        };
      }
      return f;
    });
    this.filas.set(actualizadas);
  }

  cerrarDropdown(): void {
    setTimeout(() => {
      this.mostrarResultados.set(false);
      this.indiceFilaSeleccionando.set(null);
    }, 250);
  }

  recalcularFila(fila: ItemFila): void {
    const cant = redondear(fila.Cantidad);
    const cu = redondear(fila.CostoUnitario);
    const pv = redondear(fila.PrecioVenta);
    fila.CostoTotal = redondear(cant * cu);
    fila.VentaTotal = redondear(cant * pv);
    this.filas.set([...this.filas()]);
  }

  /** Siguiente número de ítem de la partida: partida 1 → 1.01, 1.02…; partida 2 → 2.01… (vacío si no se conoce la posición). */
  private siguienteNumeroItem(): string {
    const p = this.partida.numeroPartida;
    if (!p) return '';
    let mayor = 0;
    for (const f of this.filas()) {
      const m = /^(\d+)\.(\d+)$/.exec((f.Item ?? '').trim());
      if (m && Number(m[1]) === p) mayor = Math.max(mayor, Number(m[2]));
    }
    return `${p}.${String(mayor + 1).padStart(2, '0')}`;
  }

  agregarFila(): void {
    if (this.soloLectura) return;
    const catDefault = this.categorias()[0];
    const nueva: ItemFila = {
      Item: this.siguienteNumeroItem(),
      id_producto: 0,
      codigo_producto: '',
      descripcion_producto: '',
      tipo_producto: 'PRODUCTO',
      id_categoria: catDefault ? catDefault.id : undefined,
      categoria_producto: catDefault ? catDefault.nombre : '',
      // 0 = «Selecciona»: el usuario elige la unidad (o se completa al elegir el producto).
      id_unidad_medida: 0,
      simbolo_unidad: null,
      Cantidad: 0,
      CostoUnitario: 0,
      PrecioVenta: 0,
      CostoTotal: 0,
      VentaTotal: 0,
    };
    this.filas.set([...this.filas(), nueva]);
  }

  eliminarFila(index: number): void {
    if (this.soloLectura) return;
    const fila = this.filas()[index];
    if (fila?.cotizacion?.cubierto) {
      this.errorMensaje.set('Este ítem ya tiene una orden registrada: para quitarlo, anule la orden o cree una nueva versión del presupuesto.');
      return;
    }
    const cotizaciones = fila?.cotizacion?.cotizaciones ?? 0;
    if (cotizaciones > 0 && !confirm(`Este ítem tiene ${cotizaciones} cotización(es). Si lo quita, se pierden sus cotizaciones y su proveedor ganador. ¿Quitarlo?`)) return;
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
    const sinUnidad = this.filas().filter((f) => !f.id_unidad_medida);
    if (sinUnidad.length > 0) {
      this.errorMensaje.set(`Hay ${sinUnidad.length} fila(s) sin unidad de medida: elige una en «Selecciona».`);
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

    if (this.modo === 'local') {
      const filasLocales = this.filas().map((f) => ({
        ...f,
        Cantidad: redondear(f.Cantidad),
        CostoUnitario: redondear(f.CostoUnitario),
        PrecioVenta: redondear(f.PrecioVenta),
        CostoTotal: redondear(redondear(f.Cantidad) * redondear(f.CostoUnitario)),
        VentaTotal: redondear(redondear(f.Cantidad) * redondear(f.PrecioVenta)),
      }));
      this.guardadoLocal.emit(filasLocales);
      this.cerrar.emit();
      return;
    }

    this.guardando.set(true);
    const peticion = this.modo === 'presupuesto'
      ? this.presupuestosService.syncItemsCategoriaAsignada(this.partida.id, payload)
      : this.presupuestosService.syncPartidaItems(this.partida.id, payload);
    peticion.subscribe({
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
    if (this.huboCambiosCotizacion) {
      this.guardado.emit({ idPartida: this.partida.id, costoTotal: this.totales().costoTotal, ventaTotal: 0, totalItems: this.totales().cantidadFilas });
      return;
    }
    this.cerrar.emit();
  }
}
