import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Incidencia } from './interfaces';
import { IncidenciasComponent } from './incidencias';

const INCIDENCIA: Incidencia = { id: 7, promotor: 'Ana', solicitante: 'Vecino Uno', incidencia: 'Fuga', estado: 'PENDIENTE' };

const BOTONES = { agregar: 'Agregar Caso', editar: 'Editar Ficha', duplicar: 'Duplicar Ficha', eliminar: 'Eliminar Caso', detalle: 'Ver Detalles' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(IncidenciasComponent, misPermisos('Promotor', { incidencias: acciones }), () => [INCIDENCIA]);
  expect(p.el.textContent).toContain('Vecino Uno');
  return p;
}

describe('IncidenciasComponent: botones según permisos (incidencias)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: solo "Ver Detalles" (sin Agregar, Editar, Duplicar ni Eliminar)', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ agregar: false, editar: false, duplicar: false, eliminar: false, detalle: true });
  });

  it('crear → Agregar y Duplicar (POST); editar → Editar; eliminar → Eliminar', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ agregar: true, editar: false, duplicar: true, eliminar: false, detalle: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ agregar: false, editar: true, duplicar: false, eliminar: false, detalle: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES)).toEqual({ agregar: false, editar: false, duplicar: false, eliminar: true, detalle: true });
  });
});
