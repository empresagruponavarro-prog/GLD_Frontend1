import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { environment } from '@env';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Pantalla, botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { CuadroComparativo, CuadroProveedor, Requerimiento } from '../requerimientos.models';
import { lineaRequerimiento, paginaDe, requerimiento } from '../requerimientos.testing';
import { BandejaAprobacionComponent } from './bandeja-aprobacion';

const API = `${environment.apiUrl}/requerimientos`;

const CAJA = requerimiento({ id: 5, numero: 'FUR-000005', estado: 'ENVIADO', tipo: 'CAJA_CHICA' });
const COMPRA = requerimiento({ id: 6, numero: 'FUR-000006', estado: 'COTIZADO', tipo: 'COMPRA', total_cotizaciones: 1 });

const PROVEEDOR: CuadroProveedor = {
  id_cotizacion: 70,
  numero: 'COT-000070',
  id_proveedor: 4,
  proveedor: 'ACME SAC',
  moneda_id: 'PEN',
  moneda_simbolo: 'S/',
  forma_pago: 'Contado',
  dias_credito: 0,
  adelanto_porcentaje: null,
  medio_pago: null,
  plazo_entrega_dias: null,
  validez_dias: null,
  garantia: null,
  condiciones: null,
  afecto_igv: true,
  incluye_igv: false,
  total_sin_igv: '250',
  igv: '45',
  total: '295',
  total_soles: null,
  tc_usado: null,
  es_ganadora: false,
};

const CUADRO: CuadroComparativo = {
  id_requerimiento: 6,
  numero: 'FUR-000006',
  estado: 'COTIZADO',
  tipo: 'COMPRA',
  id_cotizacion_ganadora: null,
  comentario_adjudicacion: null,
  lineas: [],
  proveedores: [PROVEEDOR],
};

function responder(req: HttpRequest<unknown>) {
  if (req.url === API) {
    return req.params.get('estado') === 'COTIZADO' ? paginaDe([COMPRA]) : paginaDe([CAJA]);
  }
  return [];
}

const ACCIONES = { observar: 'Observar', rechazar: 'Rechazar', aprobar: 'Aprobar', elegir: 'Elegir' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(BandejaAprobacionComponent, misPermisos('Jefe de Área', { 'requerimientos.aprobacion': acciones }), responder);
  expect(p.el.textContent).toContain('FUR-000005');
  return p;
}

/** Pulsa "Revisar" en la fila del requerimiento y responde su detalle (y el cuadro si es compra). */
async function revisar(p: Pantalla<BandejaAprobacionComponent>, r: Requerimiento): Promise<void> {
  const fila = Array.from(p.el.querySelectorAll('tbody tr')).find((f) => f.textContent?.includes(r.numero));
  const boton = Array.from(fila?.querySelectorAll('button') ?? []).find((b) => b.textContent?.includes('Revisar'));
  expect(boton).toBeDefined();
  boton?.click();
  await p.render();
  p.http.expectOne(`${API}/${r.id}`).flush({ ...r, lineas: [lineaRequerimiento()] });
  await p.render();
  if (r.tipo === 'COMPRA') {
    p.http.expectOne(`${API}/${r.id}/cuadro-comparativo`).flush(CUADRO);
    await p.render();
  }
}

function controles(el: HTMLElement): (HTMLInputElement | HTMLTextAreaElement)[] {
  return Array.from(el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.bandeja-form input, .bandeja-form textarea'));
}

describe('BandejaAprobacionComponent: revisión según permisos (requerimientos.aprobacion)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: "Revisar" disponible; la revisión es de solo lectura, sin Observar/Rechazar/Aprobar', async () => {
    const p = await montar({});
    expect(p.el.querySelectorAll('tbody tr button').length).toBe(2);
    await revisar(p, CAJA);
    expect(botonesVisibles(p.el, ACCIONES)).toEqual({ observar: false, rechazar: false, aprobar: false, elegir: false });
    const campos = controles(p.el);
    expect(campos.length).toBeGreaterThan(0);
    expect(campos.every((c) => c.disabled)).toBe(true);
    expect(p.el.querySelector('[data-testid="revision-solo-lectura"]')?.textContent).toContain('Solo lectura');
  });

  it('con solo ver en una compra: no se puede elegir ganador; imprimir el cuadro sigue disponible', async () => {
    const p = await montar({});
    await revisar(p, COMPRA);
    expect(p.el.textContent).toContain('ACME SAC');
    expect(botonesVisibles(p.el, { elegir: 'Elegir', imprimir: 'Imprimir cuadro' })).toEqual({ elegir: false, imprimir: true });
    expect(controles(p.el).every((c) => c.disabled)).toBe(true);
  });

  it('con aprobar: Observar, Rechazar, Aprobar y Elegir; el formulario es editable', async () => {
    const p = await montar({ aprobar: true });
    await revisar(p, COMPRA);
    expect(botonesVisibles(p.el, ACCIONES)).toEqual({ observar: true, rechazar: true, aprobar: true, elegir: true });
    expect(controles(p.el).every((c) => !c.disabled)).toBe(true);
    expect(p.el.querySelector('[data-testid="revision-solo-lectura"]')).toBeNull();
  });
});
