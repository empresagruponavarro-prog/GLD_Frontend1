import { ObraPlano } from '../../obra.interface';
import { PermisosObra } from '../../obra-permisos';
import { TODOS_PERMISOS_OBRA, montar, permisosObra } from '../../obra-cockpit.testing';
import { HistorialPlanosDialogComponent } from './historial-planos-dialog';

const VIGENTE: ObraPlano = {
  id: 9,
  codigo_plano: 'ARQ-01',
  nombre_plano: 'Planta general',
  disciplina: 'Arquitectura',
  version: 'v2.0',
  es_vigente: true,
  estado_aprobacion: 'En Revisión',
  archivo_url: 'obras/1/planos/ab12cd34_arq.pdf',
  created_at: '2026-02-01',
};
const ANTERIOR: ObraPlano = { ...VIGENTE, id: 8, version: 'v1.0', es_vigente: false, created_at: '2026-01-01' };

async function abrir(permisos: PermisosObra) {
  const m = await montar(HistorialPlanosDialogComponent, { isOpen: true, idCentroCosto: 10, plano: VIGENTE, permisos });
  m.http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/planos/9/historial')).flush([VIGENTE, ANTERIOR]);
  await m.render();
  return m;
}

describe('HistorialPlanosDialogComponent: permisos (obra)', () => {
  it('con solo ver: muestra las versiones y «Ver plano», sin «Emitir nueva versión»', async () => {
    const { el } = await abrir(permisosObra({ crear: true, eliminar: true }));

    expect(el.textContent).toContain('v1.0');
    expect(el.querySelectorAll('li button')).toHaveLength(2);
    expect(el.querySelector('#btn-historial-nueva-version')).toBeNull();
  });

  it('con editar aparece «Emitir nueva versión» (POST …/versiones exige editar)', async () => {
    const { el } = await abrir(TODOS_PERMISOS_OBRA);

    expect(el.querySelector('#btn-historial-nueva-version')).not.toBeNull();
  });
});
