import type { Permisos } from '@app/core/auth/permisos.models';

/** Usuario tal como lo devuelve el backend (las respuestas ya no incluyen la clave). */
export interface Usuario {
  IdUsuario: string;
  Nombres: string;
  Usuario: string;
  Rol?: string;
  /** `false` = desactivado: no puede iniciar sesión y su sesión abierta se corta en la siguiente petición. */
  activo: boolean;
  /** Área asignada (plan 08); `null` = sin área (alcance global). */
  id_area?: number | null;
  area?: AreaItem | null;
  /** `true` si el usuario tiene excepciones de permisos propias sobre las de su rol y su área. */
  tiene_permisos_personalizados?: boolean;
}

/** `PATCH /administration/usuarios/:id/estado`. */
export interface UsuarioEstadoDto {
  activo: boolean;
}

/** `POST /administration/usuarios`: la clave (8-128) y el rol del catálogo son obligatorios; el `IdUsuario` lo asigna el backend. */
export interface UsuarioCreateDto {
  Nombres: string;
  Usuario: string;
  Rol: string;
  Clave: string;
  id_area?: number | null;
}

/** `PATCH /administration/usuarios/:id`: `Clave` solo se envía para cambiarla. */
export interface UsuarioUpdateDto {
  Nombres?: string;
  Usuario?: string;
  Rol?: string;
  Clave?: string;
  id_area?: number | null;
}

export interface AreaItem {
  id: number;
  codigo?: string;
  nombre: string;
  estado?: boolean;
}

/** Estado del módulo en el área del usuario; `sin_restriccion` = no se filtra por área. */
export type EstadoAreaModulo = 'sin_restriccion' | 'no' | 'solo_ver' | 'completo';

/** De dónde sale el permiso efectivo: el rol, el recorte del área o una excepción del usuario. */
export type OrigenPermiso = 'rol' | 'area' | 'excepcion';

/** Un módulo en `GET /administration/usuarios/:id/permisos`: rol → área → excepción → efectivo. */
export interface PermisoUsuarioModulo {
  id: number;
  clave: string;
  nombre: string;
  grupo: string;
  admite_aprobar: boolean;
  admite_anular: boolean;
  area: EstadoAreaModulo;
  /** Lo que da el rol en este módulo. */
  rol: Permisos;
  /** Lo que queda tras el filtro del área (antes de la excepción). */
  tras_area: Permisos;
  /** Excepción propia del usuario en este módulo (`null` = no tiene). */
  excepcion: Permisos | null;
  /** Lo que la persona puede hacer de verdad (lo que aplica la API). */
  efectivo: Permisos;
  origen: OrigenPermiso;
}

export interface PermisosUsuario {
  id_usuario: string;
  nombres: string;
  usuario: string;
  rol: string;
  area: AreaItem | null;
  /** `true` si el área del usuario tiene módulos configurados (el filtro de área aplica). */
  area_configurada: boolean;
  /** `true` para el Administrador: lo tiene todo y no admite excepciones. */
  es_administrador: boolean;
  personalizado: boolean;
  modulos: PermisoUsuarioModulo[];
}

/** Entrada del PUT: una excepción reemplaza el módulo completo para ese usuario (todo en `false` lo quita). */
export interface ExcepcionUsuario extends Permisos {
  clave: string;
}

export interface GuardarExcepcionesUsuario {
  excepciones: ExcepcionUsuario[];
}
