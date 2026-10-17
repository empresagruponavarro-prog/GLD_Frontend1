import { botonesVisibles } from '@app/core/auth/pantalla.testing';
import { ObraIncidencia } from '../../obra.interface';
import { PermisosObra } from '../../obra-permisos';
import { TODOS_PERMISOS_OBRA, montar, permisosObra } from '../../obra-cockpit.testing';
import { IncidenciasTabComponent } from './incidencias-tab';

const PENDIENTE: ObraIncidencia = {
  id: 1,
  codigo_incidencia: 'RFI-001',
  titulo: 'Interferencia de ductos',
  descripcion: 'Cruce con viga',
  prioridad: 'ALTA',
  estado: 'PENDIENTE',
  fecha_reporte: '2026-02-01T10:00:00Z',
};
const RESUELTA: ObraIncidencia = { ...PENDIENTE, id: 2, codigo_incidencia: 'RFI-002', estado: 'RESUELTA' };

const BOTONES = { reportar: 'Reportar Nueva Incidencia', detalle: 'Ver Detalle', resolver: 'Resolver' };

const montarTab = (permisos: PermisosObra) => montar(IncidenciasTabComponent, { incidencias: [PENDIENTE, RESUELTA], permisos });

describe('IncidenciasTabComponent: botones según permisos (obra)', () => {
  it('con solo ver: sin Reportar ni Resolver; Ver Detalle sigue', async () => {
    const { el } = await montarTab(permisosObra());

    expect(botonesVisibles(el, BOTONES)).toEqual({ reportar: false, detalle: true, resolver: false });
  });

  it('crear → Reportar; editar → Resolver (solo en las no resueltas)', async () => {
    expect(botonesVisibles((await montarTab(permisosObra({ crear: true }))).el, BOTONES)).toEqual({
      reportar: true, detalle: true, resolver: false,
    });
    const { el } = await montarTab(permisosObra({ editar: true }));
    expect(botonesVisibles(el, BOTONES)).toEqual({ reportar: false, detalle: true, resolver: true });
    const resolver = Array.from(el.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Resolver');
    expect(resolver).toHaveLength(1);
  });

  it('con todos los permisos aparecen todos los botones', async () => {
    const { el } = await montarTab(TODOS_PERMISOS_OBRA);

    expect(botonesVisibles(el, BOTONES)).toEqual({ reportar: true, detalle: true, resolver: true });
  });
});
