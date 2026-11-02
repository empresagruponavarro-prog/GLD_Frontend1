import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalComponent } from './modal';

@Component({
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [isOpen]="true" [showDefaultFooter]="false" (closed)="cerrados.set(cerrados() + 1)">
      <input id="texto" />
      <input id="sugerido" list="lista" />
      <datalist id="lista"><option value="uno"></option></datalist>
      <textarea id="area"></textarea>
      <div modal-footer class="modal-footer">
        <button id="cancelar" class="btn btn-secondary" type="button">Cancelar</button>
        <button id="guardar" class="btn btn-primary" type="button" [disabled]="guardando()" (click)="guardados.set(guardados() + 1)">
          Guardar
        </button>
      </div>
    </app-modal>
  `,
})
class AnfitrionComponent {
  readonly guardados = signal(0);
  readonly cerrados = signal(0);
  readonly guardando = signal(false);
}

describe('ModalComponent: Enter guarda', () => {
  async function montar() {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const enter = (selector: string) => {
      const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      el.querySelector(selector)?.dispatchEvent(evento);
      return evento;
    };
    return { fixture, el, enter };
  }

  it('Enter en un campo pulsa el botón principal del pie', async () => {
    const { fixture, enter } = await montar();
    const evento = enter('#texto');
    expect(fixture.componentInstance.guardados()).toBe(1);
    expect(evento.defaultPrevented).toBe(true);
  });

  it('no actúa en áreas de texto ni en campos con sugerencias', async () => {
    const { fixture, enter } = await montar();
    enter('#area');
    enter('#sugerido');
    expect(fixture.componentInstance.guardados()).toBe(0);
  });

  it('no guarda dos veces mientras el botón está deshabilitado', async () => {
    const { fixture, enter } = await montar();
    fixture.componentInstance.guardando.set(true);
    await fixture.whenStable();
    enter('#texto');
    expect(fixture.componentInstance.guardados()).toBe(0);
  });

  it('Enter sobre un botón no dispara el guardado (el botón hace lo suyo)', async () => {
    const { fixture, enter } = await montar();
    enter('#cancelar');
    expect(fixture.componentInstance.guardados()).toBe(0);
  });
});
