/**
 * Tipos mínimos de Leaflet 1.9 (cargado como script global desde `index.html`) para la parte
 * que usan los mapas del sistema (incidencias y el selector de punto). Sin dependencia `@types/leaflet`.
 */

export type Coordenadas = [number, number];

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LeafletMouseEvent {
  latlng: LatLng;
}

export interface LeafletMap {
  setView(centro: Coordenadas, zoom: number): LeafletMap;
  panTo(centro: Coordenadas): LeafletMap;
  on(evento: 'click', manejador: (e: LeafletMouseEvent) => void): LeafletMap;
  off(evento: 'click'): LeafletMap;
  invalidateSize(): LeafletMap;
  remove(): LeafletMap;
}

export interface LeafletTileLayer {
  addTo(mapa: LeafletMap): LeafletTileLayer;
}

/** Icono opaco creado con `L.icon(...)`. */
export interface LeafletIcon {
  readonly options: LeafletIconOptions;
}

export interface LeafletIconOptions {
  iconUrl: string;
  shadowUrl?: string;
  iconSize?: Coordenadas;
  iconAnchor?: Coordenadas;
  popupAnchor?: Coordenadas;
  shadowSize?: Coordenadas;
}

export interface LeafletMarker {
  addTo(mapa: LeafletMap): LeafletMarker;
  remove(): LeafletMarker;
  bindPopup(contenido: string): LeafletMarker;
  openPopup(): LeafletMarker;
  on(evento: 'dragend', manejador: () => void): LeafletMarker;
  getLatLng(): LatLng;
  setLatLng(posicion: Coordenadas): LeafletMarker;
}

/** El objeto global `L`. */
export interface LeafletGlobal {
  map(contenedor: string | HTMLElement): LeafletMap;
  tileLayer(urlPlantilla: string, opciones: { attribution: string }): LeafletTileLayer;
  icon(opciones: LeafletIconOptions): LeafletIcon;
  marker(posicion: Coordenadas, opciones: { draggable: boolean; icon: LeafletIcon }): LeafletMarker;
}
