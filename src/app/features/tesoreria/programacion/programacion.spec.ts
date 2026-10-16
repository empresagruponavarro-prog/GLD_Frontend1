import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { misPermisos } from '@app/core/auth/auth.testing';
import { ClaveModulo, Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
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
