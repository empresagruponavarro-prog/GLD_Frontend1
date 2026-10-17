import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { estadoDocumentoClass, filtrarDocumentos, iconoCategoriaDocumento } from '../../obra.calc';
import { CATEGORIAS_DOCUMENTO, ESTADOS_DOCUMENTO, ObraDocumento } from '../../obra.interface';
import { valorDeEvento } from '@shared/utils/eventos';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';

@Component({
  selector: 'app-documentos-tab',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './documentos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentosTabComponent {
  readonly documentos = input<readonly ObraDocumento[]>([]);
  /** Mensaje de error (p. ej. falla al descargar un archivo). Vacío = sin aviso. */
  readonly error = input<string>('');
  /** Permisos del módulo `obra`; sin ellos la pestaña queda en solo lectura. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly anexar = output<void>();
  readonly verDetalle = output<ObraDocumento>();
  readonly ver = output<ObraDocumento>();
  readonly descargar = output<ObraDocumento>();
  readonly eliminar = output<ObraDocumento>();

  protected readonly categorias = CATEGORIAS_DOCUMENTO;
  protected readonly estados = ESTADOS_DOCUMENTO;

  protected readonly texto = signal('');
  protected readonly categoria = signal('');
  protected readonly estado = signal('');

  protected readonly filtrados = computed(() =>
    filtrarDocumentos(this.documentos(), {
      texto: this.texto(),
      categoria: this.categoria(),
      estado: this.estado(),
    }),
  );
  protected readonly hayFiltros = computed(() => this.texto().trim() !== '' || this.categoria() !== '' || this.estado() !== '');

  protected readonly icono = iconoCategoriaDocumento;
  protected readonly estadoClass = estadoDocumentoClass;

  protected limpiarFiltros(): void {
    this.texto.set('');
    this.categoria.set('');
    this.estado.set('');
  }

  protected readonly valorDe = valorDeEvento;
}
