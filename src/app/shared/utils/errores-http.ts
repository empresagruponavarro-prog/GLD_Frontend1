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
