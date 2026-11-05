import { TestBed } from '@angular/core/testing';
import { botonesVisibles } from '@app/core/auth/pantalla.testing';
import { ObraSemana } from '../../obra.interface';
import { montar } from '../../obra-cockpit.testing';
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

const EDICION = {
  nueva: 'Programar semana',
  lote: 'Generador masivo',
  avance: 'Registrar avance',
  editar: 'Editar semana',
  eliminar: 'Eliminar semana',
};

describe('CronogramaTabComponent: histórico de solo consulta (GRP S-01)', () => {
  it('lista las semanas ya guardadas y explica dónde se registra ahora el avance', async () => {
    const { el } = await montar(CronogramaTabComponent, { semanas: [SEMANA] });

    expect(el.textContent).toContain('SEM 01');
    expect(el.textContent).toContain('Movimiento de tierras');
    expect(el.textContent).toContain('Programación semanal (histórico)');
    expect(el.querySelector('[data-testid="cronograma-historico"]')?.textContent).toContain('Control de avance');
  });

  it('no ofrece programar, generar, registrar avance, editar ni eliminar semanas', async () => {
    const { el } = await montar(CronogramaTabComponent, { semanas: [SEMANA] });

    expect(botonesVisibles(el, EDICION)).toEqual({ nueva: false, lote: false, avance: false, editar: false, eliminar: false });
    expect(el.querySelector('#btn-nueva-semana')).toBeNull();
    expect(el.querySelector('#btn-generar-lote')).toBeNull();
    expect(Array.from(el.querySelectorAll('th')).some((t) => t.textContent?.includes('Acciones'))).toBe(false);
  });

  it('los puntos de la Curva S solo se consultan: no se hace clic para registrar avance', async () => {
    const { el } = await montar(CronogramaTabComponent, { semanas: [SEMANA] });

    expect(el.querySelector('app-curva-s-chart g.group')).not.toBeNull();
    expect(el.querySelector('app-curva-s-chart g.cursor-pointer')).toBeNull();
  });

  it('el tooltip de la Curva S muestra la desviación con signo y sin pista de clic', async () => {
    const { el, render } = await montar(CronogramaTabComponent, { semanas: [SEMANA] });
    el.querySelector('app-curva-s-chart g.group')?.dispatchEvent(new MouseEvent('mouseenter'));
    await render();

    expect(el.textContent).toContain('-5.00 pts');
    expect(el.textContent).not.toContain('Clic para abrir opciones de la semana');
  });

  it('sin semanas dice que el avance se registra en Control de avance', async () => {
    const { el } = await montar(CronogramaTabComponent, { semanas: [] });

    expect(el.textContent).toContain('No hay semanas en este histórico');
    expect(el.textContent).toContain('Control de avance');
  });

  it('el filtro por estado sigue funcionando sobre el histórico', async () => {
    const otra: ObraSemana = { ...SEMANA, id: 2, numero_semana: 2, etiqueta_semana: 'SEM 02', estado: 'En Plazo' };
    const { el, render } = await montar(CronogramaTabComponent, { semanas: [SEMANA, otra] });
    const filtro = el.querySelector<HTMLSelectElement>('#filtro-estado-semana')!;
    filtro.value = 'En Plazo';
    filtro.dispatchEvent(new Event('change'));
    await render();

    const filas = Array.from(el.querySelectorAll('tbody tr')).map((f) => f.textContent ?? '');
    expect(filas.some((f) => f.includes('SEM 02'))).toBe(true);
    expect(filas.some((f) => f.includes('SEM 01'))).toBe(false);
    TestBed.resetTestingModule();
  });
});
