import { Signal, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { moduloDeSnapshot } from './permiso.guard';
import { Accion, ClaveModulo } from './permisos.models';
import { PermisosService } from './permisos.service';

/** Acciones de escritura que condicionan los botones de una pantalla (plan 05, etapa D). */
export type AccionPantalla = Exclude<Accion, 'ver'>;

/** Una signal por acción: `true` si el usuario puede ejecutarla en el módulo de la pantalla. */
export type PermisosPantalla = Readonly<Record<AccionPantalla, Signal<boolean>>>;

/**
 * Permisos de escritura de una pantalla, para ocultar con `@if` los botones de acciones no
 * permitidas. Se llama en un contexto de inyección (inicializador de campo o constructor):
 *
 * ```ts
 * protected readonly permisos = permisosDePantalla('almacen.almacenes');
 * // plantilla: @if (permisos.crear()) { <button>+ Nuevo</button> }
 * ```
 *
 * - `clave`: módulo cuyos permisos se consultan. Si se omite, el `data.modulo` de la ruta activa
 *   (o de la más cercana en su jerarquía); sin módulo en la ruta, todo `false`.
 * - Reacciona a los cambios de permisos (carga, recarga, cierre de sesión): son `computed` sobre
 *   las signals de {@link PermisosService}. Administrador → todo `true`.
 * - La acción que exige cada botón es la del backend (plan 05, anexo §7.3), no la del verbo.
 */
export function permisosDePantalla(clave?: ClaveModulo): PermisosPantalla {
  const permisos = inject(PermisosService);
  const modulo = clave ?? moduloDeRutaActiva();
  const de = (accion: AccionPantalla): Signal<boolean> =>
    computed(() => modulo !== null && permisos.puede(modulo, accion));
  return {
    crear: de('crear'),
    editar: de('editar'),
    eliminar: de('eliminar'),
    aprobar: de('aprobar'),
    anular: de('anular'),
  };
}

function moduloDeRutaActiva(): ClaveModulo | null {
  const ruta = inject(ActivatedRoute, { optional: true });
  return ruta ? moduloDeSnapshot(ruta.snapshot) : null;
}
