import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { mensajeError } from '@shared/utils/errores-http';
import { claseDeEstado, iconoDeTipo } from '../anexos/equipo-presentacion';
import { EquiposTrabajadorService } from '../anexos/equipos-trabajador.service';
import { EquipoInventario, EstadoEquipo } from '../anexos/interfaces/equipo-asignado.interface';
import {
  Asignacion,
  Conteo,
  contarPor,
  filtrarEquipos,
  FiltrosEquipos,
  ramDe,
  SIN_AREA,
  SIN_FILTROS,
  SIN_UBICACION,
  ubicacionDe,
  valoresUnicos,
} from './equipos-dashboard.util';

type ClaveFiltro = 'tipo' | 'local' | 'area' | 'estado';

interface Distribucion {
  titulo: string;
  icono: string;
  conteos: Conteo[];
  /** Filtro que se aplica al hacer clic en una fila (si la dimensión lo admite). */
  filtro?: ClaveFiltro;
}

@Component({
  selector: 'app-equipos-dashboard',
  standalone: true,
  imports: [FormsModule, DatePipe],
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
  readonly locales = computed(() => valoresUnicos(this.equipos(), (e) => e.local || SIN_UBICACION));
  readonly areas = computed(() => valoresUnicos(this.equipos(), (e) => e.area ?? SIN_AREA));
  readonly estados: readonly EstadoEquipo[] = ['Operativo', 'En reparación', 'De baja'];

  readonly kpis = computed(() => {
    const lista = this.filtrados();
    const asignados = lista.filter((e) => e.responsableId !== null).length;
    return {
      total: lista.length,
      asignados,
      disponibles: lista.length - asignados,
      fueraDeServicio: lista.filter((e) => e.estado !== 'Operativo').length,
    };
  });

  readonly distribuciones = computed<Distribucion[]>(() => {
    const l = this.filtrados();
    return [
      { titulo: 'Por tipo', icono: 'fa-layer-group', conteos: contarPor(l, (e) => e.tipo), filtro: 'tipo' },
      { titulo: 'Por local', icono: 'fa-location-dot', conteos: contarPor(l, (e) => e.local || SIN_UBICACION), filtro: 'local' },
      { titulo: 'Por ambiente', icono: 'fa-door-open', conteos: contarPor(l, ubicacionDe, 10) },
      { titulo: 'Por área', icono: 'fa-sitemap', conteos: contarPor(l, (e) => e.area ?? SIN_AREA), filtro: 'area' },
      { titulo: 'Por marca', icono: 'fa-tag', conteos: contarPor(l, (e) => e.marca || 'Sin marca', 10) },
      { titulo: 'Por marca y modelo', icono: 'fa-barcode', conteos: contarPor(l, (e) => [e.marca, e.modelo].filter(Boolean).join(' ') || 'Sin modelo', 10) },
      { titulo: 'Por sistema operativo', icono: 'fa-window-maximize', conteos: contarPor(l, (e) => e.caracteristicas['Sistema operativo'] ?? 'Sin dato', 10) },
      { titulo: 'Por memoria RAM', icono: 'fa-memory', conteos: contarPor(l, ramDe, 10) },
      { titulo: 'Por estado', icono: 'fa-heart-pulse', conteos: contarPor(l, (e) => e.estado), filtro: 'estado' },
      { titulo: 'Por responsable', icono: 'fa-user', conteos: contarPor(l, (e) => e.responsable ?? 'Sin asignar', 10) },
    ];
  });

  constructor() {
    this.cargar();
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

  protected cambiarAsignacion(valor: Asignacion): void {
    this.cambiar('asignacion', valor);
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

  protected porcentaje(conteo: Conteo, conteos: readonly Conteo[]): number {
    const maximo = conteos[0]?.cantidad ?? 0;
    return maximo > 0 ? Math.round((conteo.cantidad / maximo) * 100) : 0;
  }

  protected ubicacion(e: EquipoInventario): string {
    return ubicacionDe(e);
  }

  protected icono(tipo: string): string {
    return iconoDeTipo(tipo);
  }

  protected claseEstado(estado: EstadoEquipo): string {
    return claseDeEstado(estado);
  }
}
