import { HttpErrorResponse } from '@angular/common/http';
import { Alerta, EstadoPlazo } from './almacen.models';

/** Fecha local (YYYY-MM-DD) sin conversiones de zona horaria. */
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** Mensaje legible de un error HTTP del backend (maneja `message` string o lista). */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = err.error?.message;
    if (Array.isArray(message)) return message.join('\n');
    if (typeof message === 'string') return message;
    return err.message;
  }
  return err instanceof Error ? err.message : 'Error inesperado';
}

/** Clase CSS del badge para cada alerta de stock. */
export function alertaBadge(alerta: Alerta): string {
  switch (alerta) {
    case 'OK':
      return 'badge-completed';
    case 'BAJO_MINIMO':
      return 'badge-pending';
    default:
      return 'badge-danger';
  }
}

/** Clase CSS del badge para el estado del plazo de un préstamo. */
export function plazoBadge(plazo: EstadoPlazo): string {
  switch (plazo) {
    case 'EN_PLAZO':
    case 'RETORNADO_A_TIEMPO':
      return 'badge-completed';
    case 'VENCE_HOY':
    case 'RETORNADO_CON_RETRASO':
      return 'badge-pending';
    case 'VENCIDO':
      return 'badge-danger';
    default:
      return 'badge-progress';
  }
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
