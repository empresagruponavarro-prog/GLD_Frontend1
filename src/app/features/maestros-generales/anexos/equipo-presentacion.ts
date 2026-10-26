import { EstadoEquipo } from './interfaces/equipo-asignado.interface';

const ICONOS_POR_TIPO: readonly (readonly [string, string])[] = [
  ['laptop', 'fa-laptop'],
  ['notebook', 'fa-laptop'],
  ['celular', 'fa-mobile-screen'],
  ['telefono', 'fa-mobile-screen'],
  ['tablet', 'fa-tablet-screen-button'],
  ['monitor', 'fa-desktop'],
  ['impresora', 'fa-print'],
  ['tv', 'fa-tv'],
  ['pc', 'fa-computer'],
  ['computad', 'fa-computer'],
];

const CLASE_ESTADO: Record<EstadoEquipo, string> = {
  Operativo: 'badge-completed',
  'En reparación': 'badge-pending',
  'De baja': 'badge-danger',
};

/** Icono Font Awesome según el tipo de equipo (Laptop, PC, Celular...). */
export function iconoDeTipo(tipo: string): string {
  const t = tipo.toLowerCase();
  return ICONOS_POR_TIPO.find(([clave]) => t.includes(clave))?.[1] ?? 'fa-microchip';
}

export function claseDeEstado(estado: EstadoEquipo): string {
  return CLASE_ESTADO[estado];
}
