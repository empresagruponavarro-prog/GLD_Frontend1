export type TipoProducto = 'PRODUCTO' | 'SERVICIO';

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
