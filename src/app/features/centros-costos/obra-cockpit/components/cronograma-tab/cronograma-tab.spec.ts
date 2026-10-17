import { botonesVisibles } from '@app/core/auth/pantalla.testing';
import { ObraSemana } from '../../obra.interface';
import { PermisosObra } from '../../obra-permisos';
import { TODOS_PERMISOS_OBRA, montar, permisosObra } from '../../obra-cockpit.testing';
import { CronogramaTabComponent } from './cronograma-tab';

const SEMANA: ObraSemana = {
  id: 1,
  numero_semana: 1,
  etiqueta_semana: 'SEM 01',
  fecha_inicio: '2026-01-05',
  fecha_fin: '2026-01-11',
  fase_principal: 'Movimiento de tierras',
  porcentaje_meta: 10,
  porcentaje_real: 5,
  estado: 'Retrasado',
  orden: 1,
};

const BOTONES = {
  nueva: 'Programar semana',
  lote: 'Generador masivo',
  avance: 'Registrar avance',
  editar: 'Editar semana',
  eliminar: 'Eliminar semana',
};

const montarTab = (permisos: PermisosObra) => montar(CronogramaTabComponent, { semanas: [SEMANA], permisos });

describe('CronogramaTabComponent: botones según permisos (obra)', () => {
  it('con solo ver no aparecen altas, avance, edición ni eliminación (Evidencias sigue)', async () => {
    const { el } = await montarTab(permisosObra());

    expect(botonesVisibles(el, BOTONES)).toEqual({ nueva: false, lote: false, avance: false, editar: false, eliminar: false });
    expect(el.textContent).toContain('SEM 01');
    expect(el.querySelector('[title="Evidencia fotográfica (prototipo)"]')).not.toBeNull();
  });

  it('crear → Programar y Generador; editar → Avance y Editar; eliminar → Eliminar', async () => {
    expect(botonesVisibles((await montarTab(permisosObra({ crear: true }))).el, BOTONES)).toEqual({
      nueva: true, lote: true, avance: false, editar: false, eliminar: false,
    });
    expect(botonesVisibles((await montarTab(permisosObra({ editar: true }))).el, BOTONES)).toEqual({
      nueva: false, lote: false, avance: true, editar: true, eliminar: false,
    });
    expect(botonesVisibles((await montarTab(permisosObra({ eliminar: true }))).el, BOTONES)).toEqual({
      nueva: false, lote: false, avance: false, editar: false, eliminar: true,
    });
  });

  it('con todos los permisos aparecen todos los botones', async () => {
    const { el } = await montarTab(TODOS_PERMISOS_OBRA);

    expect(Object.values(botonesVisibles(el, BOTONES)).every(Boolean)).toBe(true);
  });

  it('la Curva S solo abre el avance al hacer clic con editar', async () => {
    const sinEditar = await montarTab(permisosObra());
    const avances: ObraSemana[] = [];
    sinEditar.fixture.componentInstance.registrarAvance.subscribe((s) => avances.push(s));
    const puntoSinEditar = sinEditar.el.querySelector('app-curva-s-chart g.group');
    expect(puntoSinEditar).not.toBeNull();
    expect(sinEditar.el.querySelector('app-curva-s-chart g.cursor-pointer')).toBeNull();
    puntoSinEditar?.dispatchEvent(new MouseEvent('click'));
    expect(avances).toEqual([]);

    const conEditar = await montarTab(permisosObra({ editar: true }));
    conEditar.fixture.componentInstance.registrarAvance.subscribe((s) => avances.push(s));
    const punto = conEditar.el.querySelector('app-curva-s-chart g.cursor-pointer');
    expect(punto).not.toBeNull();
    punto?.dispatchEvent(new MouseEvent('click'));
    expect(avances).toEqual([SEMANA]);
  });

  it('el tooltip de la Curva S muestra la desviación con signo (sin la pista de clic si no se puede editar)', async () => {
    const { el, render } = await montarTab(permisosObra());
    el.querySelector('app-curva-s-chart g.group')?.dispatchEvent(new MouseEvent('mouseenter'));
    await render();

    expect(el.textContent).toContain('-5.00 pts');
    expect(el.textContent).not.toContain('Clic para abrir opciones de la semana');
  });
});
