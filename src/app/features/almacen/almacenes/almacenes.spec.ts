import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Almacen, Paginated } from '../almacen.models';
import { AlmacenesComponent } from './almacenes';

const ACTIVO: Almacen = { id: 1, codigo: 'ALM-GENERAL', nombre: 'Almacén General', id_empresa: null, estado: true };
const INACTIVO: Almacen = { id: 2, codigo: 'ALM-TAMBO', nombre: 'Tambo', id_empresa: null, estado: false };

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/almacen/almacenes')) {
    const pagina: Paginated<Almacen> = { data: [ACTIVO, INACTIVO], total: 2, page: 1, pageSize: 20, totalPages: 1 };
    return pagina;
  }
  return [];
}

const BOTONES = { nuevo: 'Nuevo almacén', editar: 'Editar', desactivar: 'Desactivar' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(AlmacenesComponent, misPermisos('Usuario', { 'almacen.almacenes': acciones }), responder);
  expect(p.el.textContent).toContain('ALM-GENERAL');
  return p;
}

describe('AlmacenesComponent: botones según permisos (almacen.almacenes)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver no aparecen Nuevo, Editar ni Desactivar', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nuevo: false, editar: false, desactivar: false });
    expect(el.querySelector('app-modal .modal-overlay')).toBeNull();
  });

  it('crear → Nuevo; editar → Editar; eliminar → Desactivar (solo en almacenes activos)', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ nuevo: true, editar: false, desactivar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ nuevo: false, editar: true, desactivar: false });
    TestBed.resetTestingModule();
    const { el } = await montar({ eliminar: true });
    expect(botonesVisibles(el, BOTONES)).toEqual({ nuevo: false, editar: false, desactivar: true });
    expect(el.querySelectorAll('[title="Desactivar"]')).toHaveLength(1);
  });
});
