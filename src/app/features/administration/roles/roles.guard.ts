import { CanDeactivateFn } from '@angular/router';

/** Lo que el guard necesita de la pantalla de roles (la implementa `RolesComponent`). */
export interface PantallaConCambiosPendientes {
  /** `true` si hay cambios de la matriz sin guardar. */
  tieneCambiosPendientes(): boolean;
  /**
   * Muestra la confirmación en pantalla (Guardar / Descartar / Cancelar) y resuelve `true`
   * si se puede salir (guardado correcto o descarte) o `false` si se cancela o el guardado falla.
   */
  confirmarSalida(): Promise<boolean>;
}

/**
 * `canDeactivate` de `/admin/roles`: con cambios sin guardar en la matriz pide confirmación
 * dentro de la pantalla (sin `confirm()`) antes de abandonar la ruta.
 */
export const rolesPendientesGuard: CanDeactivateFn<PantallaConCambiosPendientes> = (component) => {
  if (!component.tieneCambiosPendientes()) return true;
  return component.confirmarSalida();
};
