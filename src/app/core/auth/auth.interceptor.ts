import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const API = environment.apiUrl.replace(/\/+$/, '');
const LOGIN_URL = `${API}/auth/login`;

/** `true` solo para URLs del API (mismo origen y prefijo exacto, no `…:3000.evil.com`). */
export function esUrlDelApi(url: string): boolean {
  return url === API || url.startsWith(`${API}/`) || url.startsWith(`${API}?`);
}

function esLogin(url: string): boolean {
  return url.split(/[?#]/, 1)[0].replace(/\/+$/, '') === LOGIN_URL;
}

/**
 * Añade `Authorization: Bearer <token>` a las peticiones del API (nunca a otros dominios)
 * y ante un `401` del API (salvo `/auth/login`) cierra la sesión y lleva a `/login`
 * con `returnUrl` y el aviso de sesión expirada.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!esUrlDelApi(req.url)) return next(req);

  const auth = inject(AuthService);
  const token = auth.token();
  const peticion = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !esLogin(req.url)) {
        auth.logout({ redirigir: true, motivo: 'expirada' });
      }
      return throwError(() => error);
    }),
  );
};
