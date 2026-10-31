import {
  cargaPorPersona,
  catalogosDe,
  culminadas,
  diasEntre,
  escalaDe,
  esSinLeer,
  hace,
  filtrarObras,
  iniciadasPorMes,
  kpisDe,
  marcasDeMes,
  ordenarObras,
  paginar,
  porAnioDeInicio,
  porCliente,
  porDepartamento,
  requierenAtencion,
  resumenPostVenta,
  semaforoDeCarga,
  tramoDeConteo,
} from './operaciones.calc';
import { SIN_FILTROS } from './operaciones.interface';
import { obraResumen } from './operaciones.testing';

const obras = [
  obraResumen({ id: 1, estado: 'EN_EJECUCION', clave: 'crit', real: 30, programado: 50, jefe: [10, 'Ana Ruiz'], coordinador: [20, 'Beto Paz'], departamento: 'Lima' }),
  obraResumen({ id: 2, estado: 'EN_EJECUCION', clave: 'good', proximoAVencer: true, jefe: [10, 'Ana Ruiz'], coordinador: [21, 'Carla Soto'], cliente: [2, 'Cliente B'], departamento: 'Cusco' }),
  obraResumen({ id: 3, estado: 'PROXIMO', inicio: '2026-11-02', jefe: [11, 'Dino Vera'], coordinador: [20, 'Beto Paz'], departamento: 'Lima' }),
  obraResumen({ id: 4, estado: 'POST_VENTA', inicio: '2026-03-01', fin: '2026-08-01', postVenta: { inicio: '2026-08-10', dias: 58 }, departamento: 'Lima' }),
  obraResumen({ id: 5, estado: 'CULMINADO', inicio: '2025-05-01', fin: '2025-09-01', postVenta: { inicio: '2025-09-05', dias: 14 }, departamento: 'Piura' }),
  obraResumen({ id: 6, estado: 'CULMINADO', inicio: '2025-06-01', fin: '2025-10-01', postVenta: { inicio: '2025-09-28', dias: 14 }, cliente: [2, 'Cliente B'] }),
  obraResumen({ id: 7, estado: 'CANCELADA', inicio: '2026-01-10' }),
];

describe('operaciones.calc · filtros y catálogos (RC-21)', () => {
  it('sin filtros devuelve todo; busca por nombre o código sin tildes', () => {
    expect(filtrarObras(obras, SIN_FILTROS)).toHaveLength(7);
    expect(filtrarObras(obras, { ...SIN_FILTROS, q: 'op-26-003' }).map((o) => o.id_centro_costo)).toEqual([3]);
    expect(filtrarObras(obras, { ...SIN_FILTROS, q: 'TIENDA 2' }).map((o) => o.id_centro_costo)).toEqual([2]);
  });

  it('año de inicio suma las vigentes de años anteriores solo si se pide', () => {
    const con = filtrarObras(obras, { ...SIN_FILTROS, anio: 2026, vigentesAnteriores: true }).map((o) => o.id_centro_costo);
    expect(con).toEqual([1, 2, 3, 4, 7]);
    const solo2025 = filtrarObras(obras, { ...SIN_FILTROS, anio: 2025, vigentesAnteriores: true }).map((o) => o.id_centro_costo);
    expect(solo2025).toEqual([5, 6]); // las vigentes de 2026 no son «anteriores» a 2025
  });

  it('filtra por cliente, jefe, coordinador, departamento y estado efectivo', () => {
    expect(filtrarObras(obras, { ...SIN_FILTROS, cliente: 2 }).map((o) => o.id_centro_costo)).toEqual([2, 6]);
    expect(filtrarObras(obras, { ...SIN_FILTROS, jefe: 11 }).map((o) => o.id_centro_costo)).toEqual([3]);
    expect(filtrarObras(obras, { ...SIN_FILTROS, coordinador: 21 }).map((o) => o.id_centro_costo)).toEqual([2]);
    expect(filtrarObras(obras, { ...SIN_FILTROS, departamento: 'lima' }).map((o) => o.id_centro_costo)).toEqual([1, 3, 4, 6, 7]);
    expect(filtrarObras(obras, { ...SIN_FILTROS, estado: 'POST_VENTA' }).map((o) => o.id_centro_costo)).toEqual([4]);
  });

  it('ordena: ejecución, próximos, post venta, culminadas y canceladas', () => {
    expect(ordenarObras(obras).map((o) => o.id_centro_costo)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('catálogos únicos y ordenados; años del más reciente al más antiguo', () => {
    const c = catalogosDe(obras);
    expect(c.jefes.map((j) => j.nombre)).toEqual(['Ana Ruiz', 'Dino Vera']);
    expect(c.anios).toEqual([2026, 2025]);
    expect(c.departamentos).toEqual(['Cusco', 'Lima', 'Piura']);
  });
});

describe('operaciones.calc · KPI e indicadores (RF-OP-28, 32..35)', () => {
  it('vigentes = ejecución + próximos + post venta (cuadran entre sí)', () => {
    const k = kpisDe(obras);
    expect(k.vigentes).toBe(4);
    expect(k.enEjecucion + k.proximos + k.postVenta).toBe(k.vigentes);
    expect(k.vigentesPorAnio).toEqual([{ anio: 2026, cantidad: 4 }]);
    expect(k.clientes).toBe(2);
    expect(k.jefesActivos).toBe(2);
    expect(k.coordinadoresActivos).toBe(2);
    expect(k.proximasAVencer).toBe(1);
  });

  it('por año de inicio: vigentes y culminadas, sin canceladas', () => {
    expect(porAnioDeInicio(obras)).toEqual([
      { anio: 2026, vigentes: 4, culminadas: 0, total: 4 },
      { anio: 2025, vigentes: 0, culminadas: 2, total: 2 },
    ]);
  });

  it('requieren atención: en ejecución retrasadas, en riesgo o fuera de plazo; la peor primero', () => {
    const lista = [...obras, obraResumen({ id: 8, fueraDePlazo: 3, real: 60, programado: 60 })];
    expect(requierenAtencion(lista).map((o) => o.id_centro_costo)).toEqual([1, 8]);
  });

  it('post venta: cantidad, promedio y máximo de días', () => {
    const r = resumenPostVenta([...obras, obraResumen({ id: 9, estado: 'POST_VENTA', postVenta: { inicio: '2026-09-01', dias: 20 } })]);
    expect(r).toEqual({ cantidad: 2, promedioDias: 39, maximoDias: 58 });
  });

  it('iniciadas por mes resalta el mes actual solo en el año de hoy', () => {
    const meses = iniciadasPorMes(obras, 2026, '2026-10-07');
    expect(meses.find((m) => m.mes === 9)?.cantidad).toBe(2);
    expect(meses.find((m) => m.mes === 10)?.actual).toBe(true);
    expect(iniciadasPorMes(obras, 2025, '2026-10-07').some((m) => m.actual)).toBe(false);
  });
});

describe('operaciones.calc · carga por persona (RC-20)', () => {
  it('cuenta ejecución, próximos y post venta frente a la referencia', () => {
    const cargas = cargaPorPersona(obras, 'jefe');
    const ana = cargas.find((c) => c.persona.nombre === 'Ana Ruiz')!;
    expect(ana).toMatchObject({ ejecucion: 2, proximos: 0, postVenta: 1, total: 3, conRetraso: 1, referencia: 10, holgura: 7, semaforo: 'good' });
    expect(ana.companeros).toEqual(['Beto Paz', 'Carla Soto']);
  });

  it('semáforo: sobre la referencia = crítico; cerca del tope = aviso', () => {
    const doce = Array.from({ length: 12 }, (_v, i) => obraResumen({ id: 100 + i }));
    const [c] = cargaPorPersona(doce, 'jefe');
    expect(c.semaforo).toBe('crit');
    expect(c.holgura).toBe(-2);
    const ocho = cargaPorPersona(doce.slice(0, 8), 'jefe')[0];
    expect(ocho.semaforo).toBe('warn');
    expect(semaforoDeCarga([c, ocho])).toEqual({ sobrecarga: 1, cerca: 1, holgura: 0 });
  });

  it('el coordinador usa la referencia 5 y las suspendidas no cuentan', () => {
    const lista = [...Array.from({ length: 6 }, (_v, i) => obraResumen({ id: 200 + i })), obraResumen({ id: 210, estado: 'SUSPENDIDA' })];
    const [c] = cargaPorPersona(lista, 'coordinador');
    expect(c.referencia).toBe(5);
    expect(c.total).toBe(6);
    expect(c.semaforo).toBe('crit');
  });
});

describe('operaciones.calc · por cliente, departamento y culminados', () => {
  it('por cliente cuenta cada estado y deja fuera las canceladas', () => {
    const a = porCliente(obras).find((c) => c.cliente.id === 1)!;
    expect(a).toMatchObject({ ejecucion: 1, proximos: 1, postVenta: 1, culminadas: 1, total: 4 });
  });

  it('por departamento solo cuenta vigentes y asigna el tramo de color', () => {
    expect(porDepartamento(obras)).toEqual([
      { departamento: 'Lima', cantidad: 3, tramo: 2 },
      { departamento: 'Cusco', cantidad: 1, tramo: 1 },
    ]);
    expect([0, 1, 2, 3, 4, 6, 7, 12, 13, 40].map(tramoDeConteo)).toEqual([0, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('culminadas: desfase de la entrega frente al fin vigente y % a tiempo', () => {
    const r = culminadas(obras);
    expect(r.filas.map((f) => [f.obra.id_centro_costo, f.desfase, f.aTiempo])).toEqual([
      [6, -3, true],
      [5, 4, false],
    ]);
    expect(r.pctATiempo).toBe(50);
    expect(culminadas([obras[0]]).pctATiempo).toBeNull();
  });
});

describe('operaciones.calc · escala de tiempo y páginas', () => {
  it('días entre fechas', () => {
    expect(diasEntre('2026-10-01', '2026-10-08')).toBe(7);
    expect(diasEntre('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('escala: posición en 0-100, ancho mínimo y marcas de mes dentro del rango', () => {
    const e = escalaDe(['2026-09-01', '2026-11-30'], 0);
    expect(e.pos('2026-09-01')).toBe(0);
    expect(e.pos('2026-11-30')).toBe(100);
    expect(e.ancho('2026-09-01', '2026-09-01')).toBeGreaterThan(0);
    expect(marcasDeMes(e).map((m) => m.iso)).toEqual(['2026-10-01', '2026-11-01']);
  });

  it('paginar da la vuelta en ambos sentidos', () => {
    const items = Array.from({ length: 10 }, (_v, i) => i);
    expect(paginar(items, 4, 0)).toEqual({ items: [0, 1, 2, 3], pagina: 0, paginas: 3 });
    expect(paginar(items, 4, 3).pagina).toBe(0);
    expect(paginar(items, 4, -1)).toEqual({ items: [8, 9], pagina: 2, paginas: 3 });
    expect(paginar([], 4, 5)).toEqual({ items: [], pagina: 0, paginas: 1 });
  });
});

describe('operaciones.calc · avisos', () => {
  const ahora = new Date('2026-10-30T12:00:00.000Z');

  it('sin leer: posterior a la marca, o a los últimos 14 días si nunca marcó; y de un tipo elegido', () => {
    const e = { tipo: 'SITUACION', created_at: '2026-10-30T11:00:00.000Z' };
    expect(esSinLeer(e, '2026-10-30T10:00:00.000Z', null, ahora)).toBe(true);
    expect(esSinLeer(e, '2026-10-30T11:30:00.000Z', null, ahora)).toBe(false);
    expect(esSinLeer({ ...e, created_at: '2026-10-01T00:00:00.000Z' }, null, null, ahora)).toBe(false);
    expect(esSinLeer(e, null, ['VENCIDO'], ahora)).toBe(false);
    expect(esSinLeer(e, null, ['VENCIDO', 'SITUACION'], ahora)).toBe(true);
  });

  it('antigüedad legible', () => {
    expect(hace('2026-10-30T11:59:40.000Z', ahora)).toBe('ahora');
    expect(hace('2026-10-30T11:55:00.000Z', ahora)).toBe('hace 5 min');
    expect(hace('2026-10-30T09:00:00.000Z', ahora)).toBe('hace 3 h');
    expect(hace('2026-10-27T12:00:00.000Z', ahora)).toBe('hace 3 d');
  });
});
