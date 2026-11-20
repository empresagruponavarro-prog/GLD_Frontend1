import { prorratearTotal } from './prorrateo';

const DEMOLICIONES = [
  { id: 1, cantidad: 0, costoTotal: 0 },
  { id: 2, cantidad: 26.45, costoTotal: 431.66 },
  { id: 3, cantidad: 33.76, costoTotal: 713.01 },
];

describe('prorratearTotal (vista previa)', () => {
  it('reparte el total según el costo Meta y la suma sale exacta', () => {
    const r = prorratearTotal(1000, DEMOLICIONES);
    if (!r.ok) throw new Error(r.error);
    expect(r.partes.map((p) => p.monto)).toEqual([0, 377.1, 622.9]);
    expect(Math.round(r.partes.reduce((s, p) => s + p.monto, 0) * 100) / 100).toBe(1000);
  });

  it('un ítem sin cantidad no cotiza y no recibe nada', () => {
    const r = prorratearTotal(1000, DEMOLICIONES);
    if (!r.ok) throw new Error(r.error);
    expect(r.partes[0]).toEqual({ id: 1, cotiza: false, monto: 0, precioUnitario: 0 });
    expect(r.partes[1].precioUnitario).toBeCloseTo(377.1 / 26.45, 6);
  });

  it('el descuadre de céntimos lo absorbe el ítem de mayor peso (a igualdad, el de menor id)', () => {
    const r = prorratearTotal(100, [
      { id: 7, cantidad: 1, costoTotal: 10 },
      { id: 8, cantidad: 1, costoTotal: 10 },
      { id: 9, cantidad: 1, costoTotal: 10 },
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(r.partes.map((p) => p.monto)).toEqual([33.34, 33.33, 33.33]);
  });

  it('avisa si el total no es mayor a 0, si no hay ítems con cantidad o si no hay costo Meta', () => {
    expect(prorratearTotal(0, DEMOLICIONES)).toEqual({ ok: false, error: 'Indique el total de la subpartida (mayor a 0).' });
    expect(prorratearTotal(Number.NaN, DEMOLICIONES).ok).toBe(false);
    expect(prorratearTotal(100, [{ id: 1, cantidad: 0, costoTotal: 0 }])).toMatchObject({ ok: false, error: expect.stringContaining('no tiene ítems con cantidad') });
    expect(prorratearTotal(100, [{ id: 1, cantidad: 3, costoTotal: 0 }])).toMatchObject({ ok: false, error: expect.stringContaining('no tiene costo en el Meta') });
  });
});
