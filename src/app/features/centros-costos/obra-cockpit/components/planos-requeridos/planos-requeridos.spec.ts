import { montar, montarConCarga } from '../../obra-cockpit.testing';
import { PlanosRequeridosObra } from '../../obra-liquidacion.interface';
import { PlanosRequeridosComponent } from './planos-requeridos';

const LISTA: PlanosRequeridosObra = {
  id_centro_costo: 10,
  id_tipo_proyecto: 2,
  tipo_proyecto: 'TAMBO',
  items: [
    { id_tipo_plano: 1, codigo: 'ARQ', nombre: 'ARQUITECTURA', obligatorio: true, entregado: true, entregado_por: 'ana', entregado_en: '2026-11-01' },
    { id_tipo_plano: 2, codigo: 'EST', nombre: 'ESTRUCTURAS', obligatorio: true, entregado: false, entregado_por: null, entregado_en: null },
    { id_tipo_plano: 3, codigo: 'DET', nombre: 'DETALLES', obligatorio: false, entregado: false, entregado_por: null, entregado_en: null },
  ],
  resumen: { total: 3, obligatorios: 2, entregados_obligatorios: 1, faltantes: [{ id_tipo_plano: 2, codigo: 'EST', nombre: 'ESTRUCTURAS' }], completo: false },
};

const esLista = (r: { method: string; url: string }) => r.method === 'GET' && r.url.endsWith('/operaciones/obra/10/planos-requeridos');

const abrir = async (puedeEditar: boolean) => {
  return montarConCarga(PlanosRequeridosComponent, { idCentroCosto: 10, puedeEditar }, (http) => http.expectOne(esLista).flush(LISTA));
};

const check = (el: HTMLElement, id: number) => el.querySelector<HTMLInputElement>(`#plano-req-${id}`)!;

describe('PlanosRequeridosComponent: checklist de planos (GRP T58)', () => {
  it('muestra la lista con su contador «n de m» de obligatorios', async () => {
    const { el } = await abrir(true);

    expect(el.textContent).toContain('TAMBO');
    expect(el.querySelector('[data-testid="planos-contador"]')?.textContent).toContain('1 de 2 obligatorios entregados');
    expect(check(el, 1).checked).toBe(true);
    expect(check(el, 2).checked).toBe(false);
    expect(el.textContent).toContain('Obligatorio');
  });

  it('sin editar los checks están deshabilitados y no se envía nada', async () => {
    const { el, http } = await abrir(false);

    expect(check(el, 2).disabled).toBe(true);
    check(el, 2).dispatchEvent(new Event('change'));
    http.expectNone((r) => r.method === 'PUT');
  });

  it('con editar, marcar un plano envía el PUT y actualiza el contador con la respuesta', async () => {
    const { el, http, render } = await abrir(true);

    check(el, 2).dispatchEvent(new Event('change'));
    const put = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/planos-requeridos/2'));
    expect(put.request.body).toEqual({ entregado: true });
    put.flush({
      ...LISTA,
      items: LISTA.items.map((i) => (i.id_tipo_plano === 2 ? { ...i, entregado: true, entregado_por: 'luis' } : i)),
      resumen: { ...LISTA.resumen, entregados_obligatorios: 2, faltantes: [], completo: true },
    });
    await render();

    expect(el.querySelector('[data-testid="planos-contador"]')?.textContent).toContain('2 de 2 obligatorios entregados');
    expect(check(el, 2).checked).toBe(true);
  });

  it('si el servidor rechaza el check muestra el mensaje y no cambia nada', async () => {
    const { el, http, render } = await abrir(true);

    check(el, 2).dispatchEvent(new Event('change'));
    http.expectOne((r) => r.method === 'PUT').flush({ message: 'La obra ya está liquidada' }, { status: 409, statusText: 'Conflict' });
    await render();

    expect(el.textContent).toContain('La obra ya está liquidada');
    expect(el.querySelector('[data-testid="planos-contador"]')?.textContent).toContain('1 de 2');
  });

  it('sin obra (id nulo) no pide nada ni se dibuja', async () => {
    const { el, http } = await montar(PlanosRequeridosComponent, { idCentroCosto: null, puedeEditar: true });

    http.expectNone(() => true);
    expect(el.querySelector('[data-testid="planos-requeridos"]')).toBeNull();
  });
});
