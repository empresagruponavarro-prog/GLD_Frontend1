import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env';
import { catchError, throwError } from 'rxjs';
import { codigoDelBackend } from '@shared/utils/errores-http';
import { AvisosService } from '../avisos/avisos.service';
import { CODIGO_USUARIO_INACTIVO } from './auth.models';
import { AuthService } from './auth.service';
import { PermisosService } from './permisos.service';

const API = environment.apiUrl.replace(/\/+$/, '');
const LOGIN_URL = `${API}/auth/login`;
const MIS_PERMISOS_URL = `${API}/auth/mis-permisos`;

export const MSG_SIN_PERMISO = 'No tienes permiso para esta acción';

/** `true` solo para URLs del API (mismo origen y prefijo exacto, no `…:3000.evil.com`). */
export function esUrlDelApi(url: string): boolean {
  return url === API || url.startsWith(`${API}/`) || url.startsWith(`${API}?`);
}

function sinQuery(url: string): string {
  return url.split(/[?#]/, 1)[0].replace(/\/+$/, '');
}

function esLogin(url: string): boolean {
  return sinQuery(url) === LOGIN_URL;
}

function esMisPermisos(url: string): boolean {
  return sinQuery(url) === MIS_PERMISOS_URL;
}

/**
 * Añade `Authorization: Bearer <token>` a las peticiones del API (nunca a otros dominios)
 * y ante un `401` del API (salvo `/auth/login`) cierra la sesión y lleva a `/login`
 * con `returnUrl` y el aviso de sesión expirada. Un `403` con `codigo: 'USUARIO_INACTIVO'`
 * (usuario desactivado con la sesión abierta) cierra la sesión y lleva a `/login?motivo=inactivo`.
 * Cualquier otro `403` (falta de permiso) muestra el aviso global "No tienes permiso para esta
 * acción" y recarga los permisos de la sesión; el error se propaga para que la pantalla lo trate.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!esUrlDelApi(req.url)) return next(req);

  const auth = inject(AuthService);
  const avisos = inject(AvisosService);
  const permisos = inject(PermisosService);
  const token = auth.token();
  const peticion = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !esLogin(req.url)) {
        if (error.status === 401) {
          auth.logout({ redirigir: true, motivo: 'expirada' });
        } else if (esUsuarioInactivo(error)) {
          auth.logout({ redirigir: true, motivo: 'inactivo' });
        } else if (error.status === 403 && !esMisPermisos(req.url)) {
          avisos.mostrar(MSG_SIN_PERMISO);
          void permisos.recargar();
        }
      }
      return throwError(() => error);
    }),
  );
};

/** 403 del backend porque el usuario está desactivado (en el login o con la sesión abierta). */
export function esUsuarioInactivo(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 403 &&
    codigoDelBackend(error) === CODIGO_USUARIO_INACTIVO
  );
}
