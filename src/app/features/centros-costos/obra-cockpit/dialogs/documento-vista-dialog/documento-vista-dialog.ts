import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { renderAsync } from 'docx-preview';
import { ModalComponent } from '@shared/components/modal/modal';
import { estadoDocumentoClass, iconoArchivo, iconoCategoriaDocumento, nombreArchivoDocumento } from '../../obra.calc';
import { ObraDocumento } from '../../obra.interface';
import { ObraService } from '../../obra.service';

/** Qué se muestra en el área de vista previa. */
export type TipoVista = 'cargando' | 'pdf' | 'imagen' | 'docx' | 'externo' | 'sin-vista' | 'sin-archivo' | 'error';

const REGEX_HTTP = /^https?:\/\//i;
const TIPO_IMAGEN: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

/**
 * Ventana de vista previa de un documento técnico. Muestra PDF e imágenes dentro del pop-up;
 * el resto de formatos (Word, Excel, PowerPoint, zip) y los enlaces externos ofrecen descargar o abrir.
 * El archivo se pide con `HttpClient`, así que seguirá funcionando cuando se agregue autenticación.
 */
@Component({
  selector: 'app-documento-vista-dialog',
  standalone: true,
  imports: [DatePipe, ModalComponent],
  templateUrl: './documento-vista-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class DocumentoVistaDialogComponent {
  readonly #service = inject(ObraService);
  readonly #sanitizer = inject(DomSanitizer);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly documento = input.required<ObraDocumento>();

  readonly closed = output<void>();

  protected readonly tipo = signal<TipoVista>('cargando');
  protected readonly urlPdf = signal<SafeResourceUrl | null>(null);
  protected readonly urlImagen = signal<string | null>(null);
  /** Error al descargar o abrir (la vista previa en sí muestra su propio estado de error). */
  protected readonly aviso = signal('');
  protected readonly descargando = signal(false);

  protected readonly nombreArchivo = computed(() => nombreArchivoDocumento(this.documento().archivo_url));
  protected readonly archivoInfo = computed(() => iconoArchivo(this.nombreArchivo()));
  protected readonly iconoCategoria = computed(() => iconoCategoriaDocumento(this.documento().categoria));
  protected readonly estadoClase = computed(() => estadoDocumentoClass(this.documento().estado));
  /** El documento tiene un archivo propio (no un enlace) que se puede pedir al servidor. */
  protected readonly tieneArchivoLocal = computed(() => {
    const url = this.documento().archivo_url;
    return !!url && !REGEX_HTTP.test(url);
  });
  protected readonly enlaceExterno = computed(() => {
    const url = this.documento().archivo_url;
    return url && REGEX_HTTP.test(url) ? url : '';
  });

  #peticion?: Subscription;
  #blobUrl: string | null = null;
  #blob: Blob | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#liberar());
    effect(() => {
      const abierto = this.isOpen();
      const d = this.documento();
      untracked(() => {
        this.#liberar();
        if (abierto) this.#cargar(d);
      });
    });
  }

  /** Descarga el archivo; reutiliza el que ya está cargado en la vista previa. */
  protected descargar(): void {
    const d = this.documento();
    if (!d.archivo_url) return;
    this.aviso.set('');
    if (this.#blob) {
      this.#guardar(this.#blob, this.nombreArchivo());
      return;
    }
    if (REGEX_HTTP.test(d.archivo_url)) return;
    this.descargando.set(true);
    this.#service.descargarArchivoDocumento(this.idCentroCosto(), d.id, false).subscribe({
      next: (blob) => {
        this.descargando.set(false);
        this.#guardar(blob, this.nombreArchivo());
      },
      error: () => {
        this.descargando.set(false);
        this.aviso.set('No se pudo descargar el archivo. Inténtalo nuevamente.');
      },
    });
  }

  /** Abre el archivo (o el enlace) en una pestaña nueva. */
  protected abrirEnPestana(): void {
    const enlace = this.enlaceExterno();
    if (enlace) {
      window.open(enlace, '_blank', 'noopener');
      return;
    }
    if (this.#blobUrl) window.open(this.#blobUrl, '_blank');
  }

  protected reintentar(): void {
    this.#liberar();
    this.#cargar(this.documento());
  }

  #cargar(d: ObraDocumento): void {
    this.aviso.set('');
    const archivo = d.archivo_url;
    if (!archivo) {
      this.tipo.set('sin-archivo');
      return;
    }
    if (REGEX_HTTP.test(archivo)) {
      this.tipo.set('externo');
      return;
    }
    const ext = this.archivoInfo().extension.toLowerCase();
    const esPdf = ext === 'pdf';
    const tipoImagen = TIPO_IMAGEN[ext];
    const esDocx = ext === 'docx';
    if (!esPdf && !tipoImagen && !esDocx) {
      this.tipo.set('sin-vista');
      return;
    }

    this.tipo.set('cargando');
    this.#peticion = this.#service.descargarArchivoDocumento(this.idCentroCosto(), d.id, true).subscribe({
      next: (recibido) => {
        // El tipo se fija aquí según la extensión: no se depende de lo que informe el servidor.
        const mimeType = esPdf
          ? 'application/pdf'
          : esDocx
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : tipoImagen;
        const blob = new Blob([recibido], { type: mimeType });
        this.#blob = blob;
        this.#blobUrl = URL.createObjectURL(blob);
        if (esPdf) {
          this.urlPdf.set(this.#sanitizer.bypassSecurityTrustResourceUrl(this.#blobUrl));
          this.tipo.set('pdf');
        } else if (tipoImagen) {
          this.urlImagen.set(this.#blobUrl);
          this.tipo.set('imagen');
        } else if (esDocx) {
          this.tipo.set('docx');
          setTimeout(() => this.#renderizarDocx(blob), 50);
        }
      },
      error: () => this.tipo.set('error'),
    });
  }

  #renderizarDocx(blob: Blob): void {
    const contenedor = document.getElementById('docx-preview-container');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    renderAsync(blob, contenedor, undefined, {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      useBase64URL: true,
    }).catch((err) => {
      console.error('Error renderizando archivo DOCX con docx-preview', err);
      this.tipo.set('error');
    });
  }

  #guardar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  #liberar(): void {
    this.#peticion?.unsubscribe();
    this.#peticion = undefined;
    if (this.#blobUrl) URL.revokeObjectURL(this.#blobUrl);
    this.#blobUrl = null;
    this.#blob = null;
    // Estado neutro ANTES de vaciar las URL: así el iframe/img deja de renderizarse y no queda
    // enlazado a un valor nulo (Angular lanza NG0904 con un recurso sin confiar).
    this.tipo.set('cargando');
    this.urlPdf.set(null);
    this.urlImagen.set(null);
  }
}
