import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { marcadoDeEvento } from '@shared/utils/eventos';
import { esSinLeer, hace } from '../../operaciones.calc';
import { ETIQUETAS_TIPO_EVENTO, EventoPortafolio, TIPOS_EVENTO } from '../../operaciones.interface';
import { OperacionesStore } from '../../operaciones.store';

/**
 * Campana de avisos del Dashboard (RF-OP-48, 49): los cambios recientes de las obras (pasó a
 * Retrasada, plazo vencido, estado…), cuántos faltan por leer y qué tipos le importan a cada persona.
 */
@Component({
  selector: 'app-ops-campana',
  standalone: true,
  templateUrl: './campana.html',
  styleUrl: '../../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'clicFuera($event)',
    '(document:keydown.escape)': 'cerrar()',
  },
})
export class CampanaComponent {
  readonly #router = inject(Router);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly store = inject(OperacionesStore);
  protected readonly hace = hace;
  protected readonly marcadoDe = marcadoDeEvento;
  protected readonly tipos = TIPOS_EVENTO.map((valor) => ({ valor, etiqueta: ETIQUETAS_TIPO_EVENTO[valor] }));

  protected readonly abierta = signal(false);
  protected readonly verPreferencias = signal(false);

  /** Los 15 más recientes; los sin leer van resaltados. */
  protected readonly lista = computed(() => this.store.avisos().slice(0, 15));
  protected readonly cantidad = computed(() => this.store.noLeidos());
  protected readonly etiqueta = computed(() => (this.cantidad() > 99 ? '99+' : String(this.cantidad())));

  constructor() {
    this.store.pedirAvisos();
  }

  protected sinLeer(e: EventoPortafolio): boolean {
    return esSinLeer(e, this.store.estadoAvisos()?.visto_hasta ?? null, null);
  }

  protected alternar(): void {
    this.abierta.update((a) => !a);
    this.verPreferencias.set(false);
  }

  protected cerrar(): void {
    this.abierta.set(false);
  }

  protected clicFuera(e: Event): void {
    if (this.abierta() && !this.#host.nativeElement.contains(e.target as Node)) this.cerrar();
  }

  protected incluye(tipo: string): boolean {
    const t = this.store.tiposImportantes();
    return t === null || t.includes(tipo);
  }

  /** Marca o desmarca un tipo; si quedan todos marcados vuelve a «todos» (`null`). */
  protected elegirTipo(tipo: string, marcado: boolean): void {
    const actuales = this.store.tiposImportantes() ?? TIPOS_EVENTO.map(String);
    const nuevos = marcado ? [...new Set([...actuales, tipo])] : actuales.filter((t) => t !== tipo);
    this.store.guardarTipos(nuevos.length === TIPOS_EVENTO.length ? null : nuevos);
  }

  protected abrirObra(e: EventoPortafolio): void {
    this.cerrar();
    void this.#router.navigate(['/centros-costos', e.id_centro_costo, 'datos']);
  }
}
