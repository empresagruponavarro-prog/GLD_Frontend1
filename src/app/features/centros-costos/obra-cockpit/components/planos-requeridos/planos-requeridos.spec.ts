import { montar, montarConCarga } from '../../obra-cockpit.testing';
import { PlanoRequerido, PlanosRequeridosObra } from '../../obra-liquidacion.interface';
import { PlanosRequeridosComponent, agruparPorDisciplina } from './planos-requeridos';

const plano = (id: number, codigo: string, disciplina: string | null, extra: Partial<PlanoRequerido> = {}): PlanoRequerido => ({
  id_tipo_plano: id,
  codigo,
  nombre: `PLANO ${codigo}`,
  disciplina,
  obligatorio: true,
  entregado: false,
  entregado_por: null,
  entregado_en: null,
  archivo: null,
  ...extra,
});

const LISTA: PlanosRequeridosObra = {
  id_centro_costo: 10,
  id_tipo_proyecto: 2,
  tipo_proyecto: 'TAMBO',
  items: [
    plano(1, 'A01', 'ARQUITECTURA', { entregado: true, entregado_por: 'ana', entregado_en: '2026-11-01', archivo: { id_plano: 50, version: 'v2.0', formato_peso: 'PDF (1 MB)' } }),
    plano(2, 'A02', 'ARQUITECTURA', { archivo: { id_plano: 51, version: 'v1.0', formato_peso: null } }),
    plano(3, 'SE01', 'ARQUITECTURA', { obligatorio: false }),
    plano(4, 'IS01', 'SANITARIAS'),
  ],
  resumen: {
    total: 4,
    obligatorios: 3,
    entregados_obligatorios: 1,
    faltantes: [
      { id_tipo_plano: 2, codigo: 'A02', nombre: 'PLANO A02' },
      { id_tipo_plano: 4, codigo: 'IS01', nombre: 'PLANO IS01' },
    ],
    completo: false,
  },
};

const esLista = (r: { method: string; url: string }) => r.method === 'GET' && r.url.endsWith('/operaciones/obra/10/planos-requeridos');

const abrir = async (puedeEditar: boolean, puedeSubir = puedeEditar) =>
  montarConCarga(PlanosRequeridosComponent, { idCentroCosto: 10, puedeEditar, puedeSubir }, (http) => http.expectOne(esLista).flush(LISTA));

const check = (el: HTMLElement, id: number) => el.querySelector<HTMLInputElement>(`#plano-req-${id}`);
const cabecera = (el: HTMLElement, clave: string) => el.querySelector<HTMLButtonElement>(`[data-testid="grupo-${clave}"] button`)!;
const desplegar = async (el: HTMLElement, render: () => Promise<void>, clave = 'ARQUITECTURA') => {
  cabecera(el, clave).click();
  await render();
};

describe('agruparPorDisciplina (planos · versión K)', () => {
  it('agrupa en el orden de la lista y cuenta los completados de cada disciplina', () => {
    const grupos = agruparPorDisciplina(LISTA.items);
    expect(grupos.map((g) => [g.clave, g.titulo, g.items.length, g.completados])).toEqual([
      ['ARQUITECTURA', 'PLANOS DE ARQUITECTURA', 3, 1],
      ['SANITARIAS', 'PLANOS DE SANITARIAS', 1, 0],
    ]);
  });

  it('los planos sin disciplina van a «Otros planos»', () => {
    expect(agruparPorDisciplina([plano(9, 'X1', null), plano(8, 'X2', '  ')]).map((g) => [g.clave, g.titulo, g.items.length])).toEqual([['OTROS', 'OTROS PLANOS', 2]]);
  });

});

describe('PlanosRequeridosComponent: checklist de planos (GRP T58 · versión K)', () => {
  it('al entrar muestra las cabeceras recogidas con su avance y el contador de obligatorios', async () => {
    const { el } = await abrir(true);

    expect(el.textContent).toContain('TAMBO');
    expect(el.querySelector('[data-testid="planos-contador"]')?.textContent).toContain('1 de 3 obligatorios entregados');
    expect(cabecera(el, 'ARQUITECTURA').textContent).toContain('PLANOS DE ARQUITECTURA');
    expect(cabecera(el, 'ARQUITECTURA').textContent).toContain('1 de 3 completados');
    expect(cabecera(el, 'SANITARIAS').textContent).toContain('0 de 1 completados');
    expect(check(el, 1)).toBeNull();
  });

  it('una cabecera se despliega y se recoge con un clic; las demás siguen recogidas', async () => {
    const { el, render } = await abrir(true);

    await desplegar(el, render);
    expect(cabecera(el, 'ARQUITECTURA').getAttribute('aria-expanded')).toBe('true');
    expect(check(el, 1)?.checked).toBe(true);
    expect(check(el, 2)?.checked).toBe(false);
    expect(check(el, 4)).toBeNull();
    expect(el.textContent).toContain('Obligatorio');

    await desplegar(el, render);
    expect(check(el, 1)).toBeNull();
  });

  it('sin archivo el check está bloqueado y aparece «Subir»; con archivo, su versión y «Nueva versión»', async () => {
    const { el, fixture, render } = await abrir(true);
    const subidos: string[] = [];
    const versiones: string[] = [];
    fixture.componentInstance.subir.subscribe((p) => subidos.push(p.codigo));
    fixture.componentInstance.nuevaVersion.subscribe((p) => versiones.push(p.codigo));
    await desplegar(el, render);

    expect(check(el, 3)?.disabled).toBe(true);
    expect(check(el, 2)?.disabled).toBe(false);
    expect(el.textContent).toContain('v2.0');
    el.querySelector<HTMLButtonElement>('[aria-label="Subir archivo de SE01"]')?.click();
    el.querySelector<HTMLButtonElement>('[aria-label="Nueva versión de A02"]')?.click();
    expect(subidos).toEqual(['SE01']);
    expect(versiones).toEqual(['A02']);
  });

  it('sin editar los checks están deshabilitados, no hay «Nueva versión» y no se envía nada', async () => {
    const { el, http, render } = await abrir(false);
    await desplegar(el, render);

    expect(check(el, 2)?.disabled).toBe(true);
    expect(el.querySelector('[aria-label="Nueva versión de A02"]')).toBeNull();
    expect(el.querySelector('[aria-label="Subir archivo de SE01"]')).toBeNull();
    check(el, 2)?.dispatchEvent(new Event('change'));
    http.expectNone((r) => r.method === 'PUT');
  });

  it('con editar, marcar un plano con archivo envía el PUT y actualiza el contador con la respuesta', async () => {
    const { el, http, render } = await abrir(true);
    await desplegar(el, render);

    check(el, 2)?.dispatchEvent(new Event('change'));
    const put = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/planos-requeridos/2'));
    expect(put.request.body).toEqual({ entregado: true });
    put.flush({
      ...LISTA,
      items: LISTA.items.map((i) => (i.id_tipo_plano === 2 ? { ...i, entregado: true, entregado_por: 'luis' } : i)),
      resumen: { ...LISTA.resumen, entregados_obligatorios: 2, faltantes: [LISTA.resumen.faltantes[1]] },
    });
    await render();

    expect(el.querySelector('[data-testid="planos-contador"]')?.textContent).toContain('2 de 3 obligatorios entregados');
    expect(cabecera(el, 'ARQUITECTURA').textContent).toContain('2 de 3 completados');
    expect(check(el, 2)?.checked).toBe(true);
    expect(el.textContent).toContain('Completado por luis');
  });

  it('si el servidor rechaza el check muestra el mensaje y no cambia nada', async () => {
    const { el, http, render } = await abrir(true);
    await desplegar(el, render);

    check(el, 2)?.dispatchEvent(new Event('change'));
    http.expectOne((r) => r.method === 'PUT').flush({ message: 'La obra ya está liquidada' }, { status: 409, statusText: 'Conflict' });
    await render();

    expect(el.textContent).toContain('La obra ya está liquidada');
    expect(el.querySelector('[data-testid="planos-contador"]')?.textContent).toContain('1 de 3');
  });

  it('al cambiar «recarga» vuelve a pedir la lista (p. ej. tras subir un archivo)', async () => {
    const { fixture, http, render } = await abrir(true);

    fixture.componentRef.setInput('recarga', 1);
    fixture.detectChanges(); // la nueva petición queda pendiente: no se espera a que la vista quede estable

    http.expectOne(esLista).flush(LISTA);
    await render();
  });

  it('sin obra (id nulo) no pide nada ni se dibuja', async () => {
    const { el, http } = await montar(PlanosRequeridosComponent, { idCentroCosto: null, puedeEditar: true });

    http.expectNone(() => true);
    expect(el.querySelector('[data-testid="planos-requeridos"]')).toBeNull();
  });
});
