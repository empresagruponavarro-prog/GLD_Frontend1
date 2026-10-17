import { botonesVisibles } from '@app/core/auth/pantalla.testing';
import { ObraIncidencia } from '../../obra.interface';
import { PermisosObra } from '../../obra-permisos';
import { TODOS_PERMISOS_OBRA, montar, permisosObra } from '../../obra-cockpit.testing';
import { IncidenciaDetalleDialogComponent } from './incidencia-detalle-dialog';

const PENDIENTE: ObraIncidencia = {
  id: 5,
  codigo_incidencia: 'RFI-005',
  titulo: 'Filtración en losa',
  descripcion: 'Se observa humedad',
  prioridad: 'MEDIA',
  estado: 'PENDIENTE',
  fecha_reporte: '2026-02-01T10:00:00Z',
};

const BOTONES = { editar: 'Editar Datos', resolver: 'Resolver Incidencia', imprimir: 'Imprimir Ficha' };

const abrir = (permisos: PermisosObra, incidencia: ObraIncidencia = PENDIENTE) =>
  montar(IncidenciaDetalleDialogComponent, { isOpen: true, idCentroCosto: 10, incidencia, permisos });

describe('IncidenciaDetalleDialogComponent: permisos (obra)', () => {
  it('con solo ver: es un visor sin Editar ni Resolver', async () => {
    const { el, fixture } = await abrir(permisosObra());
    const emitidos: ObraIncidencia[] = [];
    fixture.componentInstance.editar.subscribe((i) => emitidos.push(i));
    fixture.componentInstance.resolver.subscribe((i) => emitidos.push(i));

    expect(botonesVisibles(el, BOTONES)).toEqual({ editar: false, resolver: false, imprimir: true });
    expect(el.textContent).toContain('Filtración en losa');
    expect(emitidos).toEqual([]);
  });

  it('editar → Editar Datos y Resolver; eliminar → Editar Datos (el formulario permite borrar)', async () => {
    expect(botonesVisibles((await abrir(permisosObra({ editar: true }))).el, BOTONES)).toEqual({ editar: true, resolver: true, imprimir: true });
    expect(botonesVisibles((await abrir(permisosObra({ eliminar: true }))).el, BOTONES)).toEqual({ editar: true, resolver: false, imprimir: true });
  });

  it('una incidencia resuelta no ofrece Resolver aunque haya permisos', async () => {
    const { el } = await abrir(TODOS_PERMISOS_OBRA, { ...PENDIENTE, estado: 'RESUELTA' });

    expect(botonesVisibles(el, BOTONES)).toEqual({ editar: true, resolver: false, imprimir: true });
  });
});
