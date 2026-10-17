import { ObraIncidencia } from '../../obra.interface';
import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { IncidenciaResolverDialogComponent } from './incidencia-resolver-dialog';

const INCIDENCIA: ObraIncidencia = {
  id: 5,
  codigo_incidencia: 'RFI-005',
  titulo: 'Filtración en losa',
  descripcion: 'Se observa humedad',
  prioridad: 'MEDIA',
  accion_solicitada_o_ejecutada: 'Impermeabilizar',
  estado: 'PENDIENTE',
  fecha_reporte: '2026-02-01T10:00:00Z',
};

const abrir = (permisos = permisosObra()) =>
  montar(IncidenciaResolverDialogComponent, { isOpen: true, idCentroCosto: 10, incidencia: INCIDENCIA, permisos });

describe('IncidenciaResolverDialogComponent: permisos (obra)', () => {
  it('sin editar: solo lectura, sin Resolver y el submit no envía nada', async () => {
    const { el, http } = await abrir(permisosObra({ crear: true, eliminar: true }));

    expect(camposEditables(el)).toHaveLength(0);
    expect(el.querySelector('button[type="submit"]')).toBeNull();
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it('con editar: editable y el submit marca la incidencia como RESUELTA', async () => {
    const { el, http } = await abrir(TODOS_PERMISOS_OBRA);

    expect(camposEditables(el).length).toBeGreaterThan(0);
    expect(el.querySelector('button[type="submit"]')).not.toBeNull();
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    const req = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/incidencias/5'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toMatchObject({ estado: 'RESUELTA' });
  });
});
