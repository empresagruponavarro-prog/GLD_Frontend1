import { Type } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermisosObra, SIN_PERMISOS_OBRA } from './obra-permisos';

/** Todas las acciones de escritura del módulo `obra`. */
export const TODOS_PERMISOS_OBRA: PermisosObra = { crear: true, editar: true, eliminar: true };

/** Permisos de `obra` con solo las acciones indicadas (`{}` = solo ver). */
export function permisosObra(acciones: Partial<PermisosObra> = {}): PermisosObra {
  return { ...SIN_PERMISOS_OBRA, ...acciones };
}

export interface Montado<T> {
  fixture: ComponentFixture<T>;
  el: HTMLElement;
  http: HttpTestingController;
  render: () => Promise<void>;
}

/**
 * Monta una pestaña o diálogo del cockpit con los `inputs` dados (HTTP de pruebas, sin router) y lo
 * renderiza. Las peticiones que haga quedan pendientes en `http`. Reinicia el TestBed, así que se
 * puede llamar varias veces en un mismo test (cada llamada descarta el montaje anterior).
 */
export async function montar<T>(componente: Type<T>, inputs: Readonly<Record<string, unknown>>): Promise<Montado<T>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [componente],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(componente);
  for (const [nombre, valor] of Object.entries(inputs)) fixture.componentRef.setInput(nombre, valor);
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await render();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el, http: TestBed.inject(HttpTestingController), render };
}

/** Campos del formulario (`input` visibles, `select`, `textarea`) que el usuario puede modificar. */
export function camposEditables(el: HTMLElement): (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[] {
  return Array.from(el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('form input, form select, form textarea')).filter(
    (c) => !c.disabled && !(c instanceof HTMLInputElement && (c.type === 'file' || c.type === 'hidden')),
  );
}

/** Cantidad de campos del formulario (sin `file`/`hidden`), editables o no. */
export function totalCampos(el: HTMLElement): number {
  return Array.from(el.querySelectorAll('form input, form select, form textarea')).filter(
    (c) => !(c instanceof HTMLInputElement && (c.type === 'file' || c.type === 'hidden')),
  ).length;
}
