import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { MisPermisos } from '@app/core/auth/permisos.models';
import { hayBoton, montarPantalla, responderVacio } from '@app/core/auth/pantalla.testing';
import { Consulta } from '../almacen.models';
import { ConsultaAlmacenComponent } from './consulta';

const CONSULTA: Consulta = {
  producto: {
    id: 10,
    codigo: 'EQP-0001',
    descripcion: 'Taladro',
    categoria: 'Equipos',
    familia: null,
    uso_principal: null,
    unidad: 'UND',
    clase_inventario: 'EQUIPO_RETORNABLE',
    estado_operativo: 'OPERATIVO',
    almacen_default: null,
    stock_total: '3',
    disponible: '2',
    stock_minimo: '0',
    stock_objetivo: '0',
    costo_promedio: '100',
  },
  coincidencias: [],
  stock_por_almacen: [
    { id_almacen: 1, almacen: 'Almacén General', cantidad: '3', prestado: '0', no_operativo: '1', disponible: '2' },
  ],
  alternativas: [],
};

async function consultar(permisos: MisPermisos) {
  const { el, http, render } = await montarPantalla(ConsultaAlmacenComponent, permisos, responderVacio);
  const input = el.querySelector('input');
  if (!input) throw new Error('Sin buscador');
  input.value = 'EQP-0001';
  input.dispatchEvent(new Event('input'));
  await render();
  el.querySelector('form')?.dispatchEvent(new Event('submit'));
  http.expectOne((r) => r.url.endsWith('/almacen/consulta')).flush(CONSULTA);
  await render();
  expect(el.textContent).toContain('Almacén General');
  return el;
}

describe('ConsultaAlmacenComponent: Marcar operativo según permisos', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver (consulta y stock) no aparece Marcar operativo', async () => {
    const el = await consultar(misPermisos('Usuario', { 'almacen.consulta': {}, 'almacen.stock': {} }));
    expect(hayBoton(el, 'Marcar operativo')).toBe(false);
  });

  it('aparece con editar en almacen.consulta', async () => {
    const el = await consultar(misPermisos('Usuario', { 'almacen.consulta': { editar: true } }));
    expect(hayBoton(el, 'Marcar operativo')).toBe(true);
  });

  it('aparece con editar en almacen.stock', async () => {
    const el = await consultar(misPermisos('Usuario', { 'almacen.consulta': {}, 'almacen.stock': { editar: true } }));
    expect(hayBoton(el, 'Marcar operativo')).toBe(true);
  });
});
