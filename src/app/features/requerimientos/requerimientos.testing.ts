import { Paginated, Requerimiento, RequerimientoLinea } from './requerimientos.models';

/** Línea de requerimiento para los specs (un producto con saldo por ordenar). */
export function lineaRequerimiento(cambios: Partial<RequerimientoLinea> = {}): RequerimientoLinea {
  return {
    id: 11,
    id_producto: 100,
    codigo: 'P-100',
    descripcion: 'Cemento Portland',
    tipo_producto: 'PRODUCTO',
    unidad: 'BOL',
    cantidad: '10',
    cantidad_aprobada: null,
    precio_referencial: '25',
    observaciones: null,
    id_beneficiario: null,
    beneficiario: null,
    cantidad_ordenada: '0',
    saldo_por_ordenar: '10',
    ...cambios,
  };
}

/** Requerimiento (FUR) para los specs; por defecto una caja chica en BORRADOR. */
export function requerimiento(cambios: Partial<Requerimiento> = {}): Requerimiento {
  return {
    id: 5,
    numero: 'FUR-000005',
    fecha: '2026-10-01',
    fecha_requerida: null,
    id_centro_costo: 3,
    centro_costo: 'Obra Norte',
    id_fase: null,
    fase: null,
    id_solicitante: 7,
    solicitante: 'Ana Ruiz',
    area: null,
    tipo: 'CAJA_CHICA',
    id_beneficiario: null,
    beneficiario: null,
    id_area: null,
    area_nombre: null,
    id_cotizacion_ganadora: null,
    comentario_adjudicacion: null,
    total_cotizaciones: 0,
    justificacion: 'Gastos menores de obra',
    estado: 'BORRADOR',
    id_aprobador: null,
    aprobador: null,
    fecha_aprobacion: null,
    comentario_aprobacion: null,
    avance: null,
    created_at: '2026-10-01T10:00:00Z',
    total_lineas: 1,
    ...cambios,
  };
}

/** Página con los requerimientos dados. */
export function paginaDe(data: Requerimiento[]): Paginated<Requerimiento> {
  return { data, total: data.length, page: 1, pageSize: 20, totalPages: 1 };
}
