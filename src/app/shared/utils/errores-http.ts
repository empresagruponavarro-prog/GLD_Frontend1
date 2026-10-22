import { HttpErrorResponse } from '@angular/common/http';

/** Cuerpo de la respuesta de error del backend (`{ message, codigo, ... }`), si lo hay. */
function cuerpoError(err: unknown): unknown {
  return err instanceof HttpErrorResponse ? err.error : undefined;
}

/** `message` del cuerpo de error del backend: texto o lista de validaciones unidas por coma. */
export function mensajeDelBackend(err: unknown): string | null {
  const cuerpo = cuerpoError(err);
  if (typeof cuerpo !== 'object' || cuerpo === null || !('message' in cuerpo)) return null;
  const msg = cuerpo.message;
  if (Array.isArray(msg)) {
    const textos = msg.filter((m): m is string => typeof m === 'string' && m.length > 0);
    return textos.length > 0 ? textos.join(', ') : null;
  }
  return typeof msg === 'string' && msg ? msg : null;
}

/** `codigo` del cuerpo de error del backend (p. ej. `USUARIO_INACTIVO`), si lo trae. */
export function codigoDelBackend(err: unknown): string | null {
  const cuerpo = cuerpoError(err);
  if (typeof cuerpo !== 'object' || cuerpo === null || !('codigo' in cuerpo)) return null;
  return typeof cuerpo.codigo === 'string' ? cuerpo.codigo : null;
}

/** Mensaje legible: el del backend, el del error (HTTP o JS) o un texto genérico. */
export function mensajeError(err: unknown): string {
  const delBackend = mensajeDelBackend(err);
  if (delBackend) return delBackend;
  if (err instanceof HttpErrorResponse || err instanceof Error) return err.message || 'Error desconocido';
  return 'Error desconocido';
}

/**
 * Mensaje de error HTTP del backend con las validaciones unidas por salto de línea.
 * Distinto de `mensajeError` (une por coma y usa otro texto genérico): se mantiene tal cual
 * lo usaban las pantallas que venían de `almacen.utils`, para no cambiar lo que ve el usuario.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const cuerpo: unknown = err.error;
    const message = typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo ? cuerpo.message : undefined;
    if (Array.isArray(message)) return message.join('\n');
    if (typeof message === 'string') return message;
    return err.message;
  }
  return err instanceof Error ? err.message : 'Error inesperado';
}
