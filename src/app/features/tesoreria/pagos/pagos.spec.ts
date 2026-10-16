import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { misPermisos } from '@app/core/auth/auth.testing';
import { ClaveModulo, Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Agenda, Pago, Programacion, TipoCambioVigente } from '../tesoreria.models';
import { PagosComponent } from './pagos';

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

const PAGO: Pago = {
  id: 9,
  numero: 'CP-000009',
  id_documento_origen: 41,
  numero_documento: 'F001-200',
  clase_documento: 'FACTURA',
  numero_requerimiento: null,
  proveedor: 'Beta SAC',
  ruc: null,
  centro_costo: null,
  moneda_id: 'PEN',
  moneda_simbolo: 'S/',
  concepto: 'PROVEEDOR',
  fecha_pago: '2026-10-10',
  monto: '50',
  moneda_cuenta: 'PEN',
  tipo_cambio: null,
  monto_cuenta: '50',
  medio_pago: 'TRANSFERENCIA',
  id_cuenta: 1,
  cuenta: 'BCP Soles',
  banco: 'BCP',
  numero_cuenta: null,
  cuenta_destino: null,
  numero_operacion: null,
  ejecutado_por: null,
  estado: 'REGISTRADO',
  observaciones: null,
  created_at: '2026-10-10T10:00:00Z',
};

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/tesoreria/programacion')) {
    const agenda: Agenda = { items: [PROGRAMADO], sin_tipo_cambio: 0, totales_por_fecha: [] };
    return agenda;
  }
  if (req.url.endsWith('/tesoreria/pagos')) return { data: [PAGO], total: 1, page: 1, pageSize: 20, totalPages: 1 };
  if (req.url.endsWith('/tipo-cambio/vigente')) {
    const tc: TipoCambioVigente = { fecha: '2026-10-16', compra: '3.75', venta: '3.78', exacto: true };
    return tc;
  }
  return [];
}

const BOTONES = { ejecutar: 'Ejecutar', anular: 'Anular pago', programacion: 'Programación' };

async function montar(acciones: Partial<Permisos>, otros: Partial<Record<ClaveModulo, Partial<Permisos>>> = {}) {
  const permisos = misPermisos('Tesorero', { 'tesoreria.pagos': acciones, ...otros });
  const p = await montarPantalla(PagosComponent, permisos, responder);
  expect(p.el.textContent).toContain('ACME SAC');
  expect(p.el.textContent).toContain('CP-000009');
  return p;
}

describe('PagosComponent: botones según permisos (tesoreria.pagos)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: Ejecutar sí (basta el acceso), Anular pago no', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ ejecutar: true, anular: false, programacion: false });
  });

  it('con anular aparece Anular pago', async () => {
    const { el } = await montar({ anular: true });
    expect(botonesVisibles(el, BOTONES)).toEqual({ ejecutar: true, anular: true, programacion: false });
  });

  it('el enlace "Programación" solo aparece con acceso a tesoreria.programacion', async () => {
    const { el } = await montar({}, { 'tesoreria.programacion': {} });
    expect(botonesVisibles(el, BOTONES)).toEqual({ ejecutar: true, anular: false, programacion: true });
  });
});
