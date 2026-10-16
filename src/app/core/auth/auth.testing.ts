import { EnvironmentProviders, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '@env';
import { SESION_STORAGE_KEY, Sesion } from './auth.models';
import { SESION_STORAGE } from './auth.service';
import { ClaveModulo, MisPermisos, Permisos, SIN_PERMISOS, esClaveModulo } from './permisos.models';
import { PermisosService } from './permisos.service';

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

export const MIS_PERMISOS_URL = `${environment.apiUrl}/auth/mis-permisos`;

/** Guarda en `storage` una sesión vigente del rol indicado (token distinto por usuario). */
export function guardarSesion(storage: Storage, rol: string, usuario = 'u1', expiraEnMs = 3600_000): Sesion {
  const sesion: Sesion = {
    token: `tok-${usuario}`,
    expiraEn: new Date(Date.now() + expiraEnMs).toISOString(),
    usuario: { id: 'U1', usuario, nombres: null, rol },
  };
  storage.setItem(SESION_STORAGE_KEY, JSON.stringify(sesion));
  return sesion;
}

/** Respuesta de `GET /auth/mis-permisos` con `ver` (o las acciones indicadas) en los módulos dados. */
export function misPermisos(
  rol: string,
  modulos: Partial<Record<ClaveModulo, Partial<Permisos>>> = {},
  esAdministrador = false,
): MisPermisos {
  const permisos: Partial<Record<ClaveModulo, Permisos>> = {};
  for (const [clave, acciones] of Object.entries(modulos)) {
    if (esClaveModulo(clave)) permisos[clave] = { ...SIN_PERMISOS, ver: true, ...acciones };
  }
  return { rol, esAdministrador, permisos };
}

/** Proveedores comunes de los specs de pantalla: HTTP de pruebas, router vacío y sesión en `storage`. */
export function providersPantalla(storage: Storage): (Provider | EnvironmentProviders)[] {
  return [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSesionStorage(storage)];
}

/**
 * Carga en `PermisosService` la respuesta de `GET /auth/mis-permisos`. Requiere una sesión guardada
 * con {@link guardarSesion} y `HttpTestingController` (p. ej. con {@link providersPantalla}).
 */
export async function cargarPermisos(respuesta: MisPermisos): Promise<void> {
  const carga = TestBed.inject(PermisosService).recargar();
  TestBed.inject(HttpTestingController).expectOne(MIS_PERMISOS_URL).flush(respuesta);
  await carga;
}
