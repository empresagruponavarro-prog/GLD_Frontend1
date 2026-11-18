import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { misPermisos } from '@app/core/auth/auth.testing';
import { ClaveModulo, Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { DocumentoPendiente } from '../tesoreria.models';
import { Agenda, Programacion } from '../tesoreria.models';
import { ProgramacionComponent } from './programacion';

const PROGRAMADO: Programacion = {
  id: 3,
  id_documento_origen: 40,
  numero_documento: 'F001-123',
  clase_documento: 'FACTURA',
  proveedor: 'ACME SAC',
  centro_costo: null,
  moneda_id: 'PEN',
  moneda_simbolo: 'S/',
  concepto: 'PROVEEDOR',
  fecha_programada: '2026-10-23',
  urgente: false,
  monto: '100',
  monto_soles: '100',
  medio_pago: 'TRANSFERENCIA',
  id_cuenta: null,
  cuenta: null,
  cuenta_destino: null,
  estado: 'PROGRAMADO',
  observaciones: null,
};

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/tesoreria/programacion/pendientes')) return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  if (req.url.endsWith('/tesoreria/programacion')) {
    const agenda: Agenda = { items: [PROGRAMADO], sin_tipo_cambio: 0, totales_por_fecha: [] };
    return agenda;
  }
  return [];
}

const BOTONES = {
  programar: 'Programar seleccionados',
  reprogramar: 'Reprogramar',
  cancelar: 'Cancelar programación',
  pagos: 'Ejecutar pagos',
};

async function montar(acciones: Partial<Permisos>, otros: Partial<Record<ClaveModulo, Partial<Permisos>>> = {}) {
  const permisos = misPermisos('Tesorero', { 'tesoreria.programacion': acciones, ...otros });
  const p = await montarPantalla(ProgramacionComponent, permisos, responder);
  expect(p.el.textContent).toContain('ACME SAC');
  return p;
}

describe('ProgramacionComponent: botones según permisos (tesoreria.programacion)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver no aparecen Programar, Reprogramar ni Cancelar programación', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ programar: false, reprogramar: false, cancelar: false, pagos: false });
  });

  it('crear → Programar; editar → Reprogramar; anular → Cancelar programación', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ programar: true, reprogramar: false, cancelar: false, pagos: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ programar: false, reprogramar: true, cancelar: false, pagos: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ anular: true })).el, BOTONES)).toEqual({ programar: false, reprogramar: false, cancelar: true, pagos: false });
  });

  it('el enlace "Ejecutar pagos" solo aparece con acceso a tesoreria.pagos', async () => {
    const { el } = await montar({}, { 'tesoreria.pagos': {} });
    expect(botonesVisibles(el, BOTONES)).toEqual({ programar: false, reprogramar: false, cancelar: false, pagos: true });
  });
});


// ------------------------------------------------------------ plan 09: tope por avance de obra

const OS_PPTO: DocumentoPendiente = {
  id: 77,
  numero_documento: 'OS-000077',
  numero_oc: null,
  clase_documento: 'ORDEN_SERVICIO',
  estado: 'REGISTRADO',
  id_anexo: null,
  proveedor: 'CONTRATISTA SAC',
  ruc: '20111111111',
  id_centro_costo: 3,
  centro_costo: 'TIENDA NORTE',
  id_centro_costos_principal: null,
  centro_costo_principal: null,
  id_area: null,
  area_nombre: null,
  id_requerimiento: 9,
  numero_requerimiento: 'FUR-000009',
  fecha_emision: '2026-11-01',
  forma_pago: 'Contado',
  moneda_id: 'PEN',
  moneda_simbolo: 'S/',
  afecto_igv: true,
  monto: '1000',
  igv: '180',
  total: '1180',
  renta_4ta: '0',
  dscto_compras: '0',
  dscto_intervencion: '0',
  dscto_otros: '0',
  detraccion_porcentaje: null,
  detraccion_monto: null,
  retencion_porcentaje: null,
  retencion_monto: null,
  retencion_manual: false,
  comentarios: null,
  dias_credito: null,
  fecha_vencimiento_manual: null,
  ultima_recepcion: null,
  vencimiento: '2026-12-01',
  pendiente_recepcion: false,
  neto_proveedor: '1180',
  pagado_proveedor: '0',
  pagado_detraccion: '0',
  programado_proveedor: '0',
  programado_detraccion: '0',
  saldo_por_pagar_proveedor: '1180',
  saldo_por_pagar_detraccion: '0',
  fecha_ultimo_pago: null,
  estado_pago: 'SIN_PROGRAMAR',
  // Adelanto 30 % (354): lo único que se puede pagar mientras la obra no avance.
  tope_avance: { adelanto_porcentaje: 30, avance_pct: 0, pct_aplicado: 30, tope: 354, pagado: 0, programado: 0, disponible: 354, sugerido: 354 },
};

function responderConTope(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/tesoreria/programacion/pendientes')) return { data: [OS_PPTO], total: 1, page: 1, pageSize: 20, totalPages: 1 };
  if (req.url.endsWith('/tesoreria/programacion')) return { items: [], sin_tipo_cambio: 0, totales_por_fecha: [] };
  return [];
}

async function montarConTope() {
  const p = await montarPantalla(ProgramacionComponent, misPermisos('Tesorero', { 'tesoreria.programacion': { crear: true } }), responderConTope);
  expect(p.el.textContent).toContain('OS-000077');
  return p;
}

const clic = async (p: { el: HTMLElement; render: () => Promise<void> }, texto: string) => {
  Array.from(p.el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto))?.click();
  await p.render();
};

async function abrirLote(p: Awaited<ReturnType<typeof montarConTope>>) {
  p.el.querySelector<HTMLInputElement>('input[aria-label="Seleccionar OS-000077"]')?.click();
  await p.render();
  await clic(p, 'Programar seleccionados');
}

function escribir(el: HTMLElement, selector: string, valor: string) {
  const campo = el.querySelector<HTMLInputElement>(selector);
  expect(campo).not.toBeNull();
  campo!.value = valor;
  campo!.dispatchEvent(new Event('input'));
}

describe('ProgramacionComponent: tope de pago por avance de obra (plan 09)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('la tabla muestra adelanto, avance, lo que libera y lo disponible de una OS de presupuesto', async () => {
    const { el } = await montarConTope();
    const tope = el.querySelector('[data-testid="tope-avance"]');
    expect(tope?.textContent).toContain('Adelanto 30 %');
    expect(tope?.textContent).toContain('avance 0 %');
    expect(el.textContent).toContain('Libera S/ 354.00');
    expect(el.textContent).toContain('disponible 354.00');
  });

  it('el lote propone lo que libera el avance (el adelanto), no todo el saldo', async () => {
    const p = await montarConTope();
    await abrirLote(p);
    expect(p.el.querySelector<HTMLInputElement>('input[aria-label="Monto OS-000077 · CONTRATISTA SAC"]')?.value).toBe('354.00');
    expect(p.el.textContent).toContain('Libera el avance');
    expect(p.el.textContent).toContain('Por encima del avance');
  });

  it('programar más de lo que libera el avance se rechaza sin llamar al servidor, salvo «Por encima del avance» con motivo', async () => {
    const p = await montarConTope();
    await abrirLote(p);
    escribir(p.el, 'input[aria-label="Monto OS-000077 · CONTRATISTA SAC"]', '600');

    await clic(p, 'Programar pagos');
    expect(p.el.querySelector('[role="alert"]')?.textContent).toContain('supera lo que libera el avance de obra');
    p.http.expectNone((r) => r.url.endsWith('/tesoreria/programacion') && r.method === 'POST');

    // Con la casilla pero sin motivo tampoco.
    p.el.querySelector<HTMLInputElement>('input[aria-label="Por encima del avance OS-000077 · CONTRATISTA SAC"]')?.click();
    await p.render();
    await clic(p, 'Programar pagos');
    expect(p.el.querySelector('[role="alert"]')?.textContent).toContain('indique en Observaciones el motivo');
    p.http.expectNone((r) => r.url.endsWith('/tesoreria/programacion') && r.method === 'POST');

    // Con casilla y motivo se manda `exceder_avance`.
    escribir(p.el, '#prog-obs', 'ADELANTO AUTORIZADO POR GERENCIA');
    await clic(p, 'Programar pagos');
    const req = p.http.expectOne((r) => r.url.endsWith('/tesoreria/programacion') && r.method === 'POST');
    expect(req.request.body.items[0]).toMatchObject({ id_documento_origen: 77, concepto: 'PROVEEDOR', monto: '600', exceder_avance: true, observaciones: 'ADELANTO AUTORIZADO POR GERENCIA' });
    req.flush([{ id: 1 }]);
    await p.render();
    for (const r of p.http.match(() => true)) r.flush(responderConTope(r.request));
  });

  it('dentro de lo que libera el avance se programa sin pedir motivo ni mandar exceder_avance', async () => {
    const p = await montarConTope();
    await abrirLote(p);
    await clic(p, 'Programar pagos');
    const req = p.http.expectOne((r) => r.url.endsWith('/tesoreria/programacion') && r.method === 'POST');
    expect(req.request.body.items[0].monto).toBe('354.00');
    expect(req.request.body.items[0].exceder_avance).toBeUndefined();
    req.flush([{ id: 1 }]);
    await p.render();
    for (const r of p.http.match(() => true)) r.flush(responderConTope(r.request));
  });

  it('un documento sin tope no muestra avance ni la casilla', async () => {
    const sinTope: DocumentoPendiente = { ...OS_PPTO, id: 78, numero_documento: 'OC-000078', clase_documento: 'ORDEN_COMPRA', tope_avance: null };
    const responder = (req: HttpRequest<unknown>) =>
      req.url.endsWith('/tesoreria/programacion/pendientes') ? { data: [sinTope], total: 1, page: 1, pageSize: 20, totalPages: 1 } : responderConTope(req);
    const p = await montarPantalla(ProgramacionComponent, misPermisos('Tesorero', { 'tesoreria.programacion': { crear: true } }), responder);
    expect(p.el.querySelector('[data-testid="tope-avance"]')).toBeNull();
    p.el.querySelector<HTMLInputElement>('input[aria-label="Seleccionar OC-000078"]')?.click();
    await p.render();
    await clic(p, 'Programar seleccionados');
    expect(p.el.textContent).not.toContain('Por encima del avance');
    expect(p.el.querySelector<HTMLInputElement>('input[aria-label="Monto OC-000078 · CONTRATISTA SAC"]')?.value).toBe('1180.00');
  });
});
