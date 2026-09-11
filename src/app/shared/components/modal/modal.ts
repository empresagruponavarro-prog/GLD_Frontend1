import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.html',
})
export class ModalComponent {
  isOpen = input<boolean>(false);
  title = input<string>('');
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
}
