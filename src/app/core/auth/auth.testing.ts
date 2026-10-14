import { Provider } from '@angular/core';
import { SESION_STORAGE } from './auth.service';

/**
 * `Storage` en memoria para los specs: con Node >= 25 el `localStorage` global de Node
 * (sin `--localstorage-file`) oculta el de jsdom y queda `undefined`.
 */
export class MemoryStorage implements Storage {
  #datos = new Map<string, string>();

  get length(): number {
    return this.#datos.size;
  }

  clear(): void {
    this.#datos.clear();
  }

  getItem(key: string): string | null {
    return this.#datos.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#datos.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#datos.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#datos.set(key, String(value));
  }
}

export function provideSesionStorage(storage: Storage): Provider {
  return { provide: SESION_STORAGE, useValue: storage };
}
