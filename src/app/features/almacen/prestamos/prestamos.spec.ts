import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Paginated, Prestamo } from '../almacen.models';
import { PrestamosComponent } from './prestamos';

const ABIERTO: Prestamo = {
  id: 1,
  numero: 'PRE-000001',
  fecha_prestamo: '2026-10-01',
  id_almacen: 1,
  almacen: 'Almacén General',
  id_centro_costo: null,
  centro_costo: null,
  id_responsable: 5,
  responsable: 'Juan Pérez',
  documento_referencia: null,
  dias_autorizados: 7,
  fecha_prevista_retorno: '2026-10-08',
  estado: 'ABIERTO',
  estado_plazo: 'EN_PLAZO',
  dias_fuera: 2,
  observaciones: null,
  created_at: '2026-10-01T10:00:00Z',
  total_lineas: 1,
};

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/almacen/prestamos')) {
    const pagina: Paginated<Prestamo> = { data: [ABIERTO], total: 1, page: 1, pageSize: 20, totalPages: 1 };
    return pagina;
  }
  return [];
}

const BOTONES = { nuevo: 'Nuevo préstamo', retorno: 'Registrar retorno', anular: 'Anular', detalle: 'Ver detalle' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(PrestamosComponent, misPermisos('Almacenero', { 'almacen.prestamos': acciones }), responder);
  expect(p.el.textContent).toContain('PRE-000001');
  return p;
}

describe('PrestamosComponent: botones según permisos (almacen.prestamos)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: solo "Ver detalle" (sin Nuevo, Registrar retorno ni Anular)', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nuevo: false, retorno: false, anular: false, detalle: true });
  });

  it('crear → Nuevo; editar → Registrar retorno; anular → Anular', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ nuevo: true, retorno: false, anular: false, detalle: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ nuevo: false, retorno: true, anular: false, detalle: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ anular: true })).el, BOTONES)).toEqual({ nuevo: false, retorno: false, anular: true, detalle: true });
  });
});
