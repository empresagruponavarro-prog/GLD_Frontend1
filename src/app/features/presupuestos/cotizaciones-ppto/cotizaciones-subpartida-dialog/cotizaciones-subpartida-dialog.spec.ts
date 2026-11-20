import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { montarPantalla } from '@app/core/auth/pantalla.testing';
import { CuadroComparativoPpto, CuadroLineaPpto, PptoCotizacion } from '../cotizaciones-ppto.models';
import { CotizacionesSubpartidaDialogComponent } from './cotizaciones-subpartida-dialog';

const oferta = (id_cotizacion: number, id_cot_detalle: number, precio: string, cotiza = true) => ({
  id_cotizacion,
  id_cot_detalle,
  cotiza,
  cantidad: '10',
  precio_sin_igv: precio,
  precio_con_igv: '0',
  subtotal_sin_igv: (Number(precio) * 10).toFixed(2),
  plazo_entrega_dias: null,
  cantidad_completa: cotiza,
});

const linea = (id: number, extra: Partial<CuadroLineaPpto> = {}): CuadroLineaPpto => ({
  id_ppto_item: id,
  numero_item: null,
  id_subfase: 1,
  subfase: 'DEMOLICIONES',
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
  total_sin_igv: '80.00',
  igv: '14.40',
  total: '94.40',
  total_soles: '94.40',
  tc_usado: null,
  items_ganados: 0,
  es_ganadora: false,
  total_global: '80.00',
  ...extra,
});

function cuadro(extra: Partial<CuadroComparativoPpto> = {}): CuadroComparativoPpto {
  return {
    id_presupuesto: 7,
    codigo_presupuesto: 'PPTO-2026-007',
    estado: 'EN_DESARROLLO',
    id_detalle_categoria: 31,
    subpartida: 'DEMOLICIONES',
    id_detalle_fase: 12,
    fase: 'IMPLEMENTACION',
    items_total: 2,
    items_adjudicados: 2,
    id_cotizacion_ganadora: 100,
    lineas: [
      linea(1, { id_cot_detalle_ganadora: 1001, id_cotizacion_ganadora: 100 }),
      linea(2, { id_cot_detalle_ganadora: 1002, id_cotizacion_ganadora: 100 }),
    ],
    proveedores: [proveedor(100, 'ACME SAC', { es_ganadora: true, items_ganados: 2 }), proveedor(200, 'BETA EIRL', { total_sin_igv: '90.00', total: '106.20' })],
    ...extra,
  };
}

const cotizacion = (id: number, protegida = false): PptoCotizacion =>
  ({ id, numero: `COT-${id}`, id_presupuesto: 7, id_detalle_fase: 12, fase: 'IMPLEMENTACION', id_detalle_categoria: 31, subpartida: 'DEMOLICIONES', id_proveedor: id, proveedor: `P${id}`, protegida, lineas: [] }) as unknown as PptoCotizacion;

async function montar(acciones: Partial<Permisos>, c: CuadroComparativoPpto = cuadro(), cotizaciones: PptoCotizacion[] = [cotizacion(100), cotizacion(200)]) {
  const responder = (req: HttpRequest<unknown>) => {
    if (req.url.includes('/cuadro-comparativo')) return c;
    if (req.url.endsWith('/presupuestos/7/cotizaciones')) return cotizaciones;
    return [];
  };
  return montarPantalla(CotizacionesSubpartidaDialogComponent, misPermisos('Operaciones', { presupuestos: acciones }), responder, [], {
    idPresupuesto: 7,
    idDetalleCategoria: 31,
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
const elegirRadio = async (p: { el: HTMLElement; render: () => Promise<void> }, i: number) => {
  radios(p.el)[i].click();
  radios(p.el)[i].dispatchEvent(new Event('change'));
  await p.render();
};

describe('CotizacionesSubpartidaDialogComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra el cuadro de la subpartida con un total por proveedor y el ganador elegido', async () => {
    const { el } = await montar({ crear: true, editar: true });
    expect(el.textContent).toContain('Cotizaciones · DEMOLICIONES');
    expect(el.textContent).toContain('PPTO-2026-007');
    expect(el.textContent).toContain('IMPLEMENTACION');
    expect(el.textContent).toContain('ACME SAC');
    expect(el.textContent).toContain('BETA EIRL');
    expect(el.textContent).toContain('Total de la subpartida (sin IGV)');
    expect(el.textContent).toContain('Registrar cotización');
    // Un solo radio por proveedor (la subpartida va completa a uno): gana ACME.
    expect(radios(el)).toHaveLength(2);
    expect(radios(el)[0].checked).toBe(true);
    expect(radios(el)[1].checked).toBe(false);
    expect(el.textContent).toContain('Proveedor de la subpartida: ACME SAC');
  });

  it('el desglose por ítem muestra la parte del total que le toca a cada uno', async () => {
    const { el } = await montar({ crear: true, editar: true });
    expect(el.textContent).toContain('P-1');
    expect(el.textContent).toContain('P-2');
    expect(el.textContent).toContain('40.00'); // 10 × 4 por ítem con ACME
    expect(el.textContent).toContain('45.00'); // 10 × 4.5 por ítem con BETA
  });

  it('elegir otro proveedor habilita «Guardar proveedor» y manda la subpartida y la cotización', async () => {
    const p = await montar({ crear: true, editar: true });
    expect(boton(p.el, 'Guardar proveedor')?.disabled).toBe(true);

    await elegirRadio(p, 1); // BETA
    expect(boton(p.el, 'Guardar proveedor')?.disabled).toBe(false);

    boton(p.el, 'Guardar proveedor')?.click();
    const req = p.http.expectOne((r: HttpRequest<unknown>) => r.url.endsWith('/presupuestos/7/adjudicacion'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ id_detalle_categoria: 31, id_cotizacion: 200, comentario: undefined });
    req.flush({
      adjudicados: 2,
      liberados: 0,
      sin_cambio: 0,
      compromisos: { creados: [{ id_requerimiento: 9, numero: 'FUR-000009', fase: 'F', id_proveedor: 200, proveedor: 'BETA EIRL', documentos: [{ id: 5, numero_documento: 'OC-000005', clase: 'ORDEN_COMPRA' }] }], actualizados: [], anulados: [], sin_cambio: 0 },
    });
    // Después de guardar se vuelve a leer el cuadro y las cotizaciones.
    await atender(p);
    expect(p.el.textContent).toContain('Proveedor de la subpartida guardado');
    expect(p.el.textContent).toContain('FUR-000009');
    expect(p.el.textContent).toContain('OC-000005');
  });

  it('«Quitar proveedor» manda id_cotizacion null (explícito)', async () => {
    const p = await montar({ crear: true, editar: true });
    boton(p.el, 'Quitar proveedor')?.click();
    await p.render();
    boton(p.el, 'Guardar proveedor')?.click();
    const req = p.http.expectOne((r: HttpRequest<unknown>) => r.url.endsWith('/presupuestos/7/adjudicacion'));
    expect(req.request.body).toEqual({ id_detalle_categoria: 31, id_cotizacion: null, comentario: undefined });
    req.flush({ adjudicados: 0, liberados: 2, sin_cambio: 0, compromisos: { creados: [], actualizados: [], anulados: [], sin_cambio: 0 } });
    await atender(p);
  });

  it('volver al proveedor guardado deja de contar como cambio', async () => {
    const p = await montar({ crear: true, editar: true });
    await elegirRadio(p, 1);
    expect(boton(p.el, 'Guardar proveedor')?.disabled).toBe(false);
    await elegirRadio(p, 0);
    expect(boton(p.el, 'Guardar proveedor')?.disabled).toBe(true);
  });

  it('una subpartida sin cotizaciones lo avisa y solo ofrece registrar', async () => {
    const sin = cuadro({ proveedores: [], id_cotizacion_ganadora: null, items_adjudicados: 0, lineas: [linea(1, { ofertas: [] }), linea(2, { ofertas: [] })] });
    const { el } = await montar({ crear: true, editar: true }, sin, []);
    expect(el.textContent).toContain('Aún no hay cotizaciones para esta subpartida');
    expect(radios(el)).toHaveLength(0);
    expect(boton(el, 'Registrar cotización')).toBeDefined();
  });

  it('con una orden registrada en la subpartida no se cambia de proveedor y se muestra su orden', async () => {
    const c = cuadro({
      lineas: [
        linea(1, {
          id_cot_detalle_ganadora: 1001,
          id_cotizacion_ganadora: 100,
          cubierto: true,
          compromiso: { id_requerimiento: 3, numero_requerimiento: 'FUR-000003', estado_requerimiento: 'APROBADO', id_documento: 8, numero_documento: 'OC-000008', estado_documento: 'REGISTRADO' },
        }),
        linea(2, { id_cot_detalle_ganadora: 1002, id_cotizacion_ganadora: 100 }),
      ],
    });
    const { el } = await montar({ crear: true, editar: true }, c);
    expect(radios(el).every((r) => r.disabled)).toBe(true);
    expect(el.textContent).toContain('OC-000008');
    expect(el.textContent).toContain('Registrada');
    expect(el.textContent).toContain('anule primero la orden');
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
    expect(boton(el, 'Guardar proveedor')).toBeUndefined();
    expect(boton(el, 'Registrar cotización')).toBeUndefined();
  });

  it('un presupuesto entregado, liquidado o anulado es solo de consulta', async () => {
    const { el } = await montar({ crear: true, editar: true, eliminar: true }, cuadro({ estado: 'LIQUIDADO' }));
    expect(el.textContent).toContain('Presupuesto LIQUIDADO: solo consulta');
    expect(radios(el).every((r) => r.disabled)).toBe(true);
    expect(boton(el, 'Registrar cotización')).toBeUndefined();
    expect(boton(el, 'Guardar proveedor')).toBeUndefined();
  });
});
