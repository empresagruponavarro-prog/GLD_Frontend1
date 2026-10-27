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
  areaId: number | null;
  area: string | null;
}

/** Un equipo del inventario general, con su responsable (si lo tiene). */
export interface EquipoInventario extends EquipoAsignado {
  responsableId: number | null;
  responsable: string | null;
}

export interface NuevaAsignacion {
  codigoBien: string;
  serie: string | null;
  fechaAsignacion: string;
  localId: number;
  nivelId: number;
  ambienteId: number;
  /** Si se omite, el backend usa el área de la ubicación. */
  areaId?: number;
  /** Características de esta unidad; el backend guarda solo las que difieren del catálogo. */
  caracteristicas: Record<string, string>;
}

/** Registro de un activo en el inventario; sin `anexoId` queda disponible. */
export interface NuevoActivo {
  codigoBien: string;
  serie: string | null;
  localId: number;
  nivelId: number;
  ambienteId: number;
  areaId?: number;
  caracteristicas: Record<string, string>;
  anexoId?: number;
  fechaAsignacion?: string;
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
  /** Área por defecto de esa ubicación. */
  areaId: number | null;
}

export interface AreaOpcion {
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
  areas: AreaOpcion[];
}

/** Datos del trabajador que se muestran en el encabezado del modal y en el QR. */
export interface TrabajadorResumen {
  id: number;
  anexo: string;
  tipoDocumento: string;
  numeroDocumento: string;
  especialidad: string;
}

export interface MovimientoEquipo {
  id: number;
  movimiento: 'Asignación' | 'Reasignación' | 'Devolución';
  /** ISO yyyy-MM-dd. */
  fecha: string;
  responsableAnterior: string | null;
  responsableNuevo: string | null;
  ubicacionAnterior: string | null;
  ubicacionNueva: string | null;
  areaAnterior: string | null;
  areaNueva: string | null;
}
