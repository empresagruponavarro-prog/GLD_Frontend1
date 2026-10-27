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

/** Fecha de hoy como yyyy-MM-dd (hora local). */
export function hoyISO(): string {
  const d = new Date();
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Descarga un archivo recibido como Blob con el nombre indicado. */
export function descargarBlob(archivo: Blob, nombre: string): void {
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** «Centro de costo: X» o «Empresa: X» según el destino del equipo; vacío si no tiene. */
export function etiquetaDestino(destino: string | null, tipo: 'EMPRESA' | 'CENTRO_COSTO' | null): string {
  if (!destino || !tipo) return '';
  return `${tipo === 'CENTRO_COSTO' ? 'Centro de costo' : 'Empresa'}: ${destino}`;
}
