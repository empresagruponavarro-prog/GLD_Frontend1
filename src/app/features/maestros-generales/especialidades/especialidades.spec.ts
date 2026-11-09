import { TestBed } from '@angular/core/testing';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '../../../core/auth/auth.testing';
import { Permisos } from '../../../core/auth/permisos.models';
import { CuerpoRespuesta, botonesVisibles, montarPantalla } from '../../../core/auth/pantalla.testing';
import { Especialidad } from './interfaces/especialidades.interface';
import { EspecialidadesComponent } from './especialidades';

const ESP1: Especialidad = { id: 1, tipoAnexo: 'Proveedor', descripcion: 'ESTRUCTURAS METÁLICAS' };

const BOTONES = { nueva: 'Nueva especialidad', editar: 'Editar', eliminar: 'Eliminar' };

function responder(req: HttpRequest<unknown>): CuerpoRespuesta {
  return { data: [ESP1], page: 1, pageSize: 20, total: 1, totalPages: 1 };
}

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(EspecialidadesComponent, misPermisos('Usuario', { 'maestros.generales': acciones }), responder);
  expect(p.el.textContent).toContain('ESTRUCTURAS METÁLICAS');
  return p;
}

describe('EspecialidadesComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: lista registros, sin Nueva, Editar ni Eliminar', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nueva: false, editar: false, eliminar: false });
  });

  it('crear → Nueva especialidad; editar → Editar; eliminar → Eliminar', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toMatchObject({ nueva: true, editar: false, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toMatchObject({ nueva: false, editar: true, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES)).toMatchObject({ nueva: false, editar: false, eliminar: true });
  });
});
