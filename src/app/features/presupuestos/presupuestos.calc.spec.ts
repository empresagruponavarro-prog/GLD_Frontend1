import {
  TASA_IGV,
  aNumero,
  ajustarParametro,
  comprasPorFase,
  costoDirecto,
  estaSobrepasado,
  estadoFase,
  igv,
  montoGG,
  montoUtilidad,
  pctCompras,
  pesoPorcentaje,
  ponderacionFases,
  saldoSinAsignar,
  statsFase,
  subtotalSinIgv,
  sumarCampo,
  totalConIgv,
} from './presupuestos.calc';

describe('aNumero / sumarCampo', () => {
  it.each([
    ['1500.50', 1500.5],
    [200, 200],
    [null, 0],
    [undefined, 0],
    ['', 0],
    ['abc', 0],
  ])('aNumero(%j) = %j', (valor, esperado) => {
    expect(aNumero(valor)).toBe(esperado);
  });

  it('suma tratando lo no numérico como 0', () => {
    const items = [{ m: '10.5' }, { m: null }, { m: 4 }, { m: 'x' }];
    expect(sumarCampo(items, (i) => i.m)).toBe(14.5);
  });
});

describe('liquidación del wizard', () => {
  it('calcula CD, GG, utilidad, subtotal, IGV y total de un caso típico', () => {
    // Arrange
    const cd = costoDirecto([{ subtotal: 60000 }, { subtotal: '40000' }, { subtotal: null }]);

    // Act
    const gg = montoGG(cd, 10);
    const ut = montoUtilidad(cd, 8);
    const sub = subtotalSinIgv(cd, gg, ut, 1500, 500);

    // Assert
    expect(cd).toBe(100000);
    expect(gg).toBe(10000);
    expect(ut).toBe(8000);
    expect(sub).toBe(119000);
    expect(igv(sub)).toBeCloseTo(21420, 6);
    expect(totalConIgv(sub)).toBeCloseTo(140420, 6);
  });

  it('con CD = 0 solo quedan viáticos menos descuento', () => {
    const sub = subtotalSinIgv(0, montoGG(0, 10), montoUtilidad(0, 8), 300, 100);
    expect(sub).toBe(200);
    expect(totalConIgv(sub)).toBeCloseTo(236, 6);
  });

  it('el descuento puede dejar el subtotal negativo (sin recorte)', () => {
    expect(subtotalSinIgv(100, 0, 0, 0, 150)).toBe(-50);
  });

  it('usa la tasa de IGV de 18 %', () => {
    expect(TASA_IGV).toBe(0.18);
  });

  it.each([
    [10, 0.5, 10.5],
    [0.1, 0.2, 0.3],
    [0.3, -0.5, 0],
    [0, -1, 0],
    [12.345, 0, 12.35],
  ])('ajustarParametro(%j, %j) = %j', (actual, delta, esperado) => {
    expect(ajustarParametro(actual, delta)).toBe(esperado);
  });
});

describe('pesos y ponderación de fases', () => {
  it.each([
    [25, 100, '25.0%'],
    [1, 3, '33.3%'],
    ['50', '200', '25.0%'],
    [150, 100, '150.0%'],
    [0, 100, '0.0%'],
    [10, 0, '0.0%'],
    [-5, 100, '0.0%'],
    [null, null, '0.0%'],
  ])('pesoPorcentaje(%j, %j) = %j', (parte, total, esperado) => {
    expect(pesoPorcentaje(parte, total)).toBe(esperado);
  });

  const fases = [{ CostoDirecto: 30000 }, { CostoDirecto: '20000' }, { CostoDirecto: undefined }];

  it('ponderación y saldo con fases parcialmente asignadas', () => {
    expect(ponderacionFases(fases, 100000)).toBe(50);
    expect(saldoSinAsignar(fases, 100000)).toBe(50000);
  });

  it('con CD total = 0 la ponderación es 0 y el saldo queda negativo', () => {
    expect(ponderacionFases(fases, 0)).toBe(0);
    expect(saldoSinAsignar(fases, 0)).toBe(-50000);
  });

  it('redondea la ponderación a 1 decimal', () => {
    expect(ponderacionFases([{ CostoDirecto: 1 }], 3)).toBe(33.3);
  });
});

describe('compras contra presupuesto', () => {
  it('agrupa por fase, suma el total e ignora las líneas sin fase en el mapa', () => {
    const r = comprasPorFase([
      { id_fase: 1, monto: '100.5' },
      { id_fase: 1, monto: 50 },
      { id_fase: 2, monto: null },
      { id_fase: null, monto: 25 },
    ]);
    expect(r).toEqual({ porFase: { 1: 150.5, 2: 0 }, total: 175.5 });
  });

  it.each([
    // cd, compras, opciones, esperado
    [100, 50, {}, 50],
    [300, 100, {}, 33.33333333333333],
    [300, 100, { redondear: true }, 33],
    [100, 250, { redondear: true }, 250],
    [100, 250, { redondear: true, tope100: true }, 100],
    [0, 0, { redondear: true }, 0],
    [0, 10, { redondear: true }, 100],
    [null, 10, {}, 100],
    [-5, 0, {}, 0],
  ] as const)('pctCompras(%j, %j, %j) = %j', (cd, compras, opciones, esperado) => {
    expect(pctCompras(cd, compras, opciones)).toBe(esperado);
  });

  it.each([
    [100, 100, false],
    [100, 100.01, true],
    [0, 50, false],
    ['200', 300, true],
  ])('estaSobrepasado(%j, %j) = %j', (presupuesto, compras, esperado) => {
    expect(estaSobrepasado(presupuesto, compras)).toBe(esperado);
  });

  it.each([
    [100, 0, 'Sin Iniciar'],
    [0, 0, 'Sin Iniciar'],
    [100, -5, 'Sin Iniciar'],
    [100, 50, 'En Curso'],
    [100, 100, 'Completado'],
    [100, 150, 'Sobrecosto'],
    [0, 50, 'En Curso'],
  ])('estadoFase(%j, %j) = %j', (cd, compras, esperado) => {
    expect(estadoFase(cd, compras)).toBe(esperado);
  });
});

describe('statsFase', () => {
  const ppto = { CostoDirecto: '100000', GGPorcentaje: 10, UtiliPorcentaje: '8' };

  it('sin presupuesto activo devuelve null', () => {
    expect(statsFase(null, null)).toBeNull();
  });

  it('sin fase seleccionada usa el CD total del presupuesto', () => {
    expect(statsFase(ppto, null)).toEqual({
      cd: 100000, cdTotal: 100000, ggPorcentaje: 10, utilPorcentaje: 8, gg: 10000, util: 8000, total: 118000,
    });
  });

  it('con fase seleccionada usa el CD de la fase', () => {
    expect(statsFase(ppto, { CostoDirecto: 25000 })).toMatchObject({ cd: 25000, gg: 2500, util: 2000, total: 29500 });
  });

  it('una fase sin CD da todo en 0', () => {
    expect(statsFase(ppto, {})).toMatchObject({ cd: 0, gg: 0, util: 0, total: 0 });
  });
});

/**
 * Paridad con las fórmulas originales de `presupuestos.ts` (copiadas literalmente antes de
 * PRES-01). Garantiza que la extracción no cambia ningún valor, ni siquiera en el último bit.
 */
describe('paridad con las fórmulas originales del componente', () => {
  const montos = [0, 0.1, 0.3, 1, 3, 7.77, 99.99, 1234.567, 100000, 333333.33];
  const pcts = [0, 0.5, 7, 8.25, 10, 12.5, 33.33];

  it('liquidación del wizard', () => {
    for (const cd of montos) {
      for (const pg of pcts) {
        for (const pu of pcts) {
          const viaticos = cd / 7;
          const descuento = cd / 11;
          // Original: getters formMontoGG, formMontoUtilidad, formSubtotal, formIGV, formTotalGeneral
          const ggO = cd * (pg / 100);
          const utO = cd * (pu / 100);
          const subO = (cd + ggO + utO + viaticos) - descuento;
          const igvO = subO * 0.18;

          const gg = montoGG(cd, pg);
          const ut = montoUtilidad(cd, pu);
          const sub = subtotalSinIgv(cd, gg, ut, viaticos, descuento);
          expect([gg, ut, sub, igv(sub), totalConIgv(sub)]).toEqual([ggO, utO, subO, igvO, subO + igvO]);
        }
      }
    }
  });

  it('statsFase', () => {
    for (const cd of montos) {
      for (const pg of pcts) {
        // Original: getter statsFase
        const s = statsFase({ CostoDirecto: 1e6, GGPorcentaje: pg, UtiliPorcentaje: pg }, { CostoDirecto: cd })!;
        const ggO = (cd * pg / 100);
        expect([s.gg, s.total]).toEqual([ggO, cd + ggO + ggO]);
      }
    }
  });

  it('porcentajes de compras', () => {
    for (const cd of montos) {
      for (const compras of montos) {
        // Originales: porcentajeComprometidoFase, getPctComprasFase, getPctRealComprasFase
        const comprometidoO = cd <= 0 ? (compras > 0 ? 100 : 0) : (compras / cd) * 100;
        const pctO = cd <= 0 ? (compras > 0 ? 100 : 0) : Math.min(100, Math.round((compras / cd) * 100));
        const realO = cd <= 0 ? (compras > 0 ? 100 : 0) : Math.round((compras / cd) * 100);
        expect(pctCompras(cd, compras)).toBe(comprometidoO);
        expect(pctCompras(cd, compras, { redondear: true, tope100: true })).toBe(pctO);
        expect(pctCompras(cd, compras, { redondear: true })).toBe(realO);
      }
    }
  });
});
