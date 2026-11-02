import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeError } from '@shared/utils/errores-http';
import { hoyISO } from '../anexos/equipo-presentacion';
import { EquiposTrabajadorService } from '../anexos/equipos-trabajador.service';
import { EquipoInventario } from '../anexos/interfaces/equipo-asignado.interface';
import {
  Asignacion,
  Conteo,
  contarPor,
  destinoDe,
  entregasPorMes,
  filtrarEquipos,
  FiltrosEquipos,
  marcaDe,
  marcaModeloDe,
  matriz,
  ramDe,
  responsableDe,
  SIN_AREA,
  SIN_FILTROS,
  SIN_UBICACION,
  sistemaOperativoDe,
  ubicacionDe,
  usoDe,
  valoresUnicos,
} from './equipos-dashboard.util';

type ClaveFiltro = keyof Pick<
  FiltrosEquipos,
  'tipo' | 'local' | 'destino' | 'area' | 'estado' | 'marca' | 'marcaModelo' | 'sistemaOperativo' | 'ram' | 'responsable'
>;

interface Distribucion {
  titulo: string;
  icono: string;
  conteos: Conteo[];
  /** Filtro que se aplica al hacer clic en una fila (si la dimensión lo admite). */
  filtro?: ClaveFiltro;
}

interface Kpis {
  total: number;
  /** Con persona responsable. */
  asignados: number;
  /** Sin responsable pero instalados en un ambiente: los usan todos (TV, impresora, switch...). */
  compartidos: number;
  /** Sin responsable y guardados (almacén / por definir / sin ubicación): listos para entregar. */
  disponibles: number;
  fueraDeServicio: number;
}

/** Color por posición del tipo (orden alfabético del inventario completo): no cambia al filtrar. Paleta categórica validada. */
const COLORES_TIPO = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const COLOR_OTROS = '#8a8f98';

/** Duración del conteo animado de los KPIs: lo bastante corta para no hacer esperar al filtrar. */
const DURACION_KPI_MS = 650;

@Component({
  selector: 'app-equipos-dashboard',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // El tablero es largo: el scroll va dentro de .content-body (ver .page-scroll en styles.css).
  host: { class: 'page-scroll' },
  templateUrl: './equipos-dashboard.html',
  styleUrl: './equipos-dashboard.css',
})
export class EquiposDashboardComponent {
  private readonly service = inject(EquiposTrabajadorService);

  readonly equipos = signal<EquipoInventario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly filtros = signal<FiltrosEquipos>({ ...SIN_FILTROS });

  readonly filtrados = computed(() => filtrarEquipos(this.equipos(), this.filtros()));
  readonly hayFiltros = computed(() => Object.values(this.filtros()).some((v) => v !== ''));

  readonly tipos = computed(() => valoresUnicos(this.equipos(), (e) => e.tipo));

  readonly kpis = computed<Kpis>(() => {
    const lista = this.filtrados();
    const usos = lista.map(usoDe);
    return {
      total: lista.length,
      asignados: usos.filter((u) => u === 'persona').length,
      compartidos: usos.filter((u) => u === 'compartido').length,
      disponibles: usos.filter((u) => u === 'disponible').length,
      fueraDeServicio: lista.filter((e) => e.estado !== 'Operativo').length,
    };
  });

  /** Valores que se pintan en las tarjetas: viajan hacia `kpis()` con un conteo animado. */
  readonly kpisVista = signal<Kpis>({ total: 0, asignados: 0, compartidos: 0, disponibles: 0, fueraDeServicio: 0 });

  /** Porcentaje (entero, 0-100) de cada KPI sobre el total mostrado. */
  readonly proporciones = computed(() => {
    const k = this.kpis();
    const sobre = (parte: number) => (k.total > 0 ? Math.round((parte / k.total) * 100) : 0);
    return {
      asignados: sobre(k.asignados),
      compartidos: sobre(k.compartidos),
      enUso: sobre(k.asignados + k.compartidos),
      disponibles: sobre(k.disponibles),
      fueraDeServicio: sobre(k.fueraDeServicio),
    };
  });

  /** Segmentos de la dona (circunferencia = 100): persona y, a continuación, compartidos; el resto es disponible. */
  readonly dona = computed(() => {
    const k = this.kpis();
    const sobre = (parte: number) => (k.total > 0 ? (parte / k.total) * 100 : 0);
    return { asignados: sobre(k.asignados), compartidos: sobre(k.compartidos) };
  });

  /** Composición por tipo con color fijo por tipo; del noveno en adelante comparten el gris de «otros». */
  readonly composicionTipos = computed(() => {
    const orden = this.tipos();
    const lista = contarPor(this.filtrados(), (e) => e.tipo);
    const total = lista.reduce((a, c) => a + c.cantidad, 0);
    return lista.map((c) => ({
      ...c,
      color: COLORES_TIPO[orden.indexOf(c.etiqueta)] ?? COLOR_OTROS,
      porcentaje: total > 0 ? Math.round((c.cantidad / total) * 100) : 0,
      ancho: total > 0 ? (c.cantidad / total) * 100 : 0,
    }));
  });

  /** Entregas de los últimos 6 meses, con la altura relativa al mes más alto. */
  readonly entregas = computed(() => {
    const meses = entregasPorMes(this.filtrados(), hoyISO());
    const maximo = Math.max(1, ...meses.map((m) => m.cantidad));
    return meses.map((m) => ({ ...m, alto: Math.round((m.cantidad / maximo) * 100) }));
  });

  /** Mapa de calor: los ambientes con más equipos frente a los tipos más frecuentes. */
  readonly mapa = computed(() => {
    const columnas = contarPor(this.filtrados(), (e) => e.tipo, 6).map((c) => c.etiqueta);
    return matriz(this.filtrados(), ubicacionDe, (e) => e.tipo, columnas, 8);
  });

  /** Primera carga: todavía no hay datos que mostrar, así que se pintan esqueletos. */
  readonly cargandoInicial = computed(() => this.cargando() && this.equipos().length === 0);
  protected readonly esqueletos = [0, 1, 2, 3, 4, 5];

  readonly distribuciones = computed<Distribucion[]>(() => {
    const l = this.filtrados();
    return [
      { titulo: 'Por tipo', icono: 'fa-layer-group', conteos: contarPor(l, (e) => e.tipo), filtro: 'tipo' },
      { titulo: 'Por empresa / centro de costo', icono: 'fa-helmet-safety', conteos: contarPor(l, destinoDe), filtro: 'destino' },
      { titulo: 'Por local', icono: 'fa-location-dot', conteos: contarPor(l, (e) => e.local || SIN_UBICACION), filtro: 'local' },
      { titulo: 'Por ambiente', icono: 'fa-door-open', conteos: contarPor(l, ubicacionDe, 10) },
      { titulo: 'Por área', icono: 'fa-sitemap', conteos: contarPor(l, (e) => e.area ?? SIN_AREA), filtro: 'area' },
      { titulo: 'Por marca', icono: 'fa-tag', conteos: contarPor(l, marcaDe, 10), filtro: 'marca' },
      { titulo: 'Por marca y modelo', icono: 'fa-barcode', conteos: contarPor(l, marcaModeloDe, 10), filtro: 'marcaModelo' },
      { titulo: 'Por sistema operativo', icono: 'fa-window-maximize', conteos: contarPor(l, sistemaOperativoDe, 10), filtro: 'sistemaOperativo' },
      { titulo: 'Por memoria RAM', icono: 'fa-memory', conteos: contarPor(l, ramDe, 10), filtro: 'ram' },
      { titulo: 'Por estado', icono: 'fa-heart-pulse', conteos: contarPor(l, (e) => e.estado), filtro: 'estado' },
      { titulo: 'Por responsable', icono: 'fa-user', conteos: contarPor(l, responsableDe, 10), filtro: 'responsable' },
    ];
  });

  private readonly destroyRef = inject(DestroyRef);
  private cuadroKpi = 0;
  private readonly reducirMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    effect(() => this.animarKpis(this.kpis()));
    this.destroyRef.onDestroy(() => cancelAnimationFrame(this.cuadroKpi));
    this.cargar();
  }

  /** Lleva los KPIs visibles hasta `meta` con una desaceleración exponencial; si se interrumpe, parte de donde iba. */
  private animarKpis(meta: Kpis): void {
    cancelAnimationFrame(this.cuadroKpi);
    const desde = untracked(() => this.kpisVista());
    const sinCambio = (Object.keys(meta) as (keyof Kpis)[]).every((k) => desde[k] === meta[k]);
    if (this.reducirMovimiento || sinCambio) {
      this.kpisVista.set(meta);
      return;
    }
    const inicio = performance.now();
    const paso = (ahora: number): void => {
      const t = Math.min(1, (ahora - inicio) / DURACION_KPI_MS);
      const avance = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const tramo = (a: number, b: number) => Math.round(a + (b - a) * avance);
      this.kpisVista.set({
        total: tramo(desde.total, meta.total),
        asignados: tramo(desde.asignados, meta.asignados),
        compartidos: tramo(desde.compartidos, meta.compartidos),
        disponibles: tramo(desde.disponibles, meta.disponibles),
        fueraDeServicio: tramo(desde.fueraDeServicio, meta.fueraDeServicio),
      });
      if (t < 1) this.cuadroKpi = requestAnimationFrame(paso);
    };
    this.cuadroKpi = requestAnimationFrame(paso);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.getInventario().subscribe({
      next: (lista) => {
        this.equipos.set(lista);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected cambiar<K extends keyof FiltrosEquipos>(clave: K, valor: FiltrosEquipos[K]): void {
    this.filtros.update((f) => ({ ...f, [clave]: valor }));
  }

  /** Clic en un KPI: filtra por esa asignación (otro clic la quita). */
  protected alternarAsignacion(valor: Exclude<Asignacion, ''>): void {
    this.cambiar('asignacion', this.filtros().asignacion === valor ? '' : valor);
  }

  protected restablecer(): void {
    this.filtros.set({ ...SIN_FILTROS });
  }

  /** Clic en una fila del gráfico: filtra por ese valor (otro clic lo quita). */
  protected filtrarPor(filtro: ClaveFiltro | undefined, etiqueta: string): void {
    if (!filtro) return;
    this.filtros.update((f) => ({ ...f, [filtro]: f[filtro] === etiqueta ? '' : etiqueta }));
  }

  protected activo(filtro: ClaveFiltro | undefined, etiqueta: string): boolean {
    return filtro !== undefined && this.filtros()[filtro] === etiqueta;
  }

  /** Intensidad (0-100) de una celda del mapa de calor. */
  protected intensidad(valor: number): number {
    const max = this.mapa().maximo;
    return max > 0 ? Math.round((valor / max) * 100) : 0;
  }

  protected porcentaje(conteo: Conteo, conteos: readonly Conteo[]): number {
    const maximo = conteos[0]?.cantidad ?? 0;
    return maximo > 0 ? Math.round((conteo.cantidad / maximo) * 100) : 0;
  }
}
