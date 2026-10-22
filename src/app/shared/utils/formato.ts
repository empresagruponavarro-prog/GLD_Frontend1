/** Fecha local (YYYY-MM-DD) sin conversiones de zona horaria. */
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** Formatea un decimal en string para mostrarlo (hasta 4 decimales, sin ceros sobrantes). */
export function fmtNum(value: string | number | null | undefined, decimals = 4): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

/** Formatea un monto con 2 decimales. */
export function fmtMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
