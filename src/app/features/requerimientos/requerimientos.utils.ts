import { AvanceRequerimiento, EstadoRequerimiento } from './requerimientos.models';

/** Estados en los que el solicitante todavía puede modificar el FUR. */
export const ESTADOS_EDITABLES: readonly EstadoRequerimiento[] = ['BORRADOR', 'OBSERVADO'];

export function esEditable(estado: EstadoRequerimiento): boolean {
  return ESTADOS_EDITABLES.includes(estado);
}

/** Clase CSS del badge para cada estado del FUR. */
export function estadoBadge(estado: EstadoRequerimiento): string {
  switch (estado) {
    case 'APROBADO':
      return 'badge-completed';
    case 'ENVIADO':
    case 'COTIZADO':
    case 'OBSERVADO':
      return 'badge-pending';
    case 'RECHAZADO':
    case 'ANULADO':
      return 'badge-danger';
    default:
      return 'badge-progress';
  }
}

/** Clase CSS del badge para el avance de atención de un FUR aprobado. */
export function avanceBadge(avance: AvanceRequerimiento): string {
  switch (avance) {
    case 'ATENDIDO':
      return 'badge-completed';
    case 'PARCIAL':
      return 'badge-pending';
    default:
      return 'badge-progress';
  }
}

/** ¿Este FUR pasa por cotizaciones antes de aprobarse? Solo las compras. */
export function llevaCotizacion(tipo: string): boolean {
  return tipo === 'COMPRA';
}

/** Estados desde los que el FUR se puede anular (con APROBADO solo si no tiene documentos vigentes). */
export const ESTADOS_ANULABLES: readonly EstadoRequerimiento[] = ['BORRADOR', 'ENVIADO', 'OBSERVADO', 'COTIZADO', 'APROBADO'];
