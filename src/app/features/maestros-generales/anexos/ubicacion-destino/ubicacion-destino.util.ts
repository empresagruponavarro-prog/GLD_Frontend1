export type TipoDestino = 'EMPRESA' | 'CENTRO_COSTO';

/** A dónde va el equipo: una empresa (con ubicación) o un centro de costo (solo el centro). */
export interface DestinoSeleccionado {
  tipo: TipoDestino | null;
  /** Empresa o centro de costo elegido (0 = sin elegir). */
  destinoId: number;
  localId: number;
  nivelId: number;
  ambienteId: number;
  areaId: number;
}

export const DESTINO_VACIO: DestinoSeleccionado = {
  tipo: null,
  destinoId: 0,
  localId: 0,
  nivelId: 0,
  ambienteId: 0,
  areaId: 0,
};

/** Mensaje de lo que falta elegir, o `null` si el destino está completo. */
export function errorDestino(d: DestinoSeleccionado): string | null {
  if (d.tipo === null) return 'Elige si va a una empresa o a un centro de costo.';
  if (d.tipo === 'CENTRO_COSTO') return d.destinoId < 1 ? 'Selecciona el centro de costo de la lista.' : null;
  if (d.destinoId < 1) return 'Selecciona la empresa.';
  if (d.localId < 1 || d.nivelId < 1 || d.ambienteId < 1) return 'Selecciona el local, el nivel y el ambiente.';
  return null;
}

export interface CuerpoDestino {
  destinoTipo: TipoDestino;
  destinoId: number;
  localId?: number;
  nivelId?: number;
  ambienteId?: number;
  areaId?: number;
}

/** Campos que se envían al backend; un centro de costo no lleva ubicación física. */
export function cuerpoDestino(d: DestinoSeleccionado): CuerpoDestino {
  const area = d.areaId > 0 ? { areaId: d.areaId } : {};
  if (d.tipo === 'EMPRESA') {
    return { destinoTipo: 'EMPRESA', destinoId: d.destinoId, localId: d.localId, nivelId: d.nivelId, ambienteId: d.ambienteId, ...area };
  }
  return { destinoTipo: 'CENTRO_COSTO', destinoId: d.destinoId };
}
