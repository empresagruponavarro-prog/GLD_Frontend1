/**
 * Tipos de roles y permisos por módulo (plan `05-roles-y-permisos.md`, §5 y §6).
 * Idénticos a los del backend; `CLAVES_MODULO` sigue el orden de la semilla de la tabla `modulo`.
 */

/** Claves estables de los módulos de GLD (34, en el orden del catálogo §5; `operaciones` es el último). */
export const CLAVES_MODULO = [
  'dashboard',
  'modulos',
  'incidencias',
  'documentos.administracion',
  'documentos.origen',
  'requerimientos',
  'requerimientos.aprobacion',
  'tesoreria.consulta',
  'tesoreria.programacion',
  'tesoreria.pagos',
  'tesoreria.cuentas',
  'tesoreria.tipo-cambio',
  'almacen.consulta',
  'almacen.stock',
  'almacen.recepciones',
  'almacen.ingresos',
  'almacen.salidas',
  'almacen.transferencias',
  'almacen.prestamos',
  'almacen.kardex',
  'almacen.inventario-inicial',
  'almacen.almacenes',
  'maestros.anexos',
  'maestros.productos',
  'maestros.areas',
  'maestros.generales',
  'centros-costos',
  'obra',
  'presupuestos',
  'presupuestos.plantillas',
  'admin.empresas',
  'admin.usuarios',
  'admin.roles',
  'operaciones',
] as const;

export type ClaveModulo = (typeof CLAVES_MODULO)[number];

/** Acciones de la matriz, en el orden de sus columnas. */
export const ACCIONES = ['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'anular'] as const;

export type Accion = (typeof ACCIONES)[number];

export type Permisos = Readonly<Record<Accion, boolean>>;

export const ETIQUETAS_ACCION: Readonly<Record<Accion, string>> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  aprobar: 'Aprobar',
  anular: 'Anular',
};

const CLAVES = new Set<string>(CLAVES_MODULO);

export function esClaveModulo(valor: string): valor is ClaveModulo {
  return CLAVES.has(valor);
}

export const SIN_PERMISOS: Permisos = {
  ver: false,
  crear: false,
  editar: false,
  eliminar: false,
  aprobar: false,
  anular: false,
};

/** Módulo del catálogo (`GET /administration/permisos/catalogo`). */
export interface ModuloCatalogo {
  id: number;
  /** Clave estable; se tipa como texto porque la define la semilla del backend. */
  clave: string;
  nombre: string;
  ruta: string | null;
  orden: number;
  admiteAprobar: boolean;
  admiteAnular: boolean;
}

/** Grupo del catálogo con sus módulos (ya ordenados por el backend). */
export interface GrupoCatalogo {
  grupo: string;
  modulos: ModuloCatalogo[];
}

/** Fila de la matriz de un rol (`GET /administration/roles/:id/permisos`). */
export interface PermisoModulo extends Permisos {
  moduloId: number;
  clave: string;
}

/** Matriz de permisos de un rol. El Administrador llega con todo `true` y `bloqueado: true`. */
export interface MatrizPermisosRol {
  rolId: number;
  rol: string;
  esSistema: boolean;
  bloqueado: boolean;
  permisos: PermisoModulo[];
}

/** Fila enviada en `PUT /administration/roles/:id/permisos` (una por cada módulo del catálogo). */
export interface PermisoModuloGuardar extends Permisos {
  clave: string;
}

export interface GuardarPermisosRol {
  permisos: PermisoModuloGuardar[];
}

/** `GET /auth/mis-permisos` (etapa B). Un módulo ausente equivale a {@link SIN_PERMISOS}. */
export interface MisPermisos {
  rol: string;
  esAdministrador: boolean;
  permisos: Partial<Record<ClaveModulo, Permisos>>;
}
