import { TestBed } from '@angular/core/testing';
import { LocalOpcion } from '../interfaces/equipo-asignado.interface';
import { UbicacionDestinoComponent } from './ubicacion-destino';
import { DESTINO_VACIO, DestinoSeleccionado, cuerpoDestino, errorDestino } from './ubicacion-destino.util';

const LOCALES: LocalOpcion[] = [
  {
    id: 10,
    nombre: 'SEDE',
    destino: 'GLD SERVICIOS',
    destinoTipo: 'EMPRESA',
    destinoId: 1,
    niveles: [{ id: 20, nombre: 'PISO 1', ambientes: [{ id: 30, nombre: 'SISTEMAS', areaId: 5 }] }],
  },
];

describe('ubicacion-destino util', () => {
  it('pide lo que falta según el tipo de destino', () => {
    expect(errorDestino(DESTINO_VACIO)).toContain('empresa o a un centro de costo');
    expect(errorDestino({ ...DESTINO_VACIO, tipo: 'CENTRO_COSTO' })).toContain('centro de costo');
    expect(errorDestino({ ...DESTINO_VACIO, tipo: 'EMPRESA' })).toBe('Selecciona la empresa.');
    expect(errorDestino({ ...DESTINO_VACIO, tipo: 'EMPRESA', destinoId: 1 })).toContain('local, el nivel y el ambiente');
    expect(errorDestino({ tipo: 'EMPRESA', destinoId: 1, localId: 10, nivelId: 20, ambienteId: 30, areaId: 0 })).toBeNull();
    expect(errorDestino({ ...DESTINO_VACIO, tipo: 'CENTRO_COSTO', destinoId: 951 })).toBeNull();
  });

  it('un centro de costo se envía sin ubicación; una empresa con local, nivel, ambiente y área', () => {
    expect(cuerpoDestino({ ...DESTINO_VACIO, tipo: 'CENTRO_COSTO', destinoId: 951, localId: 10 })).toEqual({
      destinoTipo: 'CENTRO_COSTO',
      destinoId: 951,
    });
    expect(cuerpoDestino({ tipo: 'EMPRESA', destinoId: 1, localId: 10, nivelId: 20, ambienteId: 30, areaId: 5 })).toEqual({
      destinoTipo: 'EMPRESA',
      destinoId: 1,
      localId: 10,
      nivelId: 20,
      ambienteId: 30,
      areaId: 5,
    });
  });
});

describe('UbicacionDestinoComponent', () => {
  function montar() {
    const fixture = TestBed.createComponent(UbicacionDestinoComponent);
    fixture.componentRef.setInput('locales', LOCALES);
    fixture.componentRef.setInput('empresas', [{ id: 1, nombre: 'GLD SERVICIOS' }]);
    fixture.componentRef.setInput('centrosCosto', [
      { id: 951, nombre: 'TAMBO PRUEBA' },
      { id: 559, nombre: 'ARUMA PROCERES' },
    ]);
    fixture.componentRef.setInput('areas', [{ id: 5, nombre: 'SISTEMAS' }]);
    const emitidos: DestinoSeleccionado[] = [];
    fixture.componentInstance.cambio.subscribe((d) => emitidos.push(d));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    return { fixture, el, emitidos };
  }

  function elegir(el: HTMLElement, selector: string, valor: string): void {
    const select = el.querySelector<HTMLSelectElement>(selector);
    expect(select).not.toBeNull();
    if (!select) return;
    select.value = valor;
    select.dispatchEvent(new Event('change'));
  }

  it('empresa: toma el único local solo y pide nivel y ambiente; el área sale de la ubicación', () => {
    const { fixture, el, emitidos } = montar();
    el.querySelectorAll<HTMLButtonElement>('.ud__opcion')[0]?.click();
    fixture.detectChanges();
    elegir(el, '#ud-empresa', '1');
    fixture.detectChanges();
    expect(el.querySelector('#ud-local')).toBeNull(); // un solo local: no se pregunta
    elegir(el, '#ud-nivel', '20');
    fixture.detectChanges();
    elegir(el, '#ud-ambiente', '30');
    fixture.detectChanges();
    expect(emitidos.at(-1)).toEqual({ tipo: 'EMPRESA', destinoId: 1, localId: 10, nivelId: 20, ambienteId: 30, areaId: 5 });
  });

  it('centro de costo: se escribe el nombre y queda elegido al coincidir con uno de la lista', () => {
    const { fixture, el, emitidos } = montar();
    el.querySelectorAll<HTMLButtonElement>('.ud__opcion')[1]?.click();
    fixture.detectChanges();
    const campo = el.querySelector<HTMLInputElement>('#ud-centro');
    expect(campo).not.toBeNull();
    if (!campo) return;
    campo.value = 'tambo';
    campo.dispatchEvent(new Event('input'));
    expect(emitidos.at(-1)?.destinoId).toBe(0);
    campo.value = 'TAMBO PRUEBA';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(emitidos.at(-1)).toMatchObject({ tipo: 'CENTRO_COSTO', destinoId: 951, localId: 0 });
    expect(el.textContent).toContain('Centro de costo seleccionado');
  });
});
