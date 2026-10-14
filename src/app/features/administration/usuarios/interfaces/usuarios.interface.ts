/** Usuario tal como lo devuelve el backend (las respuestas ya no incluyen la clave). */
export interface Usuario {
  IdUsuario: string;
  Nombres: string;
  Usuario: string;
  Rol?: string;
}

/** `POST /administration/usuarios`: la clave (8-128) y el rol del catálogo son obligatorios; el `IdUsuario` lo asigna el backend. */
export interface UsuarioCreateDto {
  Nombres: string;
  Usuario: string;
  Rol: string;
  Clave: string;
}

/** `PATCH /administration/usuarios/:id`: `Clave` solo se envía para cambiarla. */
export interface UsuarioUpdateDto {
  Nombres?: string;
  Usuario?: string;
  Rol?: string;
  Clave?: string;
}
