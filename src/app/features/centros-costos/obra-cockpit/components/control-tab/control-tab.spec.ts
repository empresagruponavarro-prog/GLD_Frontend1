import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TODOS_PERMISOS_OBRA, permisosObra } from '../../obra-cockpit.testing';
import { ControlObra, ObraPartida } from '../../obra-control.interface';
import { ControlTabComponent } from './control-tab';

const partidas: ObraPartida[] = [
  {
    id: 1,
    item: '01',
    nombre: 'Preliminares',
    tipo: 'CONTRACTUAL',
    orden: 1,
    id_ppto_detalle_fase: null,
    subpartidas: [
      {
        id: 5,
        id_partida: 1,
        item: '01.01',
        nombre: 'Desmontaje',
        tipo: 'CONTRACTUAL',
        tipo_propio: null,
        fecha_inicio: '2026-09-19',
        fecha_fin: '2026-09-22',
        orden: 1,
        observacion: null,
        id_ppto_detalle_categoria: null,
        metas_manuales: Array<null>(10).fill(null),
        tiene_avance: false,
      },
    ],
  },
];

const control = (sobre: Partial<ControlObra> = {}): ControlObra => ({
  id_centro_costo: 10,
  hoy: '2026-09-30',
  configurada: false,
  faltantes: ['estado_obra'],
  estado_obra: null,
  ficha: { codigo_obra: null, tienda: null, departamento: null, comentario: null, equipo: { jefe_proyecto: null, coordinador: null, residente: null, resp_presupuesto: null, resp_procura: null } },
  resultado: null,
  ...sobre,
});

interface Respuestas {
  partidas?: ObraPartida[];
  reprogramaciones?: unknown[];
}

/**
 * La pestaña pide partidas, avance, reprogramaciones, eventos y Curva S al abrirse con `rxResource`:
 * `whenStable` no termina hasta que se atienden, así que se responde antes de esperar.
 */
async function montarPestana(inputs: Record<string, unknown>, respuestas: Respuestas = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [ControlTabComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(ControlTabComponent);
  for (const [nombre, valor] of Object.entries(inputs)) fixture.componentRef.setInput(nombre, valor);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/partidas')).flush(respuestas.partidas ?? []);
  http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/avance')).flush({ hoy: '2026-09-30', inicio_semana_1: '2026-09-14', semana_en_curso: 3, semanas: [], subpartidas: [] });
  http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/reprogramaciones')).flush(respuestas.reprogramaciones ?? []);
  http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/eventos')).flush([]);
  http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/control/curva-s')).flush(null);
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await render();
  return { el: fixture.nativeElement as HTMLElement, http, render };
}

const botones = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
const ir = async (el: HTMLElement, render: () => Promise<void>, etiqueta: string) => {
  Array.from(el.querySelectorAll('nav button')).find((b) => b.textContent?.includes(etiqueta))?.dispatchEvent(new Event('click'));
  await render();
};

const resultadoFalso = (finOriginal: string) =>
  ({
    situacion: { clave: 'good', texto: 'A tiempo' },
    semana: { actual: 3, total: 8, texto: 'Semana 3 de 8', tarde: false },
    real: 40,
    programado: 40,
    desviacion: 0,
    plazos: { finOriginal, finVigente: finOriginal, diasReprogramados: 0, diasFueraDePlazo: 0 },
    postVenta: null,
    avisos: [],
    adicionales: null,
  }) as unknown as ControlObra['resultado'];

describe('ControlTabComponent', () => {
  it('obra sin configurar: avisa qué falta y, con editar, ofrece cambiar el estado', async () => {
    const { el } = await montarPestana({ idCentroCosto: 10, control: control(), permisos: TODOS_PERMISOS_OBRA });

    expect(el.querySelector('[data-testid="sin-configurar"]')?.textContent).toContain('estado de la obra');
    expect(botones(el)).toContain('Cambiar estado');
  });

  it('solo ver: no hay «Cambiar estado»', async () => {
    const { el } = await montarPestana({ idCentroCosto: 10, control: control(), permisos: permisosObra() });

    expect(botones(el)).not.toContain('Cambiar estado');
  });

  it('obra en control: muestra estado, situación, semana y avance', async () => {
    const { el } = await montarPestana({
      idCentroCosto: 10,
      control: control({ configurada: true, faltantes: [], estado_obra: 'EN_EJECUCION', resultado: resultadoFalso('2026-11-30') }),
      permisos: permisosObra(),
    });

    expect(el.querySelector('[data-testid="estado-obra"]')?.textContent).toContain('En ejecución');
    expect(el.textContent).toContain('A tiempo');
    expect(el.textContent).toContain('Semana 3 de 8');
    expect(el.querySelector('[data-testid="sin-configurar"]')).toBeNull();
  });

  it('estructura vacía: invita a importar solo a quien edita', async () => {
    const editor = await montarPestana({ idCentroCosto: 10, control: control(), permisos: TODOS_PERMISOS_OBRA });
    await ir(editor.el, editor.render, 'Estructura');
    expect(editor.el.querySelector('[data-testid="sin-estructura"]')?.textContent).toContain('Impórtelas');
    expect(botones(editor.el)).toContain('Importar de presupuesto');

    const lector = await montarPestana({ idCentroCosto: 10, control: control(), permisos: permisosObra() });
    await ir(lector.el, lector.render, 'Estructura');
    expect(lector.el.querySelector('[data-testid="sin-estructura"]')?.textContent).toContain('Pida a quien edita');
    expect(botones(lector.el)).not.toContain('Importar de presupuesto');
  });

  it('solo ver: lista la estructura sin editar, eliminar ni crear', async () => {
    const { el, render } = await montarPestana({ idCentroCosto: 10, control: control(), permisos: permisosObra() }, { partidas });
    await ir(el, render, 'Estructura');

    expect(el.textContent).toContain('01.01');
    const textos = botones(el);
    expect(textos).toContain('Metas');
    for (const prohibido of ['Editar', 'Eliminar', 'Nueva partida', '+ Subpartida']) expect(textos).not.toContain(prohibido);
  });

  it('reprogramaciones: resume los días y el fin vigente', async () => {
    const { el, render } = await montarPestana(
      { idCentroCosto: 10, control: control({ resultado: resultadoFalso('2026-11-30') }), permisos: permisosObra() },
      {
        reprogramaciones: [
          { id: 1, desde: '2026-10-05', dias: 7, motivo: 'CLIENTE', detalle: null, es_atraso: false, registrado_por: null },
          { id: 2, desde: '2026-10-20', dias: 3, motivo: 'INTERNO', detalle: 'Falta de personal', es_atraso: true, registrado_por: null },
        ],
      },
    );
    await ir(el, render, 'Reprogramaciones');

    const resumen = el.querySelector('[data-testid="resumen-reprogramaciones"]')?.textContent ?? '';
    expect(resumen).toContain('+10 días');
    expect(resumen).toContain('3 d por causa interna');
    expect(el.textContent).toContain('Falta de personal');
  });
});
