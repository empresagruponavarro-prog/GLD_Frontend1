import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { montarPantalla } from '@app/core/auth/pantalla.testing';
import { CuadroComparativoPpto, CuadroLineaPpto, PptoCotizacion } from '../cotizaciones-ppto.models';
import { CotizacionesFaseDialogComponent } from './cotizaciones-fase-dialog';

const oferta = (id_cotizacion: number, id_cot_detalle: number, precio: string, cantidad_completa = true) => ({
  id_cotizacion,
  id_cot_detalle,
  cotiza: true,
  cantidad: cantidad_completa ? '10' : '6',
  precio_sin_igv: precio,
  precio_con_igv: '0',
  subtotal_sin_igv: (Number(precio) * 10).toFixed(2),
  plazo_entrega_dias: null,
  cantidad_completa,
});

const linea = (id: number, extra: Partial<CuadroLineaPpto> = {}): CuadroLineaPpto => ({
  id_ppto_item: id,
  numero_item: null,
  id_subfase: 1,
  subfase: 'MATERIALES',
  codigo: `P-${id}`,
  descripcion: `Producto ${id}`,
  unidad: 'UND',
  cantidad: '10',
  costo_unitario_meta: '5',
  costo_total_meta: '50',
  id_cot_detalle_ganadora: null,
  id_cotizacion_ganadora: null,
  adjudicado_por: null,
  fecha_adjudicacion: null,
  comentario_adjudicacion: null,
  cantidad_distinta: false,
  cubierto: false,
  compromiso: null,
  ofertas: [oferta(100, 1000 + id, '4'), oferta(200, 2000 + id, '4.5')],
  ...extra,
});

const proveedor = (id_cotizacion: number, nombre: string, extra = {}) => ({
  id_cotizacion,
  numero: `COT-00000${id_cotizacion / 100}`,
  id_proveedor: id_cotizacion,
  proveedor: nombre,
  moneda_id: 'PEN',
  moneda_simbolo: 'S/',
  forma_pago: 'Contado',
  dias_credito: 0,
  adelanto_porcentaje: '30',
  medio_pago: null,
  plazo_entrega_dias: 15,
  validez_dias: null,
  garantia: '6 MESES',
  condiciones: null,
  afecto_igv: true,
  incluye_igv: false,
  total_sin_igv: '100.00',
  igv: '18.00',
  total: '118.00',
  total_soles: '118.00',
  tc_usado: null,
  items_ganados: 0,
  ...extra,
});

function cuadro(extra: Partial<CuadroComparativoPpto> = {}): CuadroComparativoPpto {
  return {
    id_presupuesto: 7,
    codigo_presupuesto: 'PPTO-2026-007',
    estado: 'EN_DESARROLLO',
    id_detalle_fase: 12,
    fase: 'PRELIMINARES',
    items_total: 2,
    items_adjudicados: 1,
    lineas: [linea(1, { id_cot_detalle_ganadora: 1001, id_cotizacion_ganadora: 100 }), linea(2, { ofertas: [oferta(100, 1002, '4', false), oferta(200, 2002, '4.5')] })],
    proveedores: [proveedor(100, 'ACME SAC'), proveedor(200, 'BETA EIRL')],
    ...extra,
  };
}

const cotizacion = (id: number, protegida = false): PptoCotizacion =>
  ({ id, numero: `COT-${id}`, id_presupuesto: 7, id_detalle_fase: 12, fase: 'PRELIMINARES', id_proveedor: id, proveedor: `P${id}`, protegida, lineas: [] }) as unknown as PptoCotizacion;

async function montar(acciones: Partial<Permisos>, c: CuadroComparativoPpto = cuadro(), cotizaciones: PptoCotizacion[] = [cotizacion(100), cotizacion(200)]) {
  const responder = (req: HttpRequest<unknown>) => {
    if (req.url.includes('/cuadro-comparativo')) return c;
    if (req.url.endsWith('/presupuestos/7/cotizaciones')) return cotizaciones;
    return [];
  };
  return montarPantalla(CotizacionesFaseDialogComponent, misPermisos('Operaciones', { presupuestos: acciones }), responder, [], {
    idPresupuesto: 7,
    idDetalleFase: 12,
  });
}

/** Responde las peticiones que el componente encadena al recargar (primero el cuadro y después las cotizaciones). */
async function atender(p: { http: HttpTestingController; render: () => Promise<void> }, c: CuadroComparativoPpto = cuadro()) {
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    await p.render();
    const pendientes = p.http.match(() => true);
    if (pendientes.length === 0) break;
    for (const r of pendientes) r.flush(r.request.url.includes('/cuadro-comparativo') ? c : []);
  }
}

const radios = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
const boton = (el: HTMLElement, texto: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as HTMLButtonElement | undefined;

describe('CotizacionesFaseDialogComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra el cuadro ítem × proveedor con el ganador marcado y el avance de adjudicación', async () => {
    const { el } = await montar({ crear: true, editar: true });
    expect(el.textContent).toContain('Cotizaciones · PRELIMINARES');
    expect(el.textContent).toContain('PPTO-2026-007');
    expect(el.textContent).toContain('1 de 2 ítems con proveedor');
    expect(el.textContent).toContain('ACME SAC');
    expect(el.textContent).toContain('BETA EIRL');
    expect(radios(el)).toHaveLength(4);
    // Ítem 1: gana ACME (oferta 1001).
    expect(radios(el)[0].checked).toBe(true);
    expect(radios(el)[1].checked).toBe(false);
    expect(el.textContent).toContain('Registrar cotización');
  });

  it('una oferta que no cubre la cantidad completa no se puede elegir', async () => {
    const { el } = await montar({ crear: true, editar: true });
    // Ítem 2: ACME cotiza 6 de 10 (no completa) y BETA 10.
    expect(radios(el)[2].disabled).toBe(true);
    expect(el.textContent).toContain('no cubre el ítem completo');
    expect(radios(el)[3].disabled).toBe(false);
  });

  it('elegir un ganador habilita «Guardar adjudicación» y lo manda con el ítem y la oferta', async () => {
    const p = await montar({ crear: true, editar: true });
    expect(boton(p.el, 'Guardar adjudicación')?.disabled).toBe(true);

    radios(p.el)[3].click(); // BETA para el ítem 2
    radios(p.el)[3].dispatchEvent(new Event('change'));
    await p.render();
    expect(boton(p.el, 'Guardar adjudicación (1)')?.disabled).toBe(false);

    boton(p.el, 'Guardar adjudicación')?.click();
    const req = p.http.expectOne((r: HttpRequest<unknown>) => r.url.endsWith('/presupuestos/7/adjudicacion'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ items: [{ id_ppto_item: 2, id_cot_detalle: 2002 }], comentario: undefined });
    req.flush({
      adjudicados: 1,
      liberados: 0,
      sin_cambio: 0,
      compromisos: { creados: [{ id_requerimiento: 9, numero: 'FUR-000009', fase: 'F', id_proveedor: 200, proveedor: 'BETA EIRL', documentos: [{ id: 5, numero_documento: 'OC-000005', clase: 'ORDEN_COMPRA' }] }], actualizados: [], anulados: [], sin_cambio: 0 },
    });
    // Después de guardar se vuelve a leer el cuadro y las cotizaciones.
    await atender(p);
    expect(p.el.textContent).toContain('Adjudicación guardada');
    expect(p.el.textContent).toContain('FUR-000009');
    expect(p.el.textContent).toContain('OC-000005');
  });

  it('«Quitar proveedor» manda el ítem con id_cot_detalle null (explícito)', async () => {
    const p = await montar({ crear: true, editar: true });
    boton(p.el, 'Quitar proveedor')?.click();
    await p.render();
    boton(p.el, 'Guardar adjudicación')?.click();
    const req = p.http.expectOne((r: HttpRequest<unknown>) => r.url.endsWith('/presupuestos/7/adjudicacion'));
    expect(req.request.body.items).toEqual([{ id_ppto_item: 1, id_cot_detalle: null }]);
    req.flush({ adjudicados: 0, liberados: 1, sin_cambio: 0, compromisos: { creados: [], actualizados: [], anulados: [], sin_cambio: 0 } });
    await atender(p);
  });

  it('volver a la elección guardada deja de contar como cambio', async () => {
    const p = await montar({ crear: true, editar: true });
    radios(p.el)[1].click();
    radios(p.el)[1].dispatchEvent(new Event('change'));
    await p.render();
    expect(boton(p.el, 'Guardar adjudicación (1)')).toBeDefined();
    radios(p.el)[0].click();
    radios(p.el)[0].dispatchEvent(new Event('change'));
    await p.render();
    expect(boton(p.el, 'Guardar adjudicación')?.disabled).toBe(true);
  });

  it('un ítem con una orden registrada no se puede cambiar y muestra su orden', async () => {
    const c = cuadro({
      lineas: [
        linea(1, {
          id_cot_detalle_ganadora: 1001,
          id_cotizacion_ganadora: 100,
          cubierto: true,
          compromiso: { id_requerimiento: 3, numero_requerimiento: 'FUR-000003', estado_requerimiento: 'APROBADO', id_documento: 8, numero_documento: 'OC-000008', estado_documento: 'REGISTRADO' },
        }),
      ],
    });
    const { el } = await montar({ crear: true, editar: true }, c);
    expect(radios(el).every((r) => r.disabled)).toBe(true);
    expect(el.textContent).toContain('OC-000008');
    expect(el.textContent).toContain('Registrada');
    expect(el.textContent).toContain('anule la orden');
    expect(boton(el, 'Quitar proveedor')).toBeUndefined();
  });

  it('una cotización con una orden registrada es de consulta: sin editar ni eliminar', async () => {
    const { el } = await montar({ crear: true, editar: true, eliminar: true }, cuadro(), [cotizacion(100, true), cotizacion(200)]);
    expect(el.textContent).toContain('Con orden');
    // Solo la cotización 200 ofrece editar y eliminar.
    expect(el.querySelectorAll('button[title="Editar"]')).toHaveLength(1);
    expect(el.querySelectorAll('button[title="Eliminar"]')).toHaveLength(1);
  });

  it('sin permiso de editar no se puede elegir al ganador ni guardar', async () => {
    const { el } = await montar({});
    expect(radios(el).every((r) => r.disabled)).toBe(true);
    expect(boton(el, 'Guardar adjudicación')).toBeUndefined();
    expect(boton(el, 'Registrar cotización')).toBeUndefined();
  });

  it('un presupuesto entregado, liquidado o anulado es solo de consulta', async () => {
    const { el } = await montar({ crear: true, editar: true, eliminar: true }, cuadro({ estado: 'LIQUIDADO' }));
    expect(el.textContent).toContain('Presupuesto LIQUIDADO: solo consulta');
    expect(radios(el).every((r) => r.disabled)).toBe(true);
    expect(boton(el, 'Registrar cotización')).toBeUndefined();
    expect(boton(el, 'Guardar adjudicación')).toBeUndefined();
  });
});
