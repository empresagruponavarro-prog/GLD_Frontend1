/** Rol tal como lo devuelve `GET /administration/roles` (sistema primero, luego por nombre). */
export interface RolAdmin {
  id: number;
  nombre: string;
  descripcion: string | null;
  /** Rol de sistema (Administrador): no se puede renombrar ni eliminar; sí cambiar su descripción. */
  es_sistema: boolean;
  /** Cuántos usuarios tienen asignado el rol. */
  usuarios: number;
}

/** `POST /administration/roles`: `nombre` 2-50 caracteres; 409 si ya existe (sin distinguir mayúsculas). */
export interface RolCrear {
  nombre: string;
  descripcion?: string;
}

/** `PATCH /administration/roles/:id`: solo los campos que cambian. Renombrar actualiza a los usuarios que lo tenían. */
export interface RolActualizar {
  nombre?: string;
  descripcion?: string;
}
