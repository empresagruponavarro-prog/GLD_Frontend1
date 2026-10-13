import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ModalComponent } from '@shared/components/modal/modal';
import { nombreArchivoDocumento } from '../../obra.calc';
import { ObraDocumento } from '../../obra.interface';

const REGEX_HTTP = /^https?:\/\//i;

/**
 * Confirmación para eliminar un documento técnico. No hace la petición: avisa con `confirmed` y el
 * contenedor elimina, muestra el progreso con `eliminando` y el fallo con `error`.
 */
@Component({
  selector: 'app-documento-eliminar-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './documento-eliminar-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancelar()' },
})
export class DocumentoEliminarDialogComponent {
  readonly isOpen = input(false);
  readonly documento = input.required<ObraDocumento>();
  /** Hay una eliminación en curso: se bloquean los botones y no se puede cerrar. */
  readonly eliminando = input(false);
  /** Mensaje si la eliminación falló. Vacío = sin error. */
  readonly error = input('');

  readonly cancelled = output<void>();
  readonly confirmed = output<void>();

  /** El documento tiene un archivo propio en el servidor, que se borra junto con él. */
  protected readonly archivoLocal = computed(() => {
    const url = this.documento().archivo_url;
    return !!url && !REGEX_HTTP.test(url);
  });
  protected readonly nombreArchivo = computed(() => nombreArchivoDocumento(this.documento().archivo_url));

  protected cancelar(): void {
    if (!this.eliminando()) this.cancelled.emit();
  }

  protected confirmar(): void {
    if (!this.eliminando()) this.confirmed.emit();
  }
}
