import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SituacionChipComponent } from '../../centros-costos/obra-cockpit/components/control-tab/situacion-chip/situacion-chip';
import { diaMes, textoDesviacion } from '../../centros-costos/obra-cockpit/obra-control.calc';
import { esVigente, kpisDe, ordenarObras, paginar } from '../operaciones.calc';
import { OperacionesStore } from '../operaciones.store';
import { BarraAvanceComponent } from '../ui/barra-avance/barra-avance';
import { EstadoChipComponent } from '../ui/estado-chip/estado-chip';

/** Cada cuánto cambia de página el modo pantalla (RF-OP-30). */
export const PAGINA_TV_MS = 180_000;
/** Cada cuánto vuelve a leer el portafolio. */
export const RELECTURA_TV_MS = 300_000;
export const FILAS_TV = 8;

interface WakeLockSentinelLike {
  release(): Promise<void>;
}
interface NavegadorConWakeLock {
  wakeLock?: { request(tipo: 'screen'): Promise<WakeLockSentinelLike> };
}

/**
 * Modo pantalla: la bitácora de obras vigentes a pantalla completa, sin menú. Pasa de página sola
 * cada 3 minutos, ← → navegan, Esc sale, la pantalla no se apaga y se vuelve a leer cada 5 minutos.
 * Pensado para un usuario de solo lectura en una TV (D11).
 */
@Component({
  selector: 'app-tv',
  standalone: true,
  imports: [SituacionChipComponent, BarraAvanceComponent, EstadoChipComponent],
  templateUrl: './tv.html',
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.arrowright)': 'avanzar(1)',
    '(document:keydown.arrowleft)': 'avanzar(-1)',
    '(document:keydown.escape)': 'salir()',
  },
})
export class TvComponent {
  readonly #router = inject(Router);
  readonly #doc = inject(DOCUMENT);
  protected readonly store = inject(OperacionesStore);
  protected readonly diaMes = diaMes;
  protected readonly desviacion = textoDesviacion;

  protected readonly pagina = signal(0);
  protected readonly ahora = signal(new Date());
  #wakeLock: WakeLockSentinelLike | null = null;

  protected readonly vigentes = computed(() => ordenarObras(this.store.obras().filter(esVigente)));
  protected readonly kpis = computed(() => kpisDe(this.store.obras()));
  protected readonly vista = computed(() => paginar(this.vigentes(), FILAS_TV, this.pagina()));
  protected readonly clientes = computed(() => [...new Set(this.vigentes().map((o) => o.cliente?.nombre).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'es')));
  protected readonly conRetraso = computed(() => this.vigentes().filter((o) => o.resultado.situacion.clave === 'crit').length);

  constructor() {
    const destroy = inject(DestroyRef);
    const timers = [
      setInterval(() => this.avanzar(1), PAGINA_TV_MS),
      setInterval(() => this.store.recargar(), RELECTURA_TV_MS),
      setInterval(() => this.ahora.set(new Date()), 30_000),
    ];
    destroy.onDestroy(() => {
      timers.forEach(clearInterval);
      void this.#soltarPantalla();
    });
    void this.#mantenerPantallaEncendida();
  }

  protected avanzar(paso: number): void {
    this.pagina.set(paginar(this.vigentes(), FILAS_TV, this.pagina() + paso).pagina);
  }

  protected salir(): void {
    if (this.#doc.fullscreenElement) void this.#doc.exitFullscreen();
    void this.#router.navigate(['/operaciones/en-vivo']);
  }

  protected pantallaCompleta(): void {
    void this.#doc.documentElement.requestFullscreen?.();
  }

  async #mantenerPantallaEncendida(): Promise<void> {
    try {
      const nav: NavegadorConWakeLock = this.#doc.defaultView?.navigator ?? {};
      this.#wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
    } catch {
      // Sin soporte o sin permiso: la pantalla se apagará según la configuración del equipo.
      this.#wakeLock = null;
    }
  }

  async #soltarPantalla(): Promise<void> {
    try {
      await this.#wakeLock?.release();
    } catch {
      // Ya estaba liberado.
    }
    this.#wakeLock = null;
  }
}
