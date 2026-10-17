import { ObraSemana } from '../../obra.interface';
import { PermisosObra } from '../../obra-permisos';
import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { SemanaDialogComponent } from './semana-dialog';

const SEMANA: ObraSemana = {
  id: 4,
  numero_semana: 2,
  etiqueta_semana: 'SEM 02',
  fecha_inicio: '2026-01-12',
  fecha_fin: '2026-01-18',
  fase_principal: 'Cimentación',
  porcentaje_meta: 20,
  porcentaje_real: 15,
  estado: 'Retrasado',
  orden: 2,
};

const abrir = (semana: ObraSemana | null, permisos: PermisosObra) =>
  montar(SemanaDialogComponent, { isOpen: true, idCentroCosto: 10, semana, permisos });

describe('SemanaDialogComponent: permisos (obra)', () => {
  it('editar una semana con solo ver: solo lectura, sin Guardar ni Eliminar, y el submit no envía nada', async () => {
    const { el, http } = await abrir(SEMANA, permisosObra());

    expect(camposEditables(el)).toHaveLength(0);
    expect(el.querySelector('#btn-semana-guardar')).toBeNull();
    expect(el.querySelector('#btn-semana-eliminar')).toBeNull();
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it('alta: Programar exige crear', async () => {
    const sinCrear = await abrir(null, permisosObra({ editar: true }));
    expect(sinCrear.el.querySelector('#btn-semana-guardar')).toBeNull();
    expect(camposEditables(sinCrear.el)).toHaveLength(0);

    const conCrear = await abrir(null, permisosObra({ crear: true }));
    expect(conCrear.el.querySelector('#btn-semana-guardar')?.textContent).toContain('Programar Semana');
    expect(camposEditables(conCrear.el).length).toBeGreaterThan(0);
  });

  it('edición: Guardar exige editar y Eliminar exige eliminar', async () => {
    const editar = await abrir(SEMANA, permisosObra({ editar: true }));
    expect(editar.el.querySelector('#btn-semana-guardar')).not.toBeNull();
    expect(editar.el.querySelector('#btn-semana-eliminar')).toBeNull();
    expect(camposEditables(editar.el).length).toBeGreaterThan(0);

    const eliminar = await abrir(SEMANA, permisosObra({ eliminar: true }));
    expect(eliminar.el.querySelector('#btn-semana-guardar')).toBeNull();
    expect(eliminar.el.querySelector('#btn-semana-eliminar')).not.toBeNull();
  });

  it('con todos los permisos: Guardar y Eliminar; el número de semana sigue bloqueado al editar', async () => {
    const { el } = await abrir(SEMANA, TODOS_PERMISOS_OBRA);

    expect(el.querySelector('#btn-semana-guardar')).not.toBeNull();
    expect(el.querySelector('#btn-semana-eliminar')).not.toBeNull();
    expect(camposEditables(el).some((c) => c.getAttribute('formControlName') === 'numero_semana')).toBe(false);
  });
});
