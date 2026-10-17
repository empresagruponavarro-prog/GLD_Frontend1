import { hayBoton } from '@app/core/auth/pantalla.testing';
import { ObraPlano } from '../../obra.interface';
import { PermisosObra } from '../../obra-permisos';
import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { ModoPlano, PlanoDialogComponent } from './plano-dialog';

const PLANO: ObraPlano = {
  id: 9,
  codigo_plano: 'ARQ-01',
  nombre_plano: 'Planta general',
  disciplina: 'Arquitectura',
  version: 'v1.0',
  es_vigente: true,
  estado_aprobacion: 'En Revisión',
  formato_peso: 'PDF (1.2 MB)',
  archivo_url: 'obras/10/planos/ab12cd34_arq.pdf',
  created_at: '2026-01-01',
};

const abrir = (modo: ModoPlano, permisos: PermisosObra) =>
  montar(PlanoDialogComponent, { isOpen: true, idCentroCosto: 10, modo, plano: modo === 'crear' ? null : PLANO, permisos });

const guardar = (el: HTMLElement) => el.querySelector('#btn-plano-guardar');
const eliminar = (el: HTMLElement) => el.querySelector('#btn-plano-eliminar');

describe('PlanoDialogComponent: permisos (obra)', () => {
  it('editar sin permiso de editar: solo lectura, sin Guardar, Subir, Quitar ni Eliminar', async () => {
    const { el, http } = await abrir('editar', permisosObra({ crear: true }));

    expect(camposEditables(el)).toHaveLength(0);
    expect(guardar(el)).toBeNull();
    expect(eliminar(el)).toBeNull();
    expect(hayBoton(el, 'Subir archivo')).toBe(false);
    expect(hayBoton(el, 'Quitar')).toBe(false);
    expect(el.textContent).toContain('arq.pdf');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it('alta: Guardar y Subir archivo exigen crear; sin crear no se puede regenerar el código', async () => {
    const sinCrear = await abrir('crear', permisosObra({ editar: true }));
    expect(guardar(sinCrear.el)).toBeNull();
    expect(hayBoton(sinCrear.el, 'Subir archivo')).toBe(false);
    expect(sinCrear.el.querySelector('[title="Regenerar código autoincrementable"]')).toBeNull();

    const conCrear = await abrir('crear', permisosObra({ crear: true }));
    expect(guardar(conCrear.el)?.textContent).toContain('Guardar Plano');
    expect(hayBoton(conCrear.el, 'Subir archivo')).toBe(true);
    expect(conCrear.el.querySelector('[title="Regenerar código autoincrementable"]')).not.toBeNull();
  });

  it('editar con solo editar: guarda los datos pero no sube archivos (POST …/archivo exige crear)', async () => {
    const { el } = await abrir('editar', permisosObra({ editar: true }));

    expect(camposEditables(el).length).toBeGreaterThan(0);
    expect(guardar(el)).not.toBeNull();
    expect(hayBoton(el, 'Quitar')).toBe(true);
    expect(hayBoton(el, 'Subir archivo')).toBe(false);
    expect(eliminar(el)).toBeNull();
  });

  it('nueva versión exige editar (@Accion editar en el backend)', async () => {
    const sinEditar = await abrir('version', permisosObra({ crear: true }));
    expect(guardar(sinEditar.el)).toBeNull();

    const conEditar = await abrir('version', permisosObra({ editar: true }));
    expect(guardar(conEditar.el)?.textContent).toContain('Emitir versión');
  });

  it('Eliminar exige eliminar; con todos los permisos aparece todo', async () => {
    expect(eliminar((await abrir('editar', permisosObra({ eliminar: true }))).el)).not.toBeNull();

    const { el } = await abrir('editar', TODOS_PERMISOS_OBRA);
    expect(guardar(el)).not.toBeNull();
    expect(eliminar(el)).not.toBeNull();
    expect(hayBoton(el, 'Subir archivo')).toBe(true);
    expect(hayBoton(el, 'Quitar')).toBe(true);
  });
});
