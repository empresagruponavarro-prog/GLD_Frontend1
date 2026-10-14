import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { returnUrlSeguro } from './auth.models';
import { AuthService } from './auth.service';

type Guard = CanActivateFn & CanActivateChildFn;

/** Exige sesión vigente; si no, `/login?returnUrl=…` (y `motivo=expirada` si acaba de vencer). */
export const authGuard: Guard = (_route, state) => {
  const auth = inject(AuthService);
  const habiaSesion = auth.autenticado() || auth.consumirVencidaAlIniciar();
  if (auth.sesionVigente()) return true;

  const queryParams: Record<string, string> = {};
  const returnUrl = returnUrlSeguro(state.url);
  if (returnUrl !== '/') queryParams['returnUrl'] = returnUrl;
  if (habiaSesion) queryParams['motivo'] = 'expirada';
  return inject(Router).createUrlTree(['/login'], { queryParams });
};

/** Solo para invitados (pantalla de login): con sesión, va al `returnUrl` validado o a `/`. */
export const invitadoGuard: CanActivateFn = (route) => {
  if (!inject(AuthService).sesionVigente()) return true;
  return inject(Router).parseUrl(returnUrlSeguro(route.queryParamMap.get('returnUrl')));
};

/** Exige alguno de los roles; si no, redirige a `/` sin mostrar la pantalla. */
export function rolGuard(...roles: string[]): Guard {
  return () => {
    const auth = inject(AuthService);
    if (auth.sesionVigente() && auth.tieneRol(...roles)) return true;
    return inject(Router).parseUrl('/');
  };
}
