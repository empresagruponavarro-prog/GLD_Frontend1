export type TipoProducto = 'PRODUCTO' | 'SERVICIO';
export type ClaseInventario = 'CONSUMIBLE' | 'EQUIPO_RETORNABLE' | 'MERCADERIA_CLIENTE';
export type EstadoOperativo = 'NORMAL' | 'NO_OPERATIVO' | 'DESCONTINUADO';

export const CLASE_INVENTARIO_LABEL: Record<ClaseInventario, string> = {
  CONSUMIBLE: 'Consumible',
  EQUIPO_RETORNABLE: 'Equipo retornable',
  MERCADERIA_CLIENTE: 'Mercadería de cliente',
};

export const ESTADO_OPERATIVO_LABEL: Record<EstadoOperativo, string> = {
  NORMAL: 'Normal',
  NO_OPERATIVO: 'No operativo',
  DESCONTINUADO: 'Descontinuado',
};

export interface FamiliaOption {
  id: number;
  nombre: string;
  prefijo: string;
}

export interface Alternativa {
  id_producto_alternativo: number;
  prioridad: number;
  codigo: string;
  descripcion: string;
}

export interface ProductoSelect {
  id: number;
  descripcion: string;
}

export interface Producto {
  id: number;
  codigo: string;
  descripcion: string;
  id_categoria: number;
  id_unidad_medida: number;
  tipo_producto: TipoProducto;
  stock: string;
  id_familia: number | null;
  clase_inventario: ClaseInventario;
  uso_principal: string | null;
  stock_minimo: string;
  stock_objetivo: string;
  estado_operativo: EstadoOperativo;
  id_almacen_default: number | null;
  costo_promedio: string;
  comentarios: string | null;
  imagen_url: string | null;
  estado: boolean;
}

export interface ProductoQuery {
  page?: number;
  pageSize?: number;
  codigo?: string;
  descripcion?: string;
  id_categoria?: number;
  id_unidad_medida?: number;
  tipo_producto?: TipoProducto;
  estado?: boolean;
  id_familia?: number;
  clase_inventario?: ClaseInventario;
}

export interface ProductoPaginated {
  data: Producto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SelectOption {
  id: number;
  nombre: string | null;
}
