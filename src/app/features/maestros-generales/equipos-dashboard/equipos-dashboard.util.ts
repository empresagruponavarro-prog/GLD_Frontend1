import { etiquetaDestino } from '../anexos/equipo-presentacion';
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
  destino: string;
  area: string;
  estado: string;
  asignacion: Asignacion;
  busqueda: string;
}

export const SIN_FILTROS: FiltrosEquipos = { tipo: '', local: '', destino: '', area: '', estado: '', asignacion: '', busqueda: '' };

export const SIN_AREA = 'Sin área';
export const SIN_UBICACION = 'Sin ubicación';
export const SIN_DESTINO = 'Sin destino';

/** Obra / centro de costo o sede a la que pertenece el local del equipo. */
export function destinoDe(e: EquipoInventario): string {
  return etiquetaDestino(e.destino, e.destinoTipo) || SIN_DESTINO;
}

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
    if (f.destino && destinoDe(e) !== f.destino) return false;
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

export interface MesEntrega {
  /** Clave `AAAA-MM`. */
  clave: string;
  /** Etiqueta corta, p. ej. «oct». */
  etiqueta: string;
  cantidad: number;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Equipos entregados por mes en los últimos `meses` meses hasta `hoy` (`AAAA-MM-DD`), también los meses en cero. */
export function entregasPorMes(equipos: readonly EquipoInventario[], hoy: string, meses = 6): MesEntrega[] {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7)) - 1;
  const lista: MesEntrega[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const indice = anio * 12 + mes - i;
    const a = Math.floor(indice / 12);
    const m = indice % 12;
    lista.push({ clave: `${a}-${String(m + 1).padStart(2, '0')}`, etiqueta: MESES[m] ?? '', cantidad: 0 });
  }
  for (const e of equipos) {
    if (e.responsableId === null) continue;
    const celda = lista.find((x) => x.clave === e.fechaAsignacion.slice(0, 7));
    if (celda) celda.cantidad++;
  }
  return lista;
}

export interface Matriz {
  columnas: string[];
  filas: { etiqueta: string; celdas: number[]; total: number }[];
  maximo: number;
}

/** Cruza dos dimensiones: las `maxFilas` filas más pobladas contra las columnas dadas. */
export function matriz(
  equipos: readonly EquipoInventario[],
  fila: (e: EquipoInventario) => string,
  columna: (e: EquipoInventario) => string,
  columnas: readonly string[],
  maxFilas = 8,
): Matriz {
  const filas = new Map<string, number[]>();
  for (const e of equipos) {
    const c = columnas.indexOf(columna(e));
    if (c < 0) continue;
    const k = fila(e);
    const celdas = filas.get(k) ?? columnas.map(() => 0);
    celdas[c] = (celdas[c] ?? 0) + 1;
    filas.set(k, celdas);
  }
  const lista = [...filas.entries()]
    .map(([etiqueta, celdas]) => ({ etiqueta, celdas, total: celdas.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta, 'es'))
    .slice(0, maxFilas);
  return { columnas: [...columnas], filas: lista, maximo: Math.max(0, ...lista.flatMap((f) => f.celdas)) };
}
