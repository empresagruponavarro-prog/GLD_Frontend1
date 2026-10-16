import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { environment } from '@env';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ACCIONES, Accion, ClaveModulo, MisPermisos, Permisos, SIN_PERMISOS, esClaveModulo } from './permisos.models';

/** Permisos ya cargados, ligados al token con el que se pidieron. */
interface PermisosCargados {
  token: string;
  datos: MisPermisos;
}

/** Carga en curso (una sola por token, compartida entre el guard, el login y el interceptor). */
interface CargaEnCurso {
  token: string;
  promesa: Promise<MisPermisos | null>;
}

function esPermisos(v: unknown): v is Permisos {
  if (!v || typeof v !== 'object') return false;
  const p: Record<string, unknown> = { ...v };
  return ACCIONES.every((a) => typeof p[a] === 'boolean');
}

/** Valida y normaliza la respuesta de `GET /auth/mis-permisos` (ignora claves desconocidas). */
export function normalizarMisPermisos(v: unknown): MisPermisos | null {
  if (!v || typeof v !== 'object') return null;
  const r: Record<string, unknown> = { ...v };
  const rol = r['rol'];
  const esAdministrador = r['esAdministrador'];
  const crudos = r['permisos'];
  if (typeof rol !== 'string' || typeof esAdministrador !== 'boolean') return null;
  if (!crudos || typeof crudos !== 'object') return null;
  const permisos: Partial<Record<ClaveModulo, Permisos>> = {};
  for (const [clave, valor] of Object.entries(crudos)) {
    if (esClaveModulo(clave) && esPermisos(valor)) permisos[clave] = { ...valor };
  }
  return { rol, esAdministrador, permisos };
}

/**
 * Permisos del usuario de la sesión (`GET /auth/mis-permisos`, plan 05 §8.2).
 *
 * - Se cargan una vez por sesión: la primera vez que alguien llama a {@link listo} o
 *   {@link recargar} (el `permisoGuard` al navegar, el login al entrar, el interceptor ante un 403).
 * - Quedan ligados al token con el que se pidieron: al cerrar sesión (o cambiar de usuario)
 *   dejan de ser válidos y `puede()` devuelve `false` hasta que se carguen los nuevos.
 * - Administrador → siempre `true`. Sin datos (aún cargando o fallo de carga) → `false`.
 */
@Service()
export class PermisosService {
  readonly #http = inject(HttpClient);
  readonly #auth = inject(AuthService);
  readonly #url = `${environment.apiUrl}/auth/mis-permisos`;

  readonly #cargados = signal<PermisosCargados | null>(null);
  readonly #cargando = signal(false);
  #enCurso: CargaEnCurso | null = null;

  /** Permisos válidos para la sesión actual (o `null` si no hay sesión o aún no se cargaron). */
  readonly #vigentes = computed<MisPermisos | null>(() => {
    const cargados = this.#cargados();
    const token = this.#auth.token();
    return cargados && token && cargados.token === token ? cargados.datos : null;
  });

  readonly cargando = this.#cargando.asReadonly();
  readonly cargado = computed(() => this.#vigentes() !== null);
  readonly esAdministrador = computed(() => this.#vigentes()?.esAdministrador ?? false);
  readonly rol = computed<string | null>(() => this.#vigentes()?.rol ?? null);

  /** `true` si el usuario puede ejecutar `accion` en el módulo `clave`. */
  puede(clave: ClaveModulo, accion: Accion): boolean {
    const vigentes = this.#vigentes();
    if (!vigentes) return false;
    if (vigentes.esAdministrador) return true;
    return (vigentes.permisos[clave] ?? SIN_PERMISOS)[accion];
  }

  puedeVer(clave: ClaveModulo): boolean {
    return this.puede(clave, 'ver');
  }

  /**
   * Promesa que se resuelve cuando los permisos de la sesión actual están cargados (o se
   * intentó cargarlos y falló: entonces `cargado()` sigue en `false`). Sin sesión se resuelve
   * de inmediato. Reutiliza la carga en curso, así varias llamadas simultáneas (guard, login)
   * no disparan varias peticiones.
   */
  listo(): Promise<void> {
    if (this.#vigentes()) return Promise.resolve();
    const token = this.#auth.token();
    if (!token) return Promise.resolve();
    if (this.#enCurso?.token === token) return this.#enCurso.promesa.then(() => undefined);
    return this.recargar().then(() => undefined);
  }

  /**
   * Vuelve a pedir los permisos al backend (tras guardar la matriz del propio rol o ante un 403).
   * Devuelve los permisos o `null` si no hay sesión o la petición falló; nunca rechaza.
   */
  recargar(): Promise<MisPermisos | null> {
    const token = this.#auth.token();
    if (!token) {
      this.vaciar();
      return Promise.resolve(null);
    }
    if (this.#enCurso?.token === token) return this.#enCurso.promesa;

    this.#cargando.set(true);
    const promesa = firstValueFrom(this.#http.get<unknown>(this.#url)).then(
      (respuesta) => {
        const datos = normalizarMisPermisos(respuesta);
        // Solo se aplican si la sesión sigue siendo la misma con la que se pidieron.
        if (datos && this.#auth.token() === token) this.#cargados.set({ token, datos });
        return datos;
      },
      () => null,
    );
    const carga: CargaEnCurso = { token, promesa };
    this.#enCurso = carga;
    return promesa.finally(() => {
      if (this.#enCurso === carga) {
        this.#enCurso = null;
        this.#cargando.set(false);
      }
    });
  }

  /** Olvida los permisos cargados (al cerrar sesión). */
  vaciar(): void {
    this.#cargados.set(null);
  }
}
