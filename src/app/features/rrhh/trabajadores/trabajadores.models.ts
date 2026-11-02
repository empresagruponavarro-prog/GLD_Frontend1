/** Trabajador de RR.HH. (`/rrhh/trabajadores`): su anexo (tipo Trabajador) y su ficha de RR.HH. */
export interface Trabajador {
  id: number;
  /** Nombre completo. */
  Anexo: string | null;
  AnexoTipoDocIdeId: number | null;
  NumeroDocIde: string | null;
  AnexoEspecialidadId: number | null;
  /** Contacto personal. */
  Direccion: string | null;
  Telefono: string | null;
  Correo: string | null;
  /** `false` = dado de baja. */
  estado: boolean;
  /** `false` = trabajador antiguo que RR.HH. aún no completó. */
  conFicha: boolean;
  idTipoTrabajador: number | null;
  tipoTrabajador: string | null;
  idModalidadContrato: number | null;
  modalidadContrato: string | null;
  idArea: number | null;
  area: string | null;
  /** Contacto institucional. */
  direccionInstitucional: string | null;
  telefonoInstitucional: string | null;
  correoInstitucional: string | null;
}

/** Lo que RR.HH. tiene que ir corrigiendo. */
export type Situacion = 'ficha-pendiente' | 'documento-pendiente';

export interface TrabajadorQuery {
  page?: number;
  pageSize?: number;
  /** Busca en el nombre y en el número de documento. */
  busqueda?: string;
  estado?: boolean;
  situacion?: Situacion;
  idTipoTrabajador?: number;
  idModalidadContrato?: number;
  idArea?: number;
}

/** Conteos de las tarjetas (todos los trabajadores, sin filtros). */
export interface ResumenTrabajadores {
  total: number;
  activos: number;
  deBaja: number;
  fichaPendiente: number;
  documentoPendiente: number;
}

export interface TrabajadoresPaginados {
  data: Trabajador[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Cuerpo de alta / edición. `null` borra un dato opcional. */
export interface TrabajadorGuardar {
  Anexo: string;
  AnexoTipoDocIdeId: number;
  NumeroDocIde: string;
  AnexoEspecialidadId: number | null;
  idTipoTrabajador: number;
  idModalidadContrato: number;
  idArea: number | null;
  Direccion: string | null;
  Telefono: string | null;
  Correo: string | null;
  direccionInstitucional: string | null;
  telefonoInstitucional: string | null;
  correoInstitucional: string | null;
  estado: boolean;
}

export interface OpcionSelect {
  id: number;
  nombre: string | null;
}

/** Opción de un catálogo de RR.HH.; las inactivas no se ofrecen, pero se siguen mostrando a quien la tiene. */
export interface OpcionCatalogo {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface OpcionesTrabajador {
  tiposDocumento: OpcionCatalogo[];
  tiposTrabajador: OpcionCatalogo[];
  modalidadesContrato: OpcionCatalogo[];
}

/** Área para el selector (`GET /maestros/area?activas=true`). */
export interface AreaOpcion {
  id: number;
  nombre: string;
  jefe?: string | null;
}
