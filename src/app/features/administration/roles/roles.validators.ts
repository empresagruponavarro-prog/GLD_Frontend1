export const ROL_NOMBRE_MIN = 2;
export const ROL_NOMBRE_MAX = 50;
export const ROL_DESCRIPCION_MAX = 255;
/** Igual que el backend: letras (con tildes y ñ), números, espacios, guion y punto. */
const ROL_NOMBRE_PATRON = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .-]+$/;

/** Valida el nombre de un rol (se evalúa recortado). Devuelve el mensaje de error o `null`. */
export function validarNombreRol(nombre: string): string | null {
  const valor = nombre.trim();
  if (!valor) return 'Ingrese el nombre del rol.';
  if (valor.length < ROL_NOMBRE_MIN) return `El nombre debe tener al menos ${ROL_NOMBRE_MIN} caracteres.`;
  if (valor.length > ROL_NOMBRE_MAX) return `El nombre no puede superar los ${ROL_NOMBRE_MAX} caracteres.`;
  if (!ROL_NOMBRE_PATRON.test(valor)) {
    return 'Use solo letras (con tildes o ñ), números, espacios, guion y punto.';
  }
  return null;
}

/** Valida la descripción opcional de un rol. Devuelve el mensaje de error o `null`. */
export function validarDescripcionRol(descripcion: string): string | null {
  return descripcion.trim().length > ROL_DESCRIPCION_MAX
    ? `La descripción no puede superar los ${ROL_DESCRIPCION_MAX} caracteres.`
    : null;
}
