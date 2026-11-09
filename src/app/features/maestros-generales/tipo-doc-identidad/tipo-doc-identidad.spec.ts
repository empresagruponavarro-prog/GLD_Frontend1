import { TestBed } from '@angular/core/testing';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '../../../core/auth/auth.testing';
import { Permisos } from '../../../core/auth/permisos.models';
import { CuerpoRespuesta, botonesVisibles, montarPantalla } from '../../../core/auth/pantalla.testing';
import { TipoDocIdentidad } from './interfaces/tipo-doc-identidad.interface';
import { TipoDocIdentidadComponent } from './tipo-doc-identidad';

const DOC1: TipoDocIdentidad = { id: 1, tipoAnexo: 'Proveedor', descripcion: 'DNI' };

const BOTONES = { nuevo: 'Nuevo tipo de documento', editar: 'Editar', eliminar: 'Eliminar' };

function responder(req: HttpRequest<unknown>): CuerpoRespuesta {
  return { data: [DOC1], page: 1, pageSize: 20, total: 1, totalPages: 1 };
}

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(TipoDocIdentidadComponent, misPermisos('Usuario', { 'maestros.generales': acciones }), responder);
  expect(p.el.textContent).toContain('DNI');
  return p;
}

describe('TipoDocIdentidadComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: lista registros, sin Nuevo, Editar ni Eliminar', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nuevo: false, editar: false, eliminar: false });
  });

  it('crear → Nuevo tipo de documento; editar → Editar; eliminar → Eliminar', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toMatchObject({ nuevo: true, editar: false, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toMatchObject({ nuevo: false, editar: true, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES)).toMatchObject({ nuevo: false, editar: false, eliminar: true });
  });
});
