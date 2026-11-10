import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { LeafletGlobal, LeafletMap, LeafletMarker } from './leaflet.types';

/** Leaflet global (script de `index.html`); `undefined` si no cargó. */
declare const L: LeafletGlobal | undefined;

export interface PuntoMapa {
  latitud: number;
  longitud: number;
}

/** Lima, para abrir el mapa cuando todavía no hay un punto. */
const CENTRO_POR_DEFECTO: [number, number] = [-12.0464, -77.0428];
const ZOOM_SIN_PUNTO = 11;
const ZOOM_CON_PUNTO = 16;
/** Acercamiento al centrar el mapa en un distrito: se ven unas cuantas cuadras alrededor del centro. */
const ZOOM_DISTRITO = 13;

const redondear = (n: number): number => Number(n.toFixed(6));

/**
 * Mapa para elegir un punto (latitud y longitud): clic para colocarlo, arrastrar el pin para afinarlo.
 * Las coordenadas entran y salen por `latitud`/`longitud` y `cambio`; en `soloLectura` solo muestra el punto.
 * Mientras no hay punto, `centro` (p. ej. el centro del distrito elegido) dice dónde abrir y acercar el mapa; con un
 * punto puesto el mapa siempre sigue al punto.
 */
@Component({
  selector: 'app-mapa-punto',
  standalone: true,
  templateUrl: './mapa-punto.html',
  styleUrl: './mapa-punto.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaPuntoComponent {
  readonly latitud = input<number | null>(null);
  readonly longitud = input<number | null>(null);
  readonly centro = input<PuntoMapa | null>(null);
  readonly soloLectura = input(false);
  readonly altura = input('240px');
  readonly cambio = output<PuntoMapa>();

  protected readonly disponible = signal(typeof L !== 'undefined');

  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  readonly #destroyRef = inject(DestroyRef);
  readonly #listo = signal(false);
  #mapa: LeafletMap | null = null;
  #pin: LeafletMarker | null = null;

  constructor() {
    afterNextRender(() => this.#iniciar());
    effect(() => {
      const lat = this.latitud();
      const lng = this.longitud();
      this.soloLectura();
      if (this.#listo()) this.#sincronizar(lat, lng);
    });
    // Un centro nuevo (otro distrito) mueve el mapa solo si todavía no hay un punto puesto.
    effect(() => {
      const centro = this.centro();
      if (this.#listo() && !this.#pin && centro) this.#centrar(centro);
    });
    this.#destroyRef.onDestroy(() => this.#mapa?.remove());
  }

  #iniciar(): void {
    if (typeof L === 'undefined') return;
    const mapa = L.map(this.contenedor().nativeElement);
    this.#mapa = mapa;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapa);
    const lat = this.latitud();
    const lng = this.longitud();
    const hayPunto = lat !== null && lng !== null;
    const centro = this.centro();
    if (hayPunto) mapa.setView([lat, lng], ZOOM_CON_PUNTO);
    else if (centro) mapa.setView([centro.latitud, centro.longitud], ZOOM_DISTRITO);
    else mapa.setView(CENTRO_POR_DEFECTO, ZOOM_SIN_PUNTO);
    mapa.on('click', (e) => {
      if (this.soloLectura()) return;
      this.#elegir(e.latlng.lat, e.latlng.lng);
    });
    this.#listo.set(true);
    // El modal anima su apertura: el mapa mide 0 hasta que termina.
    setTimeout(() => mapa.invalidateSize(), 250);
  }

  #centrar(centro: PuntoMapa): void {
    this.#mapa?.setView([centro.latitud, centro.longitud], ZOOM_DISTRITO);
  }

  #elegir(lat: number, lng: number): void {
    this.cambio.emit({ latitud: redondear(lat), longitud: redondear(lng) });
  }

  /** Lleva el pin a las coordenadas del formulario (o lo quita si se vaciaron). */
  #sincronizar(lat: number | null, lng: number | null): void {
    const mapa = this.#mapa;
    if (!mapa) return;
    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
      this.#pin?.remove();
      this.#pin = null;
      const centro = this.centro();
      if (centro) this.#centrar(centro);
      return;
    }
    if (typeof L === 'undefined') return;
    if (!this.#pin) {
      const pin = L.marker([lat, lng], { draggable: !this.soloLectura(), icon: this.#icono(L) });
      pin.on('dragend', () => {
        const p = pin.getLatLng();
        this.#elegir(p.lat, p.lng);
      });
      pin.addTo(mapa);
      this.#pin = pin;
      mapa.setView([lat, lng], ZOOM_CON_PUNTO);
      return;
    }
    const actual = this.#pin.getLatLng();
    if (redondear(actual.lat) !== redondear(lat) || redondear(actual.lng) !== redondear(lng)) {
      this.#pin.setLatLng([lat, lng]);
      mapa.panTo([lat, lng]);
    }
  }

  #icono(leaflet: LeafletGlobal) {
    return leaflet.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
  }
}
