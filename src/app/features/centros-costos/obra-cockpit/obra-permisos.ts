/**
 * Permisos de escritura del módulo `obra` (plan 05, etapa D3) que el cockpit calcula con
 * `permisosDePantalla('obra')` y pasa como `input()` a sus pestañas y diálogos.
 *
 * Son valores planos (no signals) para que cada pestaña/diálogo los reciba como un único input
 * tipado. La acción que exige cada control es la del backend (anexo §7.3):
 * - `crear`: altas (`POST`), incluida la subida de archivos (`POST …/archivo`).
 * - `editar`: `PATCH`, el avance semanal y la nueva versión de un plano (`@Accion('editar')`).
 * - `eliminar`: `DELETE`, incluido el descarte de archivos subidos sin guardar (`DELETE …/archivo`).
 */
export interface PermisosObra {
  readonly crear: boolean;
  readonly editar: boolean;
  readonly eliminar: boolean;
}

/** Sin permisos de escritura: valor por defecto de los inputs (todo en solo lectura). */
export const SIN_PERMISOS_OBRA: PermisosObra = { crear: false, editar: false, eliminar: false };

/**
 * `true` si se puede guardar un formulario que da de alta (`esEdicion = false`, exige `crear`) o
 * modifica un registro existente (`esEdicion = true`, exige `editar`).
 */
export function puedeGuardarObra(permisos: PermisosObra, esEdicion: boolean): boolean {
  return esEdicion ? permisos.editar : permisos.crear;
}
