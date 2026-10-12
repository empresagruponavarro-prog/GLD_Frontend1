/**
 * Cálculos financieros de Presupuestos como funciones puras (PRES-01).
 *
 * Reproducen exactamente la aritmética que antes vivía en `presupuestos.ts`, incluido el
 * orden de las operaciones: `cd * (pct / 100)` y `cd * pct / 100` no siempre dan el mismo
 * resultado en coma flotante, por eso la liquidación del wizard y `statsFase` usan cada uno
 * su fórmula original.
 */

/** Tasa del IGV peruano. */
export const TASA_IGV = 0.18;

type Monto = string | number | null | undefined;

export type EstadoFase = 'Sin Iniciar' | 'Sobrecosto' | 'Completado' | 'En Curso';

export interface StatsFase {
  cd: number;
  cdTotal: number;
  ggPorcentaje: number;
  utilPorcentaje: number;
  gg: number;
  util: number;
  total: number;
}

/** Convierte un monto del API (string, number o vacío) a número; lo no numérico vale 0. */
export function aNumero(valor: Monto): number {
  return Number(valor) || 0;
}

/** Suma un campo numérico de una lista, tratando lo no numérico como 0. */
export function sumarCampo<T>(items: readonly T[], campo: (item: T) => Monto): number {
  return items.reduce((acc, item) => acc + aNumero(campo(item)), 0);
}

// ── Liquidación del wizard (Paso 3) ─────────────────────────────────────────

export function costoDirecto(filas: readonly { subtotal: Monto }[]): number {
  return sumarCampo(filas, (f) => f.subtotal);
}

export function montoGG(cd: number, pctGG: number): number {
  return cd * (pctGG / 100);
}

export function montoUtilidad(cd: number, pctUtilidad: number): number {
  return cd * (pctUtilidad / 100);
}

export function subtotalSinIgv(cd: number, gg: number, utilidad: number, viaticos: number, descuento: number): number {
  return (cd + gg + utilidad + viaticos) - descuento;
}

export function igv(subtotal: number): number {
  return subtotal * TASA_IGV;
}

export function totalConIgv(subtotal: number): number {
  return subtotal + igv(subtotal);
}

/** Suma `delta` a un parámetro financiero, redondea a 2 decimales y nunca baja de 0. */
export function ajustarParametro(actual: number, delta: number): number {
  return Math.max(0, Number((actual + delta).toFixed(2)));
}

// ── Pesos y ponderación de fases ────────────────────────────────────────────

/** Peso de una parte sobre su total como texto con 1 decimal (`'12.5%'`); `'0.0%'` si no aplica. */
export function pesoPorcentaje(parte: Monto, total: Monto): string {
  const t = aNumero(total);
  const p = aNumero(parte);
  if (t <= 0 || p <= 0) return '0.0%';
  return ((p / t) * 100).toFixed(1) + '%';
}

/** Porcentaje del costo directo total que ya está asignado a fases, con 1 decimal. */
export function ponderacionFases(fases: readonly { CostoDirecto?: Monto }[], cdTotal: Monto): number {
  const total = aNumero(cdTotal);
  if (total <= 0) return 0;
  const sumFases = sumarCampo(fases, (f) => f.CostoDirecto);
  return Number(((sumFases / total) * 100).toFixed(1));
}

export function saldoSinAsignar(fases: readonly { CostoDirecto?: Monto }[], cdTotal: Monto): number {
  return aNumero(cdTotal) - sumarCampo(fases, (f) => f.CostoDirecto);
}

// ── Compras (documentos origen) contra presupuesto ──────────────────────────

/** Agrupa las líneas de compra por fase y devuelve también el total general. */
export function comprasPorFase(
  lineas: readonly { id_fase?: number | null; monto: Monto }[],
): { porFase: Record<number, number>; total: number } {
  const porFase: Record<number, number> = {};
  let total = 0;
  for (const linea of lineas) {
    const monto = aNumero(linea.monto);
    total += monto;
    if (linea.id_fase != null) {
      const fid = Number(linea.id_fase);
      porFase[fid] = (porFase[fid] || 0) + monto;
    }
  }
  return { porFase, total };
}

/**
 * Porcentaje comprometido de un presupuesto. Sin presupuesto (cd <= 0) vale 100 si hay
 * compras y 0 si no. `redondear` lo deja entero y `tope100` lo limita a 100.
 */
export function pctCompras(
  cd: Monto,
  compras: number,
  opciones: { redondear?: boolean; tope100?: boolean } = {},
): number {
  const base = aNumero(cd);
  if (base <= 0) return compras > 0 ? 100 : 0;
  const pct = (compras / base) * 100;
  if (!opciones.redondear) return pct;
  const entero = Math.round(pct);
  return opciones.tope100 ? Math.min(100, entero) : entero;
}

/** true si las compras superan un presupuesto positivo. */
export function estaSobrepasado(presupuesto: Monto, compras: number): boolean {
  const p = aNumero(presupuesto);
  return p > 0 && compras > p;
}

export function estadoFase(cd: Monto, compras: number): EstadoFase {
  const base = aNumero(cd);
  if (compras <= 0) return 'Sin Iniciar';
  if (base > 0 && compras > base) return 'Sobrecosto';
  if (base > 0 && compras >= base) return 'Completado';
  return 'En Curso';
}

// ── Resumen financiero de la fase seleccionada ──────────────────────────────

/** GG, utilidad y total de la fase seleccionada; sin fase, del presupuesto completo. */
export function statsFase(
  ppto: { CostoDirecto?: Monto; GGPorcentaje?: Monto; UtiliPorcentaje?: Monto } | null,
  fase: { CostoDirecto?: Monto } | null,
): StatsFase | null {
  if (!ppto) return null;
  const cdTotal = aNumero(ppto.CostoDirecto);
  const cd = fase ? aNumero(fase.CostoDirecto) : cdTotal;
  const ggPorcentaje = aNumero(ppto.GGPorcentaje);
  const utilPorcentaje = aNumero(ppto.UtiliPorcentaje);
  const gg = cd * ggPorcentaje / 100;
  const util = cd * utilPorcentaje / 100;
  return { cd, cdTotal, ggPorcentaje, utilPorcentaje, gg, util, total: cd + gg + util };
}
