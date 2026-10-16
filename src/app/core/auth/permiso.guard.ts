import { Type, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn, Route, Router, Routes } from '@angular/router';
import { AvisosService } from '../avisos/avisos.service';
import { AuthService } from './auth.service';
import { ClaveModulo, esClaveModulo } from './permisos.models';
import { PermisosService } from './permisos.service';

/** `data` tipado de una ruta de pantalla: el módulo cuyo permiso `ver` exige. */
export interface DatosRuta {
  modulo: ClaveModulo;
}

export const MSG_ACCESO_DENEGADO = 'No tienes acceso a este módulo';
export const MSG_PERMISOS_NO_CARGADOS = 'No se pudieron cargar tus permisos. Vuelve a intentarlo.';

/** Ruta de pantalla con su módulo (`data.modulo`) y, opcionalmente, otros datos. */
export function rutaModulo(
  path: string,
  component: Type<unknown>,
  modulo: ClaveModulo,
  datos: Record<string, string> = {},
): Route {
  const data: DatosRuta & Record<string, string> = { ...datos, modulo };
  return { path, component, data };
}

/**
 * Ruta de pantalla SIN módulo: solo exige sesión (inicio, impresiones). Admite otros datos
 * (`data.tipo`…) pero nunca `modulo`.
 */
export function rutaSesion(path: string, component: Type<unknown>, datos: Record<string, string> = {}): Route {
  const data = Object.fromEntries(Object.entries(datos).filter(([clave]) => clave !== 'modulo'));
  return { path, component, data };
}

/** `modulo` del `data` de una ruta si es una clave válida. */
export function moduloDeRuta(ruta: { data?: Route['data'] } | null | undefined): ClaveModulo | null {
  const modulo: unknown = ruta?.data?.['modulo'];
  return typeof modulo === 'string' && esClaveModulo(modulo) ? modulo : null;
}

/** Módulo de la ruta activada o, si no lo declara, de la más cercana en su jerarquía. */
export function moduloDeSnapshot(route: ActivatedRouteSnapshot): ClaveModulo | null {
  for (const r of [...route.pathFromRoot].reverse()) {
    const modulo = moduloDeRuta(r);
    if (modulo) return modulo;
  }
  return null;
}

function segmentosDe(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0);
}

function coincide(path: string, segmentos: readonly string[]): boolean {
  const patron = segmentosDe(path);
  if (patron.length !== segmentos.length) return false;
  return patron.every((p, i) => p.startsWith(':') || p === segmentos[i]);
}

function buscarModulo(rutas: Routes, segmentos: readonly string[], heredado: ClaveModulo | null): ClaveModulo | null {
  for (const ruta of rutas) {
    const propio = moduloDeRuta(ruta) ?? heredado;
    const path = ruta.path ?? '';
    if (ruta.children) {
      const prefijo = segmentosDe(path);
      const encaja = prefijo.every((p, i) => p.startsWith(':') || p === segmentos[i]);
      if (!encaja) continue;
      const hallado = buscarModulo(ruta.children, segmentos.slice(prefijo.length), propio);
      if (hallado) return hallado;
      continue;
    }
    if (path === '**') continue;
    if (coincide(path, segmentos)) return propio;
  }
  return null;
}

/**
 * Módulo (`data.modulo`) que exige una URL interna según la configuración de rutas, o `null`
 * si la URL no corresponde a una pantalla con módulo (inicio, login, 404…). Se usa para no
 * redirigir tras el login a una pantalla sin permiso de `ver`.
 */
export function moduloDeUrl(rutas: Routes, url: string): ClaveModulo | null {
  const limpia = url.split(/[?#]/, 1)[0];
  return buscarModulo(rutas, segmentosDe(limpia), null);
}

/**
 * Exige el permiso `ver` del módulo declarado en `data.modulo` de la ruta (o de la más cercana
 * con módulo en la jerarquía). Espera a que `PermisosService` esté cargado, así al recargar la
 * página no hay redirecciones falsas. Sin `ver` → inicio con el aviso "No tienes acceso a este
 * módulo". Las rutas sin `modulo` solo exigen sesión (eso lo hace `authGuard`).
 */
export const permisoGuard: CanActivateFn & CanActivateChildFn = async (route) => {
  const modulo = moduloDeSnapshot(route);
  if (!modulo) return true;

  // Todo se inyecta antes del `await`: después ya no hay contexto de inyección.
  const auth = inject(AuthService);
  const permisos = inject(PermisosService);
  const avisos = inject(AvisosService);
  const router = inject(Router);
  if (!auth.sesionVigente()) return true; // authGuard ya redirige a /login.

  await permisos.listo();
  if (permisos.puedeVer(modulo)) return true;

  avisos.mostrar(permisos.cargado() ? MSG_ACCESO_DENEGADO : MSG_PERMISOS_NO_CARGADOS);
  return router.parseUrl('/');
};
