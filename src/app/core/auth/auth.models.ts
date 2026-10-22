/**
 * Único rol fijo: el de sistema, que no se puede renombrar ni eliminar. El resto del catálogo
 * se administra en `/admin/roles` y se lee del backend (`GET /administration/roles`).
 */
export const ROL_ADMINISTRADOR = 'Administrador';

/** Área del usuario en sesión (plan 08): decide qué módulos y datos ve. */
export interface AreaSesion {
  id: number;
  codigo: string;
  nombre: string;
}

/** Usuario autenticado tal como lo devuelven `POST /auth/login` y `GET /auth/me`. */
export interface UsuarioSesion {
  id: string;
  usuario: string;
  nombres: string | null;
  rol: string;
  /** `null` o ausente = sin área (alcance global). */
  area?: AreaSesion | null;
}

/** Sesión persistida en `localStorage` (clave {@link SESION_STORAGE_KEY}). */
export interface Sesion {
  token: string;
  /** Fecha ISO en la que vence el token. */
  expiraEn: string;
  usuario: UsuarioSesion;
}

export type LoginResponse = Sesion;

export type MotivoLogout = 'expirada' | 'inactivo' | 'manual';

export interface LogoutOptions {
  /** Navega a `/login` (por defecto `true`). */
  redirigir?: boolean;
  /**
   * `expirada` añade el aviso en la pantalla de login y conserva la ruta actual en `returnUrl`;
   * `inactivo` muestra el aviso de usuario desactivado (sin `returnUrl`).
   */
  motivo?: MotivoLogout;
}

/** `codigo` del 403 que devuelve el backend cuando el usuario de la sesión (o del login) está desactivado. */
export const CODIGO_USUARIO_INACTIVO = 'USUARIO_INACTIVO';

export const MSG_USUARIO_INACTIVO = 'Tu usuario está desactivado. Contacta al administrador';

export const SESION_STORAGE_KEY = 'gld.sesion';

function esAreaSesion(v: unknown): v is AreaSesion {
  if (!v || typeof v !== 'object') return false;
  const a = v as Record<string, unknown>;
  return typeof a['id'] === 'number' && typeof a['codigo'] === 'string' && typeof a['nombre'] === 'string';
}

function esUsuarioSesion(v: unknown): v is UsuarioSesion {
  if (!v || typeof v !== 'object') return false;
  const u = v as Record<string, unknown>;
  return (
    (typeof u['id'] === 'string' || typeof u['id'] === 'number') &&
    typeof u['usuario'] === 'string' &&
    u['usuario'].length > 0 &&
    (u['nombres'] === null || u['nombres'] === undefined || typeof u['nombres'] === 'string') &&
    typeof u['rol'] === 'string' &&
    (u['area'] === null || u['area'] === undefined || esAreaSesion(u['area']))
  );
}

/** Valida la forma de una sesión (la de `localStorage` o la respuesta del login). */
export function esSesion(v: unknown): v is Sesion {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s['token'] === 'string' &&
    s['token'].length > 0 &&
    typeof s['expiraEn'] === 'string' &&
    !Number.isNaN(Date.parse(s['expiraEn'])) &&
    esUsuarioSesion(s['usuario'])
  );
}

/** Normaliza la sesión (id como texto, `nombres` y `area` ausentes como `null`). */
export function normalizarSesion(s: Sesion): Sesion {
  return {
    token: s.token,
    expiraEn: s.expiraEn,
    usuario: {
      id: String(s.usuario.id),
      usuario: s.usuario.usuario,
      nombres: s.usuario.nombres ?? null,
      rol: s.usuario.rol,
      area: s.usuario.area ?? null,
    },
  };
}

export function sesionVencida(s: Sesion, ahora = Date.now()): boolean {
  return Date.parse(s.expiraEn) <= ahora;
}

/**
 * Devuelve `valor` solo si es una ruta interna segura para redirigir tras el login;
 * si no, `/`. Evita open redirects: rechaza `//host`, `/\host`, esquemas (`http:`,
 * `javascript:`), caracteres de control y la propia pantalla de login.
 */
export function returnUrlSeguro(valor: unknown): string {
  if (typeof valor !== 'string') return '/';
  const url = valor.trim();
  if (!url.startsWith('/')) return '/';
  if (url.startsWith('//') || url.includes('\\')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(url)) return '/';
  if (url === '/login' || url.startsWith('/login?') || url.startsWith('/login/') || url.startsWith('/login#')) return '/';
  return url;
}
