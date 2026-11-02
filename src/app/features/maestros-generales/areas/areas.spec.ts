import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Area } from '../../requerimientos/requerimientos.models';
import { AreasComponent } from './areas';

const AREA: Area = { id: 1, codigo: 'SISTEMAS', nombre: 'Sistemas', estado: true };

const BOTONES = { nueva: 'Nueva área', editar: 'Editar' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(AreasComponent, misPermisos('Usuario', { 'maestros.areas': acciones }), () => [AREA]);
  expect(p.el.textContent).toContain('AR-01');
  return p;
}

describe('AreasComponent: dependencia entre áreas', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra de qué área depende cada una y su jefe superior', async () => {
    const GERENCIA: Area = { id: 1, codigo: 'GG', nombre: 'Gerencia General', estado: true, jefe: 'Ana Gerente' };
    const JEFATURA: Area = { id: 2, codigo: 'JP', nombre: 'Jefatura', estado: true, idAreaPadre: 1, areaPadre: 'Gerencia General', jefeSuperior: 'Ana Gerente' };
    const { el } = await montarPantalla(AreasComponent, misPermisos('Usuario', { 'maestros.areas': {} }), () => [GERENCIA, JEFATURA]);
    expect(el.textContent).toContain('Depende de');
    expect(el.textContent).toContain('Jefe superior: Ana Gerente');
  });
});

describe('AreasComponent: botones según permisos (maestros.areas)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver (o eliminar) no aparecen Nueva área ni Editar', async () => {
    const { el } = await montar({ eliminar: true });
    expect(botonesVisibles(el, BOTONES)).toEqual({ nueva: false, editar: false });
  });

  it('crear → Nueva área; editar → Editar', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ nueva: true, editar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ nueva: false, editar: true });
  });
});
