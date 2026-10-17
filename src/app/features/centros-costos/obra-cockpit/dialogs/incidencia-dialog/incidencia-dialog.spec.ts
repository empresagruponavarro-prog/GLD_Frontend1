import { ObraIncidencia } from '../../obra.interface';
import { PermisosObra } from '../../obra-permisos';
import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { IncidenciaDialogComponent } from './incidencia-dialog';

const INCIDENCIA: ObraIncidencia = {
  id: 5,
  codigo_incidencia: 'RFI-005',
  titulo: 'Filtración en losa',
  descripcion: 'Se observa humedad',
  prioridad: 'MEDIA',
  responsable: 'Ana Torres',
  estado: 'PENDIENTE',
  fecha_reporte: '2026-02-01T10:00:00Z',
};

const abrir = (incidencia: ObraIncidencia | null, permisos: PermisosObra) =>
  montar(IncidenciaDialogComponent, { isOpen: true, idCentroCosto: 10, incidencia, permisos });

const guardar = (el: HTMLElement) => el.querySelector('button[type="submit"]');
const plazos = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('form button[type="button"]')).filter((b) => /\d+h|Fin de Semana/.test(b.textContent ?? ''));

describe('IncidenciaDialogComponent: permisos (obra)', () => {
  it('abierta sin editar: solo lectura, plazos bloqueados, sin Guardar ni Eliminar', async () => {
    const { el, http } = await abrir(INCIDENCIA, permisosObra({ crear: true }));

    expect(camposEditables(el)).toHaveLength(0);
    expect(plazos(el).length).toBeGreaterThan(0);
    expect(plazos(el).every((b) => b.disabled)).toBe(true);
    expect(guardar(el)).toBeNull();
    expect(el.querySelector('#btn-incidencia-eliminar')).toBeNull();
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it('alta exige crear; edición exige editar; Eliminar exige eliminar', async () => {
    const alta = await abrir(null, permisosObra({ crear: true }));
    expect(guardar(alta.el)?.textContent).toContain('Reportar Incidencia');
    expect(camposEditables(alta.el).length).toBeGreaterThan(0);

    const edicion = await abrir(INCIDENCIA, permisosObra({ editar: true }));
    expect(guardar(edicion.el)?.textContent).toContain('Guardar Cambios');
    expect(edicion.el.querySelector('#btn-incidencia-eliminar')).toBeNull();

    const eliminar = await abrir(INCIDENCIA, permisosObra({ eliminar: true }));
    expect(guardar(eliminar.el)).toBeNull();
    expect(eliminar.el.querySelector('#btn-incidencia-eliminar')).not.toBeNull();
  });

  it('con todos los permisos: editable, Guardar y Eliminar', async () => {
    const { el } = await abrir(INCIDENCIA, TODOS_PERMISOS_OBRA);

    expect(camposEditables(el).length).toBeGreaterThan(0);
    expect(guardar(el)).not.toBeNull();
    expect(el.querySelector('#btn-incidencia-eliminar')).not.toBeNull();
  });
});
