import { TODOS_PERMISOS_OBRA, montar, permisosObra } from '../../../obra-cockpit.testing';
import { AvanceObra } from '../../../obra-control.interface';
import { AvanceSemanalComponent } from './avance-semanal';

const semanas = Array.from({ length: 16 }, (_v, i) => ({
  numero: i + 1,
  desde: '2026-09-14',
  hasta: '2026-09-20',
  futura: i + 1 > 3, // las semanas 1-3 ya cerraron o están en curso
  en_curso: i + 1 === 3,
}));

const avance: AvanceObra = {
  hoy: '2026-09-30',
  inicio_semana_1: '2026-09-14',
  semana_en_curso: 3,
  semanas,
  subpartidas: [
    {
      id: 5,
      item: '01.01',
      partida_item: '01',
      partida_nombre: 'Preliminares',
      nombre: 'Desmontaje',
      fecha_inicio: '2026-09-14',
      fecha_fin: '2026-09-22',
      metas: [50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
      avance: [40, null, ...Array<null>(14).fill(null)],
      real_acumulado: 40,
    },
  ],
};

const celda = (el: HTMLElement, sem: number) => el.querySelector<HTMLInputElement>(`input[aria-label="01.01, semana ${sem}"]`)!;
const escribir = (c: HTMLInputElement, v: string) => {
  c.value = v;
  c.dispatchEvent(new Event('input'));
};
const guardarBtn = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Guardar avance'));

describe('AvanceSemanalComponent', () => {
  it('bloquea las semanas futuras y muestra lo ya reportado', async () => {
    const { el } = await montar(AvanceSemanalComponent, { idCentroCosto: 10, avance, permisos: TODOS_PERMISOS_OBRA });

    expect(celda(el, 1).value).toBe('40');
    expect(celda(el, 2).disabled).toBe(false);
    expect(celda(el, 4).disabled).toBe(true);
  });

  it('solo ver: todas las celdas bloqueadas y sin botón de guardar', async () => {
    const { el } = await montar(AvanceSemanalComponent, { idCentroCosto: 10, avance, permisos: permisosObra() });

    expect(Array.from(el.querySelectorAll('input')).every((i) => i.disabled)).toBe(true);
    expect(guardarBtn(el)).toBeUndefined();
  });

  it('rechaza 0,5 («escriba 50») y una suma que pasa de 100, y bloquea guardar', async () => {
    const { el, render } = await montar(AvanceSemanalComponent, { idCentroCosto: 10, avance, permisos: TODOS_PERMISOS_OBRA });

    escribir(celda(el, 2), '0,5');
    await render();
    expect(el.textContent).toContain('Menor a 1');
    expect(guardarBtn(el)?.disabled).toBe(true);

    escribir(celda(el, 2), '70'); // 40 + 70 > 100,5
    await render();
    expect(el.textContent).toContain('sumaría 110');
    expect(guardarBtn(el)?.disabled).toBe(true);
  });

  it('guarda una llamada por semana con solo lo que cambió', async () => {
    const { el, http, render } = await montar(AvanceSemanalComponent, { idCentroCosto: 10, avance, permisos: TODOS_PERMISOS_OBRA });

    escribir(celda(el, 2), '30');
    escribir(celda(el, 3), '10');
    await render();
    expect(guardarBtn(el)?.textContent).toContain('(2)');
    guardarBtn(el)?.click();

    // Las semanas se envían en orden, una tras otra.
    const s2 = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/avance/semanas/2'));
    expect(s2.request.body).toEqual({ lineas: [{ idSubpartida: 5, avance: 30 }] });
    s2.flush({ semana: 2, lineas: 1, real_antes: 40, real_despues: 70 });
    const s3 = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/avance/semanas/3'));
    expect(s3.request.body).toEqual({ lineas: [{ idSubpartida: 5, avance: 10 }] });
  });
});
