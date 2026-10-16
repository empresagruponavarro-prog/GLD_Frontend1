import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, InjectionToken, Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '@env';
import { Observable, map } from 'rxjs';
import {
  LoginResponse,
  LogoutOptions,
  MotivoLogout,
  SESION_STORAGE_KEY,
  Sesion,
  UsuarioSesion,
  esSesion,
  normalizarSesion,
  sesionVencida,
} from './auth.models';

/** `setTimeout` no admite retardos mayores a 2^31-1 ms (~24,8 días). */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Almacenamiento de la sesión (por defecto `localStorage`). `null` si el navegador lo
 * bloquea; los tests lo sustituyen por uno en memoria.
 */
export const SESION_STORAGE = new InjectionToken<Storage | null>('SESION_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return inject(DOCUMENT).defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  },
});

/**
 * Sesión del usuario: token en `localStorage` (`gld.sesion`) con expiración de 8 h
 * fijada por el backend (`expiraEn`).
 *
 * - Al iniciar restaura la sesión guardada si tiene forma válida y no venció (si no, la borra).
 * - Programa el cierre automático al llegar `expiraEn`.
 * - Sincroniza pestañas con el evento `storage`: cerrar sesión en una la cierra en todas.
 */
@Service()
export class AuthService {
  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);
  readonly #window = inject(DOCUMENT).defaultView;
  readonly #storage = inject(SESION_STORAGE);
  readonly #api = `${environment.apiUrl}/auth`;

  readonly #sesion = signal<Sesion | null>(null);
  #temporizador: ReturnType<typeof setTimeout> | null = null;
  /** La sesión guardada ya había vencido al abrir la app (para avisarlo una vez en el login). */
  #vencidaAlIniciar = false;

  readonly usuario = computed<UsuarioSesion | null>(() => this.#sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this.#sesion() !== null);
  readonly rol = computed<string | null>(() => this.usuario()?.rol ?? null);
  readonly esAdministrador = computed(() => this.rol() === 'Administrador');

  constructor() {
    this.#aplicar(this.#leerAlmacenada(true));

    const onStorage = (e: StorageEvent) => this.#onStorage(e);
    this.#window?.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => {
      this.#window?.removeEventListener('storage', onStorage);
      this.#cancelarTemporizador();
    });
  }

  /** Inicia sesión; guarda la sesión y emite el usuario autenticado. */
  login(usuario: string, clave: string): Observable<UsuarioSesion> {
    return this.#http.post<LoginResponse>(`${this.#api}/login`, { usuario, clave }).pipe(
      map((respuesta) => {
        if (!esSesion(respuesta)) throw new Error('Respuesta de inicio de sesión no válida.');
        const sesion = normalizarSesion(respuesta);
        this.#guardar(sesion);
        this.#aplicar(sesion);
        return sesion.usuario;
      }),
    );
  }

  /** Cierra la sesión (en esta y, vía `storage`, en las demás pestañas). */
  logout({ redirigir = true, motivo = 'manual' }: LogoutOptions = {}): void {
    this.#aplicar(null);
    this.#borrarAlmacenada();
    if (redirigir) this.#irALogin(motivo);
  }

  /** Token vigente o `null`. */
  token(): string | null {
    const sesion = this.#sesion();
    return sesion && !sesionVencida(sesion) ? sesion.token : null;
  }

  /** `true` una sola vez si al abrir la app la sesión guardada ya había vencido. */
  consumirVencidaAlIniciar(): boolean {
    const vencida = this.#vencidaAlIniciar;
    this.#vencidaAlIniciar = false;
    return vencida;
  }

  tieneRol(...roles: string[]): boolean {
    const rol = this.rol();
    return rol !== null && roles.includes(rol);
  }

  /**
   * `true` si hay sesión y no venció. Si venció (p. ej. el equipo estuvo suspendido y el
   * temporizador aún no se disparó) la borra sin navegar y devuelve `false`.
   */
  sesionVigente(): boolean {
    const sesion = this.#sesion();
    if (!sesion) return false;
    if (!sesionVencida(sesion)) return true;
    this.logout({ redirigir: false });
    return false;
  }

  #aplicar(sesion: Sesion | null): void {
    this.#cancelarTemporizador();
    this.#sesion.set(sesion);
    if (!sesion) return;
    const restante = Date.parse(sesion.expiraEn) - Date.now();
    this.#temporizador = setTimeout(
      () => this.#alExpirar(),
      Math.min(Math.max(restante, 0), MAX_TIMEOUT_MS),
    );
  }

  #alExpirar(): void {
    const sesion = this.#sesion();
    if (!sesion) return;
    if (!sesionVencida(sesion)) {
      // Retardo recortado por MAX_TIMEOUT_MS: reprogramar.
      this.#aplicar(sesion);
      return;
    }
    this.logout({ motivo: 'expirada' });
  }

  #cancelarTemporizador(): void {
    if (this.#temporizador !== null) clearTimeout(this.#temporizador);
    this.#temporizador = null;
  }

  #irALogin(motivo: MotivoLogout): void {
    const actual = this.#router.url;
    if (actual.startsWith('/login')) return;
    const queryParams: Record<string, string> = {};
    if (motivo === 'expirada') {
      queryParams['motivo'] = 'expirada';
      if (actual && actual !== '/') queryParams['returnUrl'] = actual;
    } else if (motivo === 'inactivo') {
      queryParams['motivo'] = 'inactivo';
    }
    void this.#router.navigate(['/login'], { queryParams });
  }

  #onStorage(e: StorageEvent): void {
    // `key === null` => localStorage.clear() en otra pestaña.
    if (e.key !== null && e.key !== SESION_STORAGE_KEY) return;
    const nueva = this.#leerAlmacenada();
    if (nueva) {
      this.#aplicar(nueva);
    } else if (this.#sesion()) {
      this.#aplicar(null);
      this.#irALogin('manual');
    }
  }

  #leerAlmacenada(alIniciar = false): Sesion | null {
    let crudo: string | null;
    try {
      crudo = this.#storage?.getItem(SESION_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
    if (crudo === null) return null;
    try {
      const valor: unknown = JSON.parse(crudo);
      if (esSesion(valor)) {
        if (!sesionVencida(valor)) return normalizarSesion(valor);
        if (alIniciar) this.#vencidaAlIniciar = true;
      }
    } catch {
      // JSON corrupto: se borra abajo.
    }
    this.#borrarAlmacenada();
    return null;
  }

  #guardar(sesion: Sesion): void {
    try {
      this.#storage?.setItem(SESION_STORAGE_KEY, JSON.stringify(sesion));
    } catch {
      // Almacenamiento bloqueado: la sesión vive solo en memoria.
    }
  }

  #borrarAlmacenada(): void {
    try {
      this.#storage?.removeItem(SESION_STORAGE_KEY);
    } catch {
      // Ignorado.
    }
  }
}
