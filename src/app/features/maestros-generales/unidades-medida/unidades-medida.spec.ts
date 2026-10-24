import { TestBed } from '@angular/core/testing';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { CuerpoRespuesta, botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Equivalencia, UnidadMedida, UnidadMedidaOpcion } from './unidades-medida.models';
import { UnidadesMedidaComponent } from './unidades-medida';

const CIENTO: UnidadMedida = { id: 1, codigo: 'CIEN', descripcion: 'CIENTO', simbolo: '100', estado: true };
const UNIDAD: UnidadMedidaOpcion = { id: 2, nombre: 'UNIDAD (und)' };
const EQ: Equivalencia = { id: 7, id_uni_med_origen: 1, id_uni_med_destino: 2, factor_conversion: '100', estado: true };

const BOTONES = { nueva: 'Nueva unidad', editar: 'Editar', desactivar: 'Desactivar', equivalencias: 'Equivalencias' };

function responder(req: HttpRequest<unknown>): CuerpoRespuesta {
  if (req.url.endsWith('/maestros/unidad-medida/select')) return [{ id: 1, nombre: 'CIENTO (100)' }, UNIDAD];
  if (req.url.endsWith('/equivalencias')) return { data: [EQ], page: 1, pageSize: 100, total: 1, totalPages: 1 };
  return { data: [CIENTO], page: 1, pageSize: 20, total: 1, totalPages: 1 };
}

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(UnidadesMedidaComponent, misPermisos('Usuario', { 'maestros.generales': acciones }), responder);
  expect(p.el.textContent).toContain('CIEN');
  return p;
}

describe('UnidadesMedidaComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: lista y Equivalencias, sin Nueva, Editar ni Desactivar', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nueva: false, editar: false, desactivar: false, equivalencias: true });
  });

  it('crear → Nueva unidad; editar → Editar; eliminar → Desactivar', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toMatchObject({ nueva: true, editar: false, desactivar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toMatchObject({ nueva: false, editar: true, desactivar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES)).toMatchObject({ nueva: false, editar: false, desactivar: true });
  });

  it('el buscador filtra por el campo elegido y vuelve a la página 1', async () => {
    const { el, http, render } = await montar({});
    const campo = el.querySelector<HTMLSelectElement>('select[aria-label="Buscar en"]');
    if (!campo) throw new Error('falta el selector de campo');
    campo.value = 'codigo';
    campo.dispatchEvent(new Event('change'));
    const input = el.querySelector<HTMLInputElement>('input[aria-label="Buscar unidad de medida"]');
    if (!input) throw new Error('falta el buscador');
    input.value = 'KG';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 400));
    const req = http.expectOne((r) => r.url.endsWith('/maestros/unidad-medida') && r.params.get('codigo') === 'KG');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.has('descripcion')).toBe(false);
    req.flush({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    await render();
  });

  it('las equivalencias muestran la unidad destino por nombre', async () => {
    const { el, http, render } = await montar({});
    const boton = el.querySelector<HTMLButtonElement>('button[title="Equivalencias"]');
    if (!boton) throw new Error('falta el botón Equivalencias');
    boton.click();
    await render();
    http.expectOne((r) => r.url.endsWith('/maestros/unidad-medida/1/equivalencias')).flush(responder(new HttpRequest('GET', '/equivalencias')));
    await render();
    expect(el.textContent).toContain('1 CIENTO = 100 UNIDAD (und)');
  });
});
