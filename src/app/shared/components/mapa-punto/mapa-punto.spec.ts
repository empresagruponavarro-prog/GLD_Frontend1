import { TestBed } from '@angular/core/testing';
import { LeafletMap, LeafletMarker, LeafletMouseEvent } from './leaflet.types';
import { MapaPuntoComponent, PuntoMapa } from './mapa-punto';

interface MapaFalso {
  vistas: [number, number][];
  clic: ((e: LeafletMouseEvent) => void) | null;
  pines: { posicion: [number, number]; quitado: boolean; draggable: boolean; alSoltar: (() => void) | null }[];
}

/** Instala un `L` de mentira (Leaflet es un script global) y devuelve lo que el componente le pidió. */
function instalarLeaflet(): MapaFalso {
  const falso: MapaFalso = { vistas: [], clic: null, pines: [] };
  const mapa: LeafletMap = {
    setView(centro) {
      falso.vistas.push(centro);
      return mapa;
    },
    panTo: () => mapa,
    on(_evento, manejador) {
      falso.clic = manejador;
      return mapa;
    },
    off: () => mapa,
    invalidateSize: () => mapa,
    remove: () => mapa,
  };
  const leaflet = {
    map: () => mapa,
    tileLayer: () => ({ addTo: () => ({ addTo: () => undefined }) }),
    icon: (opciones: object) => ({ options: opciones }),
    marker(posicion: [number, number], opciones: { draggable: boolean }) {
      const pin = { posicion, quitado: false, draggable: opciones.draggable, alSoltar: null as (() => void) | null };
      falso.pines.push(pin);
      const marcador: LeafletMarker = {
        addTo: () => marcador,
        remove() {
          pin.quitado = true;
          return marcador;
        },
        bindPopup: () => marcador,
        openPopup: () => marcador,
        on(_evento, manejador) {
          pin.alSoltar = manejador;
          return marcador;
        },
        getLatLng: () => ({ lat: pin.posicion[0], lng: pin.posicion[1] }),
        setLatLng(nueva) {
          pin.posicion = nueva;
          return marcador;
        },
      };
      return marcador;
    },
  };
  Object.assign(globalThis, { L: leaflet });
  return falso;
}

async function montar(entradas: { lat: number | null; lng: number | null; soloLectura?: boolean }) {
  const falso = instalarLeaflet();
  const fixture = TestBed.createComponent(MapaPuntoComponent);
  fixture.componentRef.setInput('latitud', entradas.lat);
  fixture.componentRef.setInput('longitud', entradas.lng);
  fixture.componentRef.setInput('soloLectura', entradas.soloLectura ?? false);
  const elegidos: PuntoMapa[] = [];
  fixture.componentInstance.cambio.subscribe((p) => elegidos.push(p));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { falso, fixture, elegidos };
}

describe('MapaPuntoComponent', () => {
  afterEach(() => Reflect.deleteProperty(globalThis, 'L'));

  it('abre en Lima sin pin cuando todavía no hay punto', async () => {
    const { falso } = await montar({ lat: null, lng: null });
    expect(falso.vistas[0]).toEqual([-12.0464, -77.0428]);
    expect(falso.pines).toHaveLength(0);
  });

  it('abre centrado en el punto guardado y pone el pin arrastrable', async () => {
    const { falso } = await montar({ lat: -12.2122, lng: -76.9339 });
    expect(falso.vistas[0]).toEqual([-12.2122, -76.9339]);
    expect(falso.pines).toHaveLength(1);
    expect(falso.pines[0].draggable).toBe(true);
  });

  it('un clic en el mapa emite el punto con 6 decimales', async () => {
    const { falso, elegidos } = await montar({ lat: null, lng: null });
    falso.clic?.({ latlng: { lat: -12.21220099, lng: -76.93390049 } });
    expect(elegidos).toEqual([{ latitud: -12.212201, longitud: -76.933900 }]);
  });

  it('arrastrar el pin emite la nueva posición', async () => {
    const { falso, elegidos } = await montar({ lat: -12.2, lng: -76.9 });
    falso.pines[0].posicion = [-12.25, -76.95];
    falso.pines[0].alSoltar?.();
    expect(elegidos).toEqual([{ latitud: -12.25, longitud: -76.95 }]);
  });

  it('en solo lectura el clic no cambia nada y el pin no se arrastra', async () => {
    const { falso, elegidos } = await montar({ lat: -12.2, lng: -76.9, soloLectura: true });
    falso.clic?.({ latlng: { lat: 1, lng: 2 } });
    expect(elegidos).toEqual([]);
    expect(falso.pines[0].draggable).toBe(false);
  });

  it('si se vacían las coordenadas el pin se quita; si cambian, se mueve', async () => {
    const { falso, fixture } = await montar({ lat: -12.2, lng: -76.9 });
    fixture.componentRef.setInput('latitud', -12.3);
    fixture.detectChanges();
    expect(falso.pines[0].posicion).toEqual([-12.3, -76.9]);
    fixture.componentRef.setInput('latitud', null);
    fixture.detectChanges();
    expect(falso.pines[0].quitado).toBe(true);
  });

  it('sin Leaflet (sin internet) avisa y no falla', async () => {
    const fixture = TestBed.createComponent(MapaPuntoComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('El mapa no está disponible');
  });
});
