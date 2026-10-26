import { EquipoInventario } from '../anexos/interfaces/equipo-asignado.interface';

export interface Conteo {
  /** Texto que se muestra (también sirve de valor del filtro). */
  etiqueta: string;
  cantidad: number;
}

export type Asignacion = '' | 'asignados' | 'disponibles';

export interface FiltrosEquipos {
  tipo: string;
  local: string;
  area: string;
  estado: string;
  asignacion: Asignacion;
  busqueda: string;
}

export const SIN_FILTROS: FiltrosEquipos = { tipo: '', local: '', area: '', estado: '', asignacion: '', busqueda: '' };

export const SIN_AREA = 'Sin área';
export const SIN_UBICACION = 'Sin ubicación';

export function ramDe(e: EquipoInventario): string {
  const ram = e.caracteristicas['RAM'] ?? '';
  return /\d+\s*GB/i.exec(ram)?.[0].replace(/\s+/g, ' ').toUpperCase() ?? (ram || 'Sin dato');
}

export function ubicacionDe(e: EquipoInventario): string {
  return e.local ? [e.local, e.nivel, e.ambiente].filter(Boolean).join(' · ') : SIN_UBICACION;
}

/** Cuenta equipos por la clave indicada, del más al menos frecuente (y por nombre al empatar). */
export function contarPor(equipos: readonly EquipoInventario[], clave: (e: EquipoInventario) => string, limite = 0): Conteo[] {
  const cuenta = new Map<string, number>();
  for (const e of equipos) {
    const k = clave(e);
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }
  const lista = [...cuenta.entries()]
    .map(([etiqueta, cantidad]) => ({ etiqueta, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.etiqueta.localeCompare(b.etiqueta, 'es'));
  return limite > 0 ? lista.slice(0, limite) : lista;
}

export function filtrarEquipos(equipos: readonly EquipoInventario[], f: FiltrosEquipos): EquipoInventario[] {
  const texto = f.busqueda.trim().toLowerCase();
  return equipos.filter((e) => {
    if (f.tipo && e.tipo !== f.tipo) return false;
    if (f.local && (e.local || SIN_UBICACION) !== f.local) return false;
    if (f.area && (e.area ?? SIN_AREA) !== f.area) return false;
    if (f.estado && e.estado !== f.estado) return false;
    if (f.asignacion === 'asignados' && e.responsableId === null) return false;
    if (f.asignacion === 'disponibles' && e.responsableId !== null) return false;
    if (!texto) return true;
    return [e.codigo, e.codigoActivo, e.tipo, e.marca, e.modelo, e.serie ?? '', e.responsable ?? '', e.local, e.nivel, e.ambiente, e.area ?? '']
      .join(' ')
      .toLowerCase()
      .includes(texto);
  });
}

export function valoresUnicos(equipos: readonly EquipoInventario[], valor: (e: EquipoInventario) => string): string[] {
  return [...new Set(equipos.map(valor))].sort((a, b) => a.localeCompare(b, 'es'));
}
