/**
 * Tipos mínimos de Leaflet 1.9 (cargado como script global desde `index.html`) para la parte
 * que usa el mapa de incidencias. Sin dependencia `@types/leaflet`.
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
  bindPopup(contenido: string): LeafletMarker;
  openPopup(): LeafletMarker;
  on(evento: 'dragend', manejador: () => void): LeafletMarker;
  getLatLng(): LatLng;
  setLatLng(posicion: Coordenadas): LeafletMarker;
}

/** El objeto global `L`. */
export interface LeafletGlobal {
  map(idContenedor: string): LeafletMap;
  tileLayer(urlPlantilla: string, opciones: { attribution: string }): LeafletTileLayer;
  icon(opciones: LeafletIconOptions): LeafletIcon;
  marker(posicion: Coordenadas, opciones: { draggable: boolean; icon: LeafletIcon }): LeafletMarker;
}
