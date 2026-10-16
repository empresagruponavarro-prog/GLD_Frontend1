import { DestroyRef, Service, inject, signal } from '@angular/core';

export type TipoAviso = 'error' | 'aviso' | 'ok';

export interface Aviso {
  texto: string;
  tipo: TipoAviso;
}

/** Tiempo por defecto que permanece un aviso en pantalla. */
export const AVISO_DURACION_MS = 6000;

/**
 * Avisos globales de la aplicación (uno a la vez), pintados en el app shell con `role="alert"`.
 * Los usan el `permisoGuard` (acceso denegado) y el interceptor (403 de permisos); se cierran
 * solos pasado `duracionMs` o con el botón de cerrar.
 */
@Service()
export class AvisosService {
  readonly #aviso = signal<Aviso | null>(null);
  #temporizador: ReturnType<typeof setTimeout> | null = null;

  readonly aviso = this.#aviso.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#cancelar());
  }

  mostrar(texto: string, tipo: TipoAviso = 'error', duracionMs = AVISO_DURACION_MS): void {
    this.#cancelar();
    this.#aviso.set({ texto, tipo });
    if (duracionMs > 0) this.#temporizador = setTimeout(() => this.cerrar(), duracionMs);
  }

  cerrar(): void {
    this.#cancelar();
    this.#aviso.set(null);
  }

  #cancelar(): void {
    if (this.#temporizador !== null) clearTimeout(this.#temporizador);
    this.#temporizador = null;
  }
}
