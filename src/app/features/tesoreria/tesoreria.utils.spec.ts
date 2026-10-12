import { addDays, esViernes, pct, proximoViernes, proximosViernes } from './tesoreria.utils';

describe('tesoreria.utils', () => {
  it('reconoce los viernes sin depender de la zona horaria', () => {
    expect(esViernes('2026-10-16')).toBe(true);
    expect(esViernes('2026-10-15')).toBe(false);
    expect(esViernes('2026-10-17')).toBe(false);
  });

  it('el próximo viernes incluye el mismo día si ya es viernes', () => {
    expect(proximoViernes('2026-10-16')).toBe('2026-10-16');
    expect(proximoViernes('2026-10-11')).toBe('2026-10-16');
    expect(proximoViernes('2026-10-17')).toBe('2026-10-23');
  });

  it('lista viernes consecutivos', () => {
    expect(proximosViernes('2026-10-11', 3)).toEqual(['2026-10-16', '2026-10-23', '2026-10-30']);
  });

  it('suma días cruzando de mes y año', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('calcula porcentajes acotados para las barras', () => {
    expect(pct('50', 200)).toBe(25);
    expect(pct(300, 200)).toBe(100);
    expect(pct(10, 0)).toBe(0);
  });
});
