import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { CatalogosRrhhComponent } from './catalogos';
import { OpcionRrhh } from './catalogos.service';

const TIPOS: OpcionRrhh[] = [
  { id: 1, nombre: 'EMPLEADO', activo: true, orden: 1, usos: 4 },
  { id: 2, nombre: 'OBRERO', activo: true, orden: 2, usos: 0 },
];
const MODALIDADES: OpcionRrhh[] = [{ id: 9, nombre: 'PLAZO INDETERMINADO', activo: true, orden: 1, usos: 0 }];

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/rrhh/catalogos/tipos-trabajador')) return TIPOS;
  if (req.url.endsWith('/rrhh/catalogos/modalidades-contrato')) return MODALIDADES;
  return [];
}

const BOTONES = { nueva: 'Nueva opción', renombrar: 'Renombrar', desactivar: 'Desactivar', subir: 'Subir', eliminar: 'Eliminar' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(CatalogosRrhhComponent, misPermisos('RR.HH.', { 'rrhh.catalogos': acciones }), responder);
  expect(p.el.textContent).toContain('EMPLEADO');
  return p;
}

describe('CatalogosRrhhComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver no hay botones de cambio', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nueva: false, renombrar: false, desactivar: false, subir: false, eliminar: false });
  });

  it('cada acción aparece con su permiso', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ nueva: true, renombrar: false, desactivar: false, subir: false, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ nueva: false, renombrar: true, desactivar: true, subir: true, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES)).toEqual({ nueva: false, renombrar: false, desactivar: false, subir: false, eliminar: true });
  });

  it('una opción en uso no se puede eliminar (el botón está deshabilitado)', async () => {
    const { el } = await montar({ eliminar: true });
    const botones = Array.from(el.querySelectorAll<HTMLButtonElement>('button.table-action-btn--danger'));
    expect(botones.map((b) => b.disabled)).toEqual([true, false]);
  });

  it('al cambiar de pestaña carga las modalidades de contrato', async () => {
    const p = await montar({});
    const modalidades = p.cmp['pestanas'].find((x) => x.catalogo === 'modalidades-contrato');
    if (!modalidades) throw new Error('falta la pestaña de modalidades');
    p.cmp['elegir'](modalidades);
    p.http.expectOne((r) => r.url.endsWith('/rrhh/catalogos/modalidades-contrato')).flush(MODALIDADES);
    await p.render();
    expect(p.el.textContent).toContain('PLAZO INDETERMINADO');
  });

  it('guarda una opción nueva y recarga la lista', async () => {
    const p = await montar({ crear: true });
    p.cmp['nueva']();
    p.cmp['nombre'].setValue('  practicante  ');
    p.cmp['guardar']();
    const req = p.http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/rrhh/catalogos/tipos-trabajador'));
    expect(req.request.body).toEqual({ nombre: 'practicante' });
    req.flush({ id: 3, nombre: 'PRACTICANTE', activo: true, orden: 3, usos: 0 });
    p.http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/rrhh/catalogos/tipos-trabajador')).flush(TIPOS);
    expect(p.cmp['modalAbierto']()).toBe(false);
  });
});
