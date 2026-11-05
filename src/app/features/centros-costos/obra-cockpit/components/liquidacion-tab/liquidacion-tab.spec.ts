import { montarConCarga } from '../../obra-cockpit.testing';
import { DosierObra, GastoObra, LiquidacionObra } from '../../obra-liquidacion.interface';
import { LiquidacionTabComponent } from './liquidacion-tab';

const PLANOS_COMPLETOS = { total: 2, obligatorios: 2, entregados_obligatorios: 2, faltantes: [], completo: true };

const LISTA: LiquidacionObra = {
  id_centro_costo: 10,
  estado_cc: 'POR LIQUIDAR',
  liquidada: false,
  fecha_liquidacion: null,
  liquidado_por: null,
  fecha_fin_real: '2026-10-30',
  avance_real: 100,
  puede_liquidar: true,
  requisitos: [
    { codigo: 'ESTADO', cumplido: true, mensaje: 'El centro de costo está POR LIQUIDAR' },
    { codigo: 'AVANCE', cumplido: true, mensaje: 'Avance real al 100 %' },
    { codigo: 'PLANOS', cumplido: true, mensaje: 'Planos obligatorios entregados' },
  ],
  planos: PLANOS_COMPLETOS,
};

const INCOMPLETA: LiquidacionObra = {
  ...LISTA,
  puede_liquidar: false,
  requisitos: [...LISTA.requisitos.slice(0, 2), { codigo: 'PLANOS', cumplido: false, mensaje: 'Faltan 1 plano(s) obligatorio(s)' }],
  planos: { total: 2, obligatorios: 2, entregados_obligatorios: 1, faltantes: [{ id_tipo_plano: 2, codigo: 'EST', nombre: 'ESTRUCTURAS' }], completo: false },
};

const DOSIER: DosierObra = {
  id_centro_costo: 10,
  nombre_obra: 'Tienda Norte',
  fecha: '2026-11-05',
  planos: PLANOS_COMPLETOS,
  secciones: [
    { codigo: 'PRESUPUESTO_META', titulo: 'Presupuesto Meta', disponible: true, referencias: ['PRE-26-001'] },
    { codigo: 'PRESUPUESTO_COMERCIAL', titulo: 'Presupuesto Comercial', disponible: false, referencias: [], nota: 'Aún no existe el presupuesto comercial' },
  ],
};

const esGet = (r: { method: string; url: string }) => r.method === 'GET' && r.url.endsWith('/operaciones/obra/10/liquidacion');
const esGasto = (r: { method: string; url: string }) => r.method === 'GET' && r.url.endsWith('/operaciones/obra/10/gasto');

const GASTO: GastoObra = {
  id_centro_costo: 10,
  subfases: [
    { id_ppto_detalle_categoria: 40, subfase: 'MATERIALES', meta: 500, directo: 0, indirecto: 21, compromiso: 179, ejecutado: 21, proyectado: 200, saldo: 300, sobre_meta: false },
    { id_ppto_detalle_categoria: 41, subfase: 'SERVICIOS', meta: 100, directo: 90, indirecto: 0, compromiso: 80, ejecutado: 90, proyectado: 170, saldo: -70, sobre_meta: true },
    { id_ppto_detalle_categoria: null, subfase: 'Sin subfase', meta: null, directo: 10, indirecto: 0, compromiso: 0, ejecutado: 10, proyectado: 10, saldo: null, sobre_meta: false },
  ],
  total: { meta: 600, directo: 100, indirecto: 21, compromiso: 259, ejecutado: 121, proyectado: 380, saldo: 220 },
  lineas_sin_tipo_cambio: 0,
};

const abrir = async (datos: LiquidacionObra, puedeLiquidar: boolean, gasto: GastoObra = GASTO) => {
  return montarConCarga(LiquidacionTabComponent, { idCentroCosto: 10, puedeLiquidar }, (http) => {
    http.expectOne(esGet).flush(datos);
    http.expectOne(esGasto).flush(gasto);
  });
};

const clic = (el: HTMLElement, selector: string) => el.querySelector<HTMLButtonElement>(selector)!.click();

describe('LiquidacionTabComponent: liquidación y dosier (GRP T59)', () => {
  it('lista los requisitos y habilita Liquidar cuando se cumplen todos', async () => {
    const { el } = await abrir(LISTA, true);

    expect(el.querySelectorAll('[data-requisito]')).toHaveLength(3);
    expect(el.textContent).toContain('POR LIQUIDAR');
    expect(el.querySelector<HTMLButtonElement>('#btn-liquidar')?.disabled).toBe(false);
    expect(el.querySelector('[data-testid="planos-faltantes"]')).toBeNull();
  });

  it('con planos obligatorios faltantes los nombra y deshabilita Liquidar', async () => {
    const { el } = await abrir(INCOMPLETA, true);

    expect(el.querySelector('[data-testid="planos-faltantes"]')?.textContent).toContain('EST · ESTRUCTURAS');
    expect(el.querySelector<HTMLButtonElement>('#btn-liquidar')?.disabled).toBe(true);
    expect(el.textContent).toContain('Se habilita cuando se cumplen todos los requisitos');
  });

  it('sin el permiso aprobar no hay botón Liquidar (el dosier sí se puede emitir)', async () => {
    const { el } = await abrir(LISTA, false);

    expect(el.querySelector('#btn-liquidar')).toBeNull();
    expect(el.querySelector('#btn-emitir-dosier')).not.toBeNull();
  });

  it('liquidar pide confirmación y solo el segundo clic envía el POST', async () => {
    const { el, http, render, fixture } = await abrir(LISTA, true);
    const avisos: unknown[] = [];
    fixture.componentInstance.liquidada.subscribe(() => avisos.push(1));

    clic(el, '#btn-liquidar');
    await render();
    http.expectNone((r) => r.method === 'POST');
    expect(el.textContent).toContain('no se deshace');

    clic(el, '#btn-liquidar');
    const post = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/operaciones/obra/10/liquidacion'));
    const liquidada = { ...LISTA, liquidada: true, estado_cc: 'CERRADO', fecha_liquidacion: '2026-11-05', liquidado_por: 'ana', puede_liquidar: false };
    post.flush(liquidada);
    // Tras liquidar se vuelve a pedir la liquidación: se responde antes de esperar (rxResource pendiente).
    fixture.detectChanges();
    http.expectOne(esGet).flush(liquidada);
    http.expectOne(esGasto).flush(GASTO);
    await render();

    expect(avisos).toHaveLength(1);
    expect(el.querySelector('[data-testid="liquidada"]')?.textContent).toContain('Liquidada el 2026-11-05 por ana');
    expect(el.querySelector('#btn-liquidar')).toBeNull();
  });

  it('cancelar la confirmación no envía nada', async () => {
    const { el, http, render } = await abrir(LISTA, true);

    clic(el, '#btn-liquidar');
    await render();
    el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.textContent?.includes('Cancelar') && b.click());
    await render();

    http.expectNone((r) => r.method === 'POST');
    expect(el.querySelector('#btn-liquidar')?.textContent).toContain('Liquidar obra');
  });

  it('un error al liquidar muestra el mensaje del servidor', async () => {
    const { el, http, render } = await abrir(LISTA, true);

    clic(el, '#btn-liquidar');
    await render();
    clic(el, '#btn-liquidar');
    http.expectOne((r) => r.method === 'POST').flush({ message: 'Faltan planos obligatorios' }, { status: 409, statusText: 'Conflict' });
    await render();

    expect(el.textContent).toContain('Faltan planos obligatorios');
  });

  it('Emitir dosier lista las secciones y marca las no disponibles con su nota', async () => {
    const { el, http, render } = await abrir(LISTA, true);

    clic(el, '#btn-emitir-dosier');
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/operaciones/obra/10/dosier')).flush(DOSIER);
    await render();

    const secciones = el.querySelector('[data-testid="dosier-secciones"]')!;
    expect(secciones.textContent).toContain('Presupuesto Meta');
    expect(secciones.textContent).toContain('PRE-26-001');
    expect(secciones.textContent).toContain('Aún no existe el presupuesto comercial');
  });

  it('si el dosier responde 409 muestra por qué', async () => {
    const { el, http, render } = await abrir(INCOMPLETA, true);

    clic(el, '#btn-emitir-dosier');
    http.expectOne((r) => r.url.endsWith('/dosier')).flush({ message: 'Faltan planos obligatorios: EST' }, { status: 409, statusText: 'Conflict' });
    await render();

    expect(el.querySelector('[data-testid="dosier-error"]')?.textContent).toContain('Faltan planos obligatorios: EST');
    expect(el.querySelector('[data-testid="dosier-secciones"]')).toBeNull();
  });

  it('muestra el gasto por subfase frente a la meta, con directo, indirecto y compromiso', async () => {
    const { el } = await abrir(LISTA, true);
    const filas = Array.from(el.querySelectorAll('[data-testid="gasto-subfase"] tbody tr'));

    expect(filas).toHaveLength(3);
    const materiales = el.querySelector('[data-subfase="40"]')!;
    expect(materiales.textContent).toContain('MATERIALES');
    expect(materiales.textContent).toContain('500.00'); // meta
    expect(materiales.textContent).toContain('21.00'); // indirecto
    expect(materiales.textContent).toContain('179.00'); // compromiso
    expect(el.querySelector('[data-testid="gasto-total"]')?.textContent).toContain('380.00');
  });

  it('marca en rojo la subfase que supera su meta y deja el saldo sin meta en blanco', async () => {
    const { el } = await abrir(LISTA, true);

    expect(el.querySelector('[data-subfase="41"]')?.className).toContain('text-error');
    expect(el.querySelector('[data-subfase="41"]')?.textContent).toContain('-70.00');
    expect(el.querySelector('[data-subfase="40"]')?.className).not.toContain('text-error');
    expect(el.querySelector('tbody tr:last-child')?.textContent).toContain('Sin subfase');
    expect(el.querySelector('tbody tr:last-child')?.textContent).toContain('—');
  });

  it('avisa si hay líneas en otra moneda sin tipo de cambio', async () => {
    const { el } = await abrir(LISTA, true, { ...GASTO, lineas_sin_tipo_cambio: 2 });

    expect(el.querySelector('[data-testid="gasto-sin-tc"]')?.textContent).toContain('2 línea(s)');
  });

  it('una obra sin gasto ni presupuesto lo dice', async () => {
    const { el } = await abrir(LISTA, true, { ...GASTO, subfases: [] });

    expect(el.querySelector('[data-testid="gasto-subfase"]')?.textContent).toContain('aún no tiene presupuesto aprobado');
  });

  it('tras emitir el dosier ofrece abrirlo para imprimir o guardar como PDF', async () => {
    const { el, http, render } = await abrir(LISTA, true);
    expect(el.querySelector('#abrir-dosier')).toBeNull();

    clic(el, '#btn-emitir-dosier');
    http.expectOne((r) => r.url.endsWith('/dosier')).flush(DOSIER);
    await render();

    const enlace = el.querySelector<HTMLAnchorElement>('#abrir-dosier')!;
    expect(enlace.getAttribute('href')).toBe('/imprimir/dosier/10');
    expect(enlace.target).toBe('_blank');
  });
});
