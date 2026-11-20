/**
 * Prorrateo de la cotización de una subpartida: el proveedor da UN total por toda la subpartida y se reparte entre sus ítems en
 * proporción a su costo en el Meta. Es la misma regla que aplica el backend (`prorrateo.ts`); aquí solo sirve para mostrar la vista
 * previa antes de guardar: lo que se guarda es lo que calcula el servidor.
 */

export interface ItemParaProrrateo {
  id: number;
  /** Cantidad del ítem en el presupuesto. */
  cantidad: number;
  /** Costo total del ítem en el Meta (el peso del reparto). */
  costoTotal: number;
}

export interface PartePorItem {
  id: number;
  /** false = ítem sin cantidad en el presupuesto: no entra en la cotización. */
  cotiza: boolean;
  /** Parte del total que le toca (2 decimales); la suma de todos es exactamente el total. */
  monto: number;
  /** Precio unitario resultante (monto / cantidad). */
  precioUnitario: number;
}

export type ResultadoProrrateo = { ok: true; partes: PartePorItem[] } | { ok: false; error: string };

const aCentimos = (n: number): number => Math.round(n * 100);

/**
 * Reparte `total` entre los ítems con cantidad según su costo Meta, en céntimos; el descuadre de redondeo lo absorbe el ítem de
 * mayor peso. Devuelve un error legible si el total no es mayor a 0 o si la subpartida no tiene costo en el Meta.
 */
export function prorratearTotal(total: number, items: readonly ItemParaProrrateo[]): ResultadoProrrateo {
  if (!Number.isFinite(total) || !(total > 0)) return { ok: false, error: 'Indique el total de la subpartida (mayor a 0).' };
  const conCantidad = items.filter((i) => i.cantidad > 0);
  if (conCantidad.length === 0) return { ok: false, error: 'La subpartida no tiene ítems con cantidad: no hay nada que cotizar.' };
  const pesoTotal = conCantidad.reduce((s, i) => s + Math.max(i.costoTotal, 0), 0);
  if (!(pesoTotal > 0)) return { ok: false, error: 'La subpartida no tiene costo en el Meta: asigne costos a sus ítems para poder prorratear.' };

  const totalCentimos = aCentimos(total);
  const montos = new Map<number, number>();
  for (const i of conCantidad) montos.set(i.id, Math.round((totalCentimos * Math.max(i.costoTotal, 0)) / pesoTotal));
  const descuadre = totalCentimos - [...montos.values()].reduce((s, c) => s + c, 0);
  if (descuadre !== 0) {
    const mayor = [...conCantidad].sort((a, b) => b.costoTotal - a.costoTotal || a.id - b.id)[0];
    montos.set(mayor.id, (montos.get(mayor.id) ?? 0) + descuadre);
  }

  const partes = items.map((i): PartePorItem => {
    if (!(i.cantidad > 0)) return { id: i.id, cotiza: false, monto: 0, precioUnitario: 0 };
    const centimos = montos.get(i.id) ?? 0;
    return { id: i.id, cotiza: true, monto: centimos / 100, precioUnitario: centimos / 100 / i.cantidad };
  });
  return { ok: true, partes };
}
