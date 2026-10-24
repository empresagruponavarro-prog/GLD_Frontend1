import { EnvironmentProviders, Provider, Type } from '@angular/core';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemoryStorage, cargarPermisos, guardarSesion, providersPantalla } from './auth.testing';
import { MisPermisos } from './permisos.models';

/** Cuerpo con el que se responde una petición en los specs de pantalla. */
export type CuerpoRespuesta = object | string | number | boolean | null;

/** Decide la respuesta de cada petición que hace la pantalla al cargarse (por URL/método). */
export type Responder = (req: HttpRequest<unknown>) => CuerpoRespuesta;

export interface Pantalla<T> {
  fixture: ComponentFixture<T>;
  cmp: T;
  el: HTMLElement;
  http: HttpTestingController;
  render: () => Promise<void>;
}

/**
 * Monta una pantalla con una sesión del rol de `permisos`, carga sus permisos
 * (`GET /auth/mis-permisos`) y responde con `responder` todas las peticiones que haga al cargarse
 * (también las encadenadas). Sirve para comprobar qué botones aparecen según la matriz.
 */
export async function montarPantalla<T>(
  componente: Type<T>,
  permisos: MisPermisos,
  responder: Responder,
  providers: (Provider | EnvironmentProviders)[] = [],
  /** Valores de los `input()` del componente (los que no son opcionales deben ir aquí). */
  entradas: Readonly<Record<string, unknown>> = {},
): Promise<Pantalla<T>> {
  const storage = new MemoryStorage();
  guardarSesion(storage, permisos.rol);
  TestBed.configureTestingModule({
    imports: [componente],
    providers: [...providersPantalla(storage), ...providers],
  });
  const fixture = TestBed.createComponent(componente);
  for (const [nombre, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nombre, valor);
  await cargarPermisos(permisos);
  const http = TestBed.inject(HttpTestingController);
  const render = () => fixture.whenStable();
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    await render();
    const pendientes = http.match(() => true);
    if (pendientes.length === 0) break;
    for (const req of pendientes) req.flush(responder(req.request));
  }
  await render();
  return { fixture, cmp: fixture.componentInstance, el: fixture.nativeElement, http, render };
}

/** Responde `[]` a todo (pantallas que se cargan con listas vacías). */
export const responderVacio: Responder = () => [];

/** Texto visible, `title` y `aria-label` de un botón o enlace, en minúsculas. */
function etiquetas(e: Element): string {
  return [e.textContent ?? '', e.getAttribute('title') ?? '', e.getAttribute('aria-label') ?? '']
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** `true` si hay algún botón o enlace cuyo texto, `title` o `aria-label` contiene `texto`. */
export function hayBoton(el: HTMLElement, texto: string): boolean {
  const buscado = texto.toLowerCase();
  return Array.from(el.querySelectorAll('button, a')).some((b) => etiquetas(b).includes(buscado));
}

/** Para cada clave, si hay un botón o enlace que contenga su texto: `{ nuevo: 'Nuevo' }` → `{ nuevo: true }`. */
export function botonesVisibles(el: HTMLElement, textos: Readonly<Record<string, string>>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(textos).map(([clave, texto]) => [clave, hayBoton(el, texto)]));
}
