export type EstadoEquipo = 'Operativo' | 'En reparación' | 'De baja';

export interface EquipoAsignado {
  id: number;
  /** Código del bien en el catálogo (clase Activo Fijo). */
  codigo: string;
  /** Código propio del activo fijo (AF-0001). */
  codigoActivo: string;
  tipo: string;
  marca: string;
  modelo: string;
  color: string | null;
  serie: string | null;
  cantidad: number;
  estado: EstadoEquipo;
  /** ISO yyyy-MM-dd. */
  fechaAsignacion: string;
  caracteristicas: Record<string, string>;
  localId: number;
  local: string;
  nivelId: number;
  nivel: string;
  ambienteId: number;
  ambiente: string;
}

export interface NuevaAsignacion {
  codigoBien: string;
  serie: string | null;
  fechaAsignacion: string;
  localId: number;
  nivelId: number;
  ambienteId: number;
  /** Características de esta unidad; el backend guarda solo las que difieren del catálogo. */
  caracteristicas: Record<string, string>;
}

export interface BienCatalogo {
  id: number;
  codigo: string;
  descripcion: string;
  tipo: string;
  /** Características estándar del bien (tabla hija del catálogo). */
  caracteristicas: Record<string, string>;
}

export interface AmbienteOpcion {
  id: number;
  nombre: string;
}

export interface NivelOpcion {
  id: number;
  nombre: string;
  ambientes: AmbienteOpcion[];
}

export interface LocalOpcion {
  id: number;
  nombre: string;
  niveles: NivelOpcion[];
}

export interface OpcionesEquipo {
  catalogo: BienCatalogo[];
  locales: LocalOpcion[];
}

/** Datos del trabajador que se muestran en el encabezado del modal y en el QR. */
export interface TrabajadorResumen {
  id: number;
  anexo: string;
  tipoDocumento: string;
  numeroDocumento: string;
  especialidad: string;
}
