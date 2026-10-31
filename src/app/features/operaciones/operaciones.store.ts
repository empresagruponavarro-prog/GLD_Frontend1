import { computed, inject, Service, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catalogosDe, esSinLeer, estadoDe, filtrarObras, hayFiltros } from './operaciones.calc';
import { ArbolObra, EstadoAvisos, EventoPortafolio, FiltrosGlobales, ObraResumen, SIN_FILTROS } from './operaciones.interface';
import { OperacionesService } from './operaciones.service';

/**
 * Estado compartido del Dashboard: el portafolio (se lee una vez) y los filtros globales, que se
 * mantienen al cambiar de vista (RF-OP-46). Los filtros se aplican en el cliente sobre las mismas
 * obras, así los conteos de todas las vistas cuadran entre sí.
 */
@Service()
export class OperacionesStore {
  readonly #service = inject(OperacionesService);

  readonly filtros = signal<FiltrosGlobales>(SIN_FILTROS);
  readonly #recurso = rxResource({ stream: () => this.#service.getPortafolio() });

  readonly cargando = computed(() => this.#recurso.isLoading());
  readonly error = computed(() => this.#recurso.error() !== undefined);
  readonly portafolio = computed(() => (this.#recurso.hasValue() ? this.#recurso.value() : null));
  /** Fecha de hoy según el servidor (Lima). */
  readonly hoy = computed(() => this.portafolio()?.hoy ?? '');
  /** Todas las obras evaluables, sin filtrar. */
  readonly todas = computed(() => this.portafolio()?.obras ?? []);
  readonly sinEvaluar = computed(() => this.portafolio()?.sin_evaluar ?? []);
  /** Las obras que pasan los filtros globales. */
  readonly obras = computed(() => filtrarObras(this.todas(), this.filtros()));
  readonly catalogos = computed(() => catalogosDe(this.todas()));
  readonly filtrado = computed(() => hayFiltros(this.filtros()));

  // ── Árboles de partidas (Partidas, Curva S, Cronograma): se piden solo cuando una vista los necesita ──
  readonly #quiereArboles = signal(false);
  /** Obras en ejecución y post venta de los filtros actuales (máx. 100: límite de la API). */
  readonly idsConArbol = computed(() =>
    this.obras()
      .filter((o) => estadoDe(o) === 'EN_EJECUCION' || estadoDe(o) === 'POST_VENTA')
      .slice(0, 100)
      .map((o) => o.id_centro_costo),
  );
  readonly #arboles = rxResource({
    params: () => (this.#quiereArboles() && this.idsConArbol().length > 0 ? this.idsConArbol().join(',') : undefined),
    stream: ({ params }) => this.#service.getArboles(params.split(',').map(Number)),
  });
  readonly cargandoArboles = computed(() => this.#arboles.isLoading());
  readonly arboles = computed(() => new Map<number, ArbolObra>((this.#arboles.hasValue() ? this.#arboles.value() : []).map((a) => [a.id_centro_costo, a])));

  /** Una vista que necesita los árboles lo avisa al crearse. */
  pedirArboles(): void {
    this.#quiereArboles.set(true);
  }

  // ── Campana de avisos: se pide solo cuando hay una campana en pantalla ──
  readonly #quiereAvisos = signal(false);
  /** Lo que acaba de devolver el servidor al marcar leídos o guardar preferencias (se impone a la lectura inicial). */
  readonly #estadoLocal = signal<EstadoAvisos | null>(null);
  readonly #estadoAvisos = rxResource({
    params: () => (this.#quiereAvisos() ? true : undefined),
    stream: () => this.#service.getEstadoAvisos(),
  });
  readonly #feed = rxResource({
    params: () => (this.#quiereAvisos() ? true : undefined),
    stream: () => this.#service.getEventos(50),
  });
  readonly estadoAvisos = computed<EstadoAvisos | null>(() => this.#estadoLocal() ?? (this.#estadoAvisos.hasValue() ? this.#estadoAvisos.value() : null));
  readonly tiposImportantes = computed(() => this.estadoAvisos()?.tipos_importantes ?? null);
  /** Avisos recientes de los tipos que importan a esta persona, del más nuevo al más antiguo. */
  readonly avisos = computed<EventoPortafolio[]>(() => {
    const tipos = this.tiposImportantes();
    return (this.#feed.hasValue() ? this.#feed.value() : []).filter((e) => tipos === null || tipos.includes(e.tipo));
  });
  readonly avisosSinLeer = computed(() => this.avisos().filter((e) => esSinLeer(e, this.estadoAvisos()?.visto_hasta ?? null, null)));
  /** Cantidad de avisos sin leer de la campana. */
  readonly noLeidos = computed(() => this.avisosSinLeer().length);
  /** «⚠ N avisos» por obra: sin leer y de severidad advertencia o crítica. */
  readonly avisosPorObra = computed(() => {
    const m = new Map<number, number>();
    for (const e of this.avisosSinLeer()) if (e.severidad === 'warn' || e.severidad === 'crit') m.set(e.id_centro_costo, (m.get(e.id_centro_costo) ?? 0) + 1);
    return m;
  });

  pedirAvisos(): void {
    this.#quiereAvisos.set(true);
  }

  marcarLeidos(): void {
    this.#service.marcarLeidos().subscribe((e) => this.#estadoLocal.set(e));
  }

  guardarTipos(tipos: readonly string[] | null): void {
    this.#service.guardarPreferencias(tipos).subscribe((e) => this.#estadoLocal.set(e));
  }

  actualizar(cambios: Partial<FiltrosGlobales>): void {
    this.filtros.update((f) => ({ ...f, ...cambios }));
  }

  limpiar(): void {
    this.filtros.set(SIN_FILTROS);
  }

  recargar(): void {
    this.#recurso.reload();
    if (this.#quiereArboles()) this.#arboles.reload();
    if (this.#quiereAvisos()) this.#feed.reload();
  }

  /** Navegación cruzada (RF-OP-47): «clic en una obra» deja solo esa obra en todas las vistas. */
  enfocarObra(o: Pick<ObraResumen, 'codigo_obra' | 'nombre'>): void {
    this.actualizar({ q: o.codigo_obra ?? o.nombre });
  }
}
