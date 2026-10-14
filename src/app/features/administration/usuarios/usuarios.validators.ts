export const CLAVE_MIN = 8;
export const CLAVE_MAX = 128;

/** Valida una clave nueva y su confirmación. Devuelve el mensaje de error o `null`. */
export function validarClaveNueva(clave: string, confirmacion: string): string | null {
  if (!clave) return 'Ingrese la contraseña.';
  if (clave.length < CLAVE_MIN) return `La contraseña debe tener al menos ${CLAVE_MIN} caracteres.`;
  if (clave.length > CLAVE_MAX) return `La contraseña no puede superar los ${CLAVE_MAX} caracteres.`;
  if (clave !== confirmacion) return 'La confirmación no coincide con la contraseña.';
  return null;
}
