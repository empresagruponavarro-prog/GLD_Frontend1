import { TestBed } from '@angular/core/testing';
import { ObraPartida, ObraSubpartida, ResultadoObra } from '../../../obra-control.interface';
import { TODOS_PERMISOS_OBRA, permisosObra } from '../../../obra-cockpit.testing';
import { EstructuraPartidasComponent } from './estructura-partidas';

const sub = (id: number, item: string, extra: Partial<ObraSubpartida> = {}): ObraSubpartida => ({
  id,
  id_partida: 1,
  item,
  nombre: `Sub ${item}`,
  tipo: 'CONTRACTUAL',
  tipo_propio: null,
  fecha_inicio: '2026-09-21',
  fecha_fin: '2026-10-03',
  orden: id,
  observacion: null,
  id_ppto_detalle_categoria: null,
  metas_manuales: Array<null>(10).fill(null),
  tiene_avance: false,
  ...extra,
});

const partida = (extra: Partial<ObraPartida> = {}, subs: ObraSubpartida[] = [sub(1, '01.01'), sub(2, '01.02')]): ObraPartida => ({
  id: 1,
  item: '01',
  nombre: 'Obras civiles',
  tipo: 'CONTRACTUAL',
  orden: 1,
  id_ppto_detalle_fase: null,
  subpartidas: subs,
  ...extra,
});

/** Solo lo que la pestaña lee del resultado del motor: el peso de cada subpartida y con qué se pesó. */
const resultado = (pesoPor: 'MONTO' | 'DURACION', pesos: Record<string, number>): ResultadoObra =>
  ({
    pesoPor,
    partidas: [
      {
        item: '01',
        pesoPct: Object.values(pesos).reduce((a, b) => a + b, 0),
        subpartidas: Object.entries(pesos).map(([item, pesoPct]) => ({ item, pesoPct })),
      },
    ],
  }) as unknown as ResultadoObra;

function montar(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [EstructuraPartidasComponent] });
  const fixture = TestBed.createComponent(EstructuraPartidasComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { el, texto: () => el.textContent ?? '', encabezados: () => Array.from(el.querySelectorAll('th')).map((t) => t.textContent?.trim()) };
}

const botones = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());

describe('EstructuraPartidasComponent · monto y peso (GRP S-02)', () => {
  it('con montos y peso por monto muestra las columnas Monto y Peso y lo explica', () => {
    const p = partida({ id_ppto_detalle_fase: 9 }, [sub(1, '01.01', { monto: '900.00' }), sub(2, '01.02', { monto: '100.00' })]);
    const m = montar({ partidas: [p], resultado: resultado('MONTO', { '01.01': 90, '01.02': 10 }), permisos: TODOS_PERMISOS_OBRA });
    expect(m.encabezados()).toEqual(expect.arrayContaining(['Monto (S/)', 'Peso']));
    const filas = Array.from(m.el.querySelectorAll('tbody tr')).map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim());
    expect(filas[0]).toContain('900.00');
    expect(filas[0]).toContain('90 %');
    expect(filas[1]).toContain('100.00');
    expect(filas[1]).toContain('10 %');
    expect(m.el.querySelector('[data-testid="peso-monto"]')?.textContent).toContain('monto');
    expect(m.el.querySelector('[data-testid="peso-duracion"]')).toBeNull();
    // El peso de la partida (suma de sus subpartidas) también se ve.
    expect(m.texto()).toContain('100 %');
  });

  it('sin montos y con resultado explica que se pesa por duración y no muestra la columna Monto', () => {
    const m = montar({ partidas: [partida()], resultado: resultado('DURACION', { '01.01': 50, '01.02': 50 }), permisos: TODOS_PERMISOS_OBRA });
    expect(m.encabezados()).not.toContain('Monto (S/)');
    expect(m.encabezados()).toContain('Peso');
    expect(m.el.querySelector('[data-testid="peso-duracion"]')?.textContent).toContain('duración');
  });

  it('sin resultado del motor no muestra la columna Peso', () => {
    const m = montar({ partidas: [partida()], resultado: null, permisos: TODOS_PERMISOS_OBRA });
    expect(m.encabezados()).not.toContain('Peso');
    expect(m.el.querySelector('[data-testid="peso-monto"]')).toBeNull();
    expect(m.el.querySelector('[data-testid="peso-duracion"]')).toBeNull();
  });

  it('un monto en cero o ausente se muestra como guion', () => {
    const p = partida({}, [sub(1, '01.01', { monto: '250.00' }), sub(2, '01.02', { monto: null })]);
    const m = montar({ partidas: [p], resultado: null, permisos: TODOS_PERMISOS_OBRA });
    const celdas = Array.from(m.el.querySelectorAll('tbody tr')).map((tr) => tr.querySelectorAll('td')[4]?.textContent?.trim());
    expect(celdas).toEqual(['250.00', '—']);
  });
});

describe('EstructuraPartidasComponent · importar de presupuesto', () => {
  it('se ofrece mientras la estructura no salga de un presupuesto aprobado', () => {
    const m = montar({ partidas: [partida()], permisos: TODOS_PERMISOS_OBRA });
    expect(botones(m.el).some((b) => b?.includes('Importar de presupuesto'))).toBe(true);
    expect(botones(m.el).some((b) => b?.includes('Importar Excel'))).toBe(true);
  });

  it('desaparece cuando la estructura ya salió del presupuesto (Importar Excel se conserva)', () => {
    const m = montar({ partidas: [partida({ id_ppto_detalle_fase: 9 })], permisos: TODOS_PERMISOS_OBRA });
    expect(botones(m.el).some((b) => b?.includes('Importar de presupuesto'))).toBe(false);
    expect(botones(m.el).some((b) => b?.includes('Importar Excel'))).toBe(true);
    expect(m.texto()).toContain('La estructura salió del presupuesto aprobado');
  });

  it('con una obra vacía se explica que las partidas se crean solas al aprobar el presupuesto', () => {
    const m = montar({ partidas: [], permisos: permisosObra() });
    expect(m.el.querySelector('[data-testid="sin-estructura"]')?.textContent).toContain('Se crean solas al aprobar su presupuesto Principal');
  });
});
