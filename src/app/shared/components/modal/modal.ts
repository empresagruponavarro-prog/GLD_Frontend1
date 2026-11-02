import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class ModalComponent {
  isOpen = input<boolean>(false);
  title = input<string>('');
  icon = input<string>('fa-solid fa-pen-to-square');
  showHeader = input<boolean>(true);
  maxWidth = input<string>('600px');
  height = input<string>('auto');
  showDefaultFooter = input<boolean>(true);
  submitText = input<string>('Guardar');
  cancelText = input<string>('Cancelar');
  submitIcon = input<string>('fa-solid fa-floppy-disk');
  loading = input<boolean>(false);

  closed = output<void>();
  saved = output<void>();

  onClose(): void {
    this.closed.emit();
  }

  onSave(): void {
    this.saved.emit();
  }

  /**
   * Enter dentro de un campo del pop-up equivale a pulsar su botón principal (Guardar). Los formularios del
   * sistema llevan el botón en el pie, fuera del `<form>`, así que el navegador no envía el formulario solo.
   * No actúa sobre áreas de texto, botones, enlaces, listas desplegables ni campos con sugerencias (`list`),
   * donde Enter tiene su propio significado, ni mientras el botón está deshabilitado (guardando).
   */
  onEnter(event: Event): void {
    if (!(event instanceof KeyboardEvent) || event.isComposing) return;
    const campo = event.target;
    if (!(campo instanceof HTMLInputElement)) return;
    if (campo.list !== null || ['button', 'submit', 'checkbox', 'radio', 'file'].includes(campo.type)) return;
    const contenido = event.currentTarget;
    if (!(contenido instanceof HTMLElement)) return;
    const principales = contenido.querySelectorAll<HTMLButtonElement>('.modal-footer .btn-primary');
    const guardar = principales[principales.length - 1];
    if (!guardar || guardar.disabled) return;
    event.preventDefault();
    guardar.click();
  }
}
