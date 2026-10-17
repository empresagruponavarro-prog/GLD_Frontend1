import { botonesVisibles, hayBoton } from '@app/core/auth/pantalla.testing';
import { ObraPlano } from '../../obra.interface';
import { PermisosObra } from '../../obra-permisos';
import { TODOS_PERMISOS_OBRA, montar, permisosObra } from '../../obra-cockpit.testing';
import { PlanosTabComponent } from './planos-tab';

const PLANO: ObraPlano = {
  id: 9,
  codigo_plano: 'ARQ-01',
  nombre_plano: 'Planta general',
  disciplina: 'Arquitectura',
  version: 'v1.0',
  es_vigente: true,
  estado_aprobacion: 'En Revisión',
  archivo_url: 'obras/1/planos/ab12cd34_arq.pdf',
  created_at: '2026-01-01',
};

const MENU = { editar: 'Editar Datos', historial: 'Historial de Versiones', version: 'Subir Nueva Versión', eliminar: 'Eliminar Plano' };

/** Monta la pestaña y abre el menú contextual del plano. */
async function conMenu(permisos: PermisosObra) {
  const m = await montar(PlanosTabComponent, { planos: [PLANO], permisos });
  m.el.querySelector<HTMLButtonElement>('[title="Más opciones"]')?.click();
  await m.render();
  return m;
}

describe('PlanosTabComponent: botones según permisos (obra)', () => {
  it('con solo ver: sin Subir ni opciones de escritura; Ver, Descargar e Historial siguen', async () => {
    const { el } = await conMenu(permisosObra());

    expect(hayBoton(el, 'Subir Nuevo Plano')).toBe(false);
    expect(hayBoton(el, 'Ver Plano en Visor')).toBe(true);
    expect(hayBoton(el, 'Descargar Archivo')).toBe(true);
    expect(botonesVisibles(el, MENU)).toEqual({ editar: false, historial: true, version: false, eliminar: false });
  });

  it('crear → Subir; editar → Editar Datos y Nueva Versión; eliminar → Eliminar Plano', async () => {
    const crear = await conMenu(permisosObra({ crear: true }));
    expect(hayBoton(crear.el, 'Subir Nuevo Plano')).toBe(true);
    expect(botonesVisibles(crear.el, MENU)).toEqual({ editar: false, historial: true, version: false, eliminar: false });

    const editar = await conMenu(permisosObra({ editar: true }));
    expect(hayBoton(editar.el, 'Subir Nuevo Plano')).toBe(false);
    expect(botonesVisibles(editar.el, MENU)).toEqual({ editar: true, historial: true, version: true, eliminar: false });

    const eliminar = await conMenu(permisosObra({ eliminar: true }));
    expect(botonesVisibles(eliminar.el, MENU)).toEqual({ editar: false, historial: true, version: false, eliminar: true });
  });

  it('con todos los permisos aparecen todas las opciones', async () => {
    const { el } = await conMenu(TODOS_PERMISOS_OBRA);

    expect(hayBoton(el, 'Subir Nuevo Plano')).toBe(true);
    expect(botonesVisibles(el, MENU)).toEqual({ editar: true, historial: true, version: true, eliminar: true });
  });
});
