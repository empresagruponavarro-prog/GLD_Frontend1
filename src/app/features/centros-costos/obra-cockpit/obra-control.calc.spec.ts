import {
  agruparPorSemana,
  claseSeveridad,
  claseSituacion,
  claveCelda,
  diaMes,
  etiquetaEstadoObra,
  fechaCorta,
  fraseCurvaS,
  geometriaCurvaS,
  iconoSituacion,
  lunesDeIso,
  metasAutomaticas,
  pctMostrado,
  resumenReprogramaciones,
  sumaMetas,
  sumaOtrasSemanas,
  sumarDiasIso,
  textoDesviacion,
  transicionesDe,
  validarAvance,
  valorAvance,
} from './obra-control.calc';
import { CurvaS, ObraReprogramacion, PuntoCurvaS } from './obra-control.interface';

const punto = (semana: number, p: Partial<PuntoCurvaS> = {}): PuntoCurvaS => ({
  semana,
  desde: '2026-09-21',
  hasta: '2026-09-27',
  pactado: semana * 25,
  pactadoOriginal: semana * 25,
  real: semana * 25,
  diasPausa: 0,
  semanaEnPausa: false,
  enCurso: false,
  ...p,
});
const curva = (puntos: PuntoCurvaS[], semanaCorte = 2): CurvaS => ({ inicioSemana1: '2026-09-21', semanas: puntos, semanaCorte, excede: false });
const rep = (dias: number, interno = false): ObraReprogramacion => ({ id: 1, desde: '2026-10-15', dias, motivo: interno ? 'INTERNO' : 'CLIENTE', detalle: null, es_atraso: interno, registrado_por: null });

describe('obra-control.calc · presentación', () => {
  it('cada situación tiene clase e ícono', () => {
    for (const k of ['good', 'warn', 'crit', 'neutral', 'rp'] as const) {
      expect(claseSituacion(k).length).toBeGreaterThan(0);
      expect(iconoSituacion(k).length).toBeGreaterThan(0);
    }
    expect(claseSituacion('crit')).toContain('error');
    expect(claseSeveridad('crit')).toContain('error');
  });

  it('etiquetas y transiciones del estado de obra', () => {
    expect(etiquetaEstadoObra('EN_EJECUCION')).toBe('En ejecución');
    expect(etiquetaEstadoObra(null)).toBe('Sin control');
    expect(transicionesDe(null)).toEqual(['PROXIMO', 'EN_EJECUCION']);
    expect(transicionesDe('EN_EJECUCION')).toEqual(['POST_VENTA', 'SUSPENDIDA', 'CANCELADA']);
    expect(transicionesDe('POST_VENTA')).toEqual(['CULMINADO']);
    expect(transicionesDe('CULMINADO')).toEqual([]);
  });

  it('el porcentaje se trunca como el Excel', () => {
    expect(pctMostrado(99.6)).toBe(99);
    expect(pctMostrado(99.9999999)).toBe(100);
    expect(pctMostrado(79.4)).toBe(79);
    expect(pctMostrado(null)).toBe(0);
  });

  it('desviación con signo', () => {
    expect(textoDesviacion(-3.4)).toBe('−3 pp');
    expect(textoDesviacion(2.6)).toBe('+3 pp');
    expect(textoDesviacion(0.2)).toBe('0 pp');
  });

  it('fechas sin correr un día por la zona horaria', () => {
    expect(fechaCorta('2026-11-02')).toBe('02/11/2026');
    expect(diaMes('2026-11-02')).toBe('02/11');
    expect(fechaCorta(null)).toBe('—');
    expect(fechaCorta('basura')).toBe('—');
    expect(sumarDiasIso('2026-10-26', 7)).toBe('2026-11-02');
    expect(sumarDiasIso('2026-12-28', 7)).toBe('2027-01-04');
  });
});

describe('obra-control.calc · avance semanal (RV-07, RV-09)', () => {
  it('suma las otras semanas sin contar la editada', () => {
    expect(sumaOtrasSemanas([20, 30, null, 25], 2)).toBe(45);
    expect(sumaOtrasSemanas([20, 30], 5)).toBe(50);
    expect(sumaOtrasSemanas([], 1)).toBe(0);
  });

  it('una celda vacía es válida (borra el dato)', () => {
    expect(validarAvance('', 50)).toBeNull();
    expect(validarAvance('   ', 50)).toBeNull();
    expect(valorAvance('')).toBeNull();
  });

  it('acepta enteros, decimales y coma decimal', () => {
    expect(validarAvance('50', 0)).toBeNull();
    expect(validarAvance('12,5', 0)).toBeNull();
    expect(valorAvance('12,5')).toBe(12.5);
    expect(valorAvance('33.333')).toBe(33.3);
  });

  it('rechaza el %, el texto, lo fuera de rango y lo menor a 1', () => {
    expect(validarAvance('50%', 0)).toBe('Escriba 50, no 50%');
    expect(validarAvance('abc', 0)).toBe('Debe ser un número');
    expect(validarAvance('101', 0)).toBe('De 0 a 100');
    expect(validarAvance('-1', 0)).toBe('De 0 a 100');
    expect(validarAvance('0,5', 0)).toBe('Menor a 1: escriba 50, no 0,5');
    expect(validarAvance('0', 0)).toBeNull(); // un 0 sí es un reporte
  });

  it('rechaza si con las otras semanas pasaría de 100 (tolerancia de 0,5)', () => {
    expect(validarAvance('60', 50)).toMatch(/sumaría 110/);
    expect(validarAvance('50', 50)).toBeNull();
    expect(validarAvance('50.5', 50)).toBeNull();
    expect(validarAvance('51', 50)).not.toBeNull();
  });

  it('agrupa los cambios por semana, en orden', () => {
    const g = agruparPorSemana([
      { idSubpartida: 1, semana: 3, avance: 10 },
      { idSubpartida: 2, semana: 1, avance: 20 },
      { idSubpartida: 3, semana: 3, avance: null },
    ]);
    expect(g).toEqual([
      { semana: 1, lineas: [{ idSubpartida: 2, avance: 20 }] },
      { semana: 3, lineas: [{ idSubpartida: 1, avance: 10 }, { idSubpartida: 3, avance: null }] },
    ]);
    expect(agruparPorSemana([])).toEqual([]);
  });

  it('clave de celda', () => {
    expect(claveCelda(7, 3)).toBe('7:3');
  });

  it('suma de metas con huecos', () => {
    expect(sumaMetas([50, 50, null])).toBe(100);
    expect(sumaMetas([33.3, 66.7])).toBe(100);
    expect(sumaMetas([])).toBe(0);
  });
});

describe('obra-control.calc · reprogramaciones', () => {
  it('sin reprogramación', () => {
    expect(resumenReprogramaciones([], '2026-10-26')).toEqual({ dias: 0, externos: 0, internos: 0, texto: 'Sin reprogramación' });
  });

  it('ejemplo de la documentación: +7 días por Cliente → fin vigente 02/11/2026', () => {
    const r = resumenReprogramaciones([rep(7)], '2026-10-26');
    expect(r).toMatchObject({ dias: 7, externos: 7, internos: 0 });
    expect(r.texto).toBe('+7 días · fin vigente 02/11/2026');
  });

  it('con causa interna aclara que cuenta como atraso; singular en 1 día', () => {
    expect(resumenReprogramaciones([rep(7), rep(3, true)], '2026-10-26').texto).toBe('+10 días · fin vigente 05/11/2026 · 3 d por causa interna (cuentan como atraso)');
    expect(resumenReprogramaciones([rep(1)], '2026-10-26').texto).toBe('+1 día · fin vigente 27/10/2026');
  });

  it('sin fin original no inventa la fecha', () => {
    expect(resumenReprogramaciones([rep(7)], null).texto).toBe('+7 días');
  });
});

describe('obra-control.calc · Curva S', () => {
  const c = curva([punto(1), punto(2), punto(3, { real: null, enCurso: true }), punto(4, { real: null })]);

  it('traza pactado desde el origen y el real solo hasta donde hay dato', () => {
    const g = geometriaCurvaS(c);
    expect(g.pactado.startsWith('M40.0,')).toBe(true);
    expect(g.pactado.split('L')).toHaveLength(5); // M origen + 4 semanas
    expect(g.real.split('L')).toHaveLength(3); // origen + semanas 1 y 2
    expect(g.xs).toHaveLength(4);
  });

  it('el eje Y va de 0 (abajo) a 100 (arriba) y las guías están ordenadas', () => {
    const g = geometriaCurvaS(c);
    expect(g.guias.map((x) => x.valor)).toEqual([0, 25, 50, 75, 100]);
    expect(g.guias[0].y).toBeGreaterThan(g.guias[4].y);
    expect(g.guias[4].y).toBe(g.arriba);
  });

  it('marca el corte y la semana en curso', () => {
    const g = geometriaCurvaS(c);
    expect(g.xCorte).toBe(g.xs[1]);
    expect(g.xCurso).not.toBeNull();
    expect(g.xCurso!.x).toBe(g.xs[1]);
  });

  it('sin semanas cerradas no hay línea de corte; sin real no hay trazo real', () => {
    const g = geometriaCurvaS(curva([punto(1, { real: null }), punto(2, { real: null })], 0));
    expect(g.xCorte).toBeNull();
    expect(g.real).toBe('');
  });

  it('bandas de pausa y pactado original distinto', () => {
    const g = geometriaCurvaS(curva([punto(1), punto(2, { semanaEnPausa: true, pactado: 20, pactadoOriginal: 50 })]));
    expect(g.pausas).toHaveLength(1);
    expect(g.pausas[0].semana).toBe(2);
    expect(g.hayOriginalDistinto).toBe(true);
    expect(geometriaCurvaS(c).hayOriginalDistinto).toBe(false);
  });

  it('los valores se acotan a 0-100', () => {
    const g = geometriaCurvaS(curva([punto(1, { pactado: 140, real: -5 })]));
    expect(g.pactado).toContain(`${g.arriba.toFixed(1)}`);
  });

  it('frase: va al día dentro de 0,5 pp, por debajo si no, y plazo vencido', () => {
    expect(fraseCurvaS(curva([punto(1), punto(2, { pactado: 50, real: 49.7 })]))!.texto).toMatch(/^Va al día: 49% real frente a 50% pactado a la semana 2/);
    const abajo = fraseCurvaS(curva([punto(1), punto(2, { pactado: 50, real: 30 })]))!;
    expect(abajo.texto).toBe('Va 20 pp por debajo de lo pactado a la semana 2: 30% real frente a 50%.');
    expect(abajo.desviacion).toBeCloseTo(-20, 6);
    expect(fraseCurvaS(curva([punto(1), punto(2, { pactado: 100, real: 80 })]))!.texto).toMatch(/^Plazo vencido sin terminar/);
    expect(fraseCurvaS(curva([punto(1)], 0))!.texto).toBe('Aún no hay semanas cerradas ni reportadas.');
  });

  it('coherente con la situación: 5 pp por debajo ya NO es «va al día» (D3)', () => {
    expect(fraseCurvaS(curva([punto(1), punto(2, { pactado: 50, real: 45 })]))!.texto).toMatch(/por debajo/);
  });
});

describe('obra-control.calc · calendario y metas automáticas (RC-04)', () => {
  it('lunes de la semana', () => {
    expect(lunesDeIso('2026-09-17')).toBe('2026-09-14'); // jueves
    expect(lunesDeIso('2026-09-14')).toBe('2026-09-14'); // lunes
    expect(lunesDeIso('2026-09-20')).toBe('2026-09-14'); // domingo
    expect(lunesDeIso('2027-01-01')).toBe('2026-12-28'); // cruce de año
  });

  it('33,3 / 66,7: desmontaje sáb 19/09 – mar 22/09 (OP-26-017)', () => {
    expect(metasAutomaticas('2026-09-19', '2026-09-22', '2026-09-14').slice(0, 3)).toEqual([33.3, 66.7, 0]);
  });

  it('12,5 / 75 / 12,5: canalización sáb 26/09 – lun 05/10 (OP-26-017)', () => {
    expect(metasAutomaticas('2026-09-26', '2026-10-05', '2026-09-14').slice(0, 5)).toEqual([0, 12.5, 75, 12.5, 0]);
  });

  it('50 / 50: 12 días laborables en dos semanas completas', () => {
    expect(metasAutomaticas('2026-09-21', '2026-10-03', '2026-09-21').slice(0, 3)).toEqual([50, 50, 0]);
  });

  it('siempre 10 semanas; un solo día pone 100 en su semana; el domingo no aporta días', () => {
    const m = metasAutomaticas('2026-09-23', '2026-09-23', '2026-09-21');
    expect(m).toHaveLength(10);
    expect(m[0]).toBe(100);
    expect(metasAutomaticas('2026-09-27', '2026-09-29', '2026-09-14').slice(0, 4)).toEqual([0, 0, 100, 0]);
  });

  it('suma 100 cuando cabe en las 10 semanas', () => {
    expect(sumaMetas(metasAutomaticas('2026-09-21', '2026-11-14', '2026-09-21'))).toBeGreaterThanOrEqual(99.5);
  });
});
