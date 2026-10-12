/** Convierte YYYY-MM-DD a Date en UTC (sin saltos por zona horaria). */
function parse(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(fecha: string, dias: number): string {
  const d = parse(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Los pagos se programan los viernes. */
export function esViernes(fecha: string): boolean {
  return parse(fecha).getUTCDay() === 5;
}

/** Próximo viernes a partir de `desde` (incluyéndolo si ya es viernes). */
export function proximoViernes(desde: string): string {
  const d = parse(desde);
  const falta = (5 - d.getUTCDay() + 7) % 7;
  return addDays(desde, falta);
}

/** Los próximos `n` viernes a partir de `desde`. */
export function proximosViernes(desde: string, n = 8): string[] {
  const primero = proximoViernes(desde);
  return Array.from({ length: n }, (_, i) => addDays(primero, i * 7));
}

/** Porcentaje (0-100) de `valor` respecto de `max`, para barras de gráficos. */
export function pct(valor: string | number, max: number): number {
  const v = Number(valor);
  return max > 0 && Number.isFinite(v) ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
}
