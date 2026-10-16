/**
 * Helpers tipados para leer eventos del DOM en las plantillas sin `$any()` ni `as`.
 * Uso: `protected readonly valorDe = valorDeEvento;` y en la plantilla
 * `(input)="onSearch(valorDe($event))"`.
 */

/** Valor de un `<input>`, `<select>` o `<textarea>` que dispara el evento (`''` si no es uno de ellos). */
export function valorDeEvento(event: Event): string {
  const t = event.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) {
    return t.value;
  }
  return '';
}

/** `checked` del `<input type="checkbox">` que dispara el evento (`false` si no es un input). */
export function marcadoDeEvento(event: Event): boolean {
  const t = event.target;
  return t instanceof HTMLInputElement ? t.checked : false;
}

/** `valor` si pertenece a `opciones` (lista `as const`); si no, `null`. */
export function opcionValida<T extends string>(opciones: readonly T[], valor: string): T | null {
  return opciones.find((o) => o === valor) ?? null;
}
