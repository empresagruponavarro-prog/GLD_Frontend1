import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalComponent } from '@shared/components/modal/modal';
import { estadoPlanoClass } from '../../obra.calc';
import { ObraPlano } from '../../obra.interface';
import { ObraService } from '../../obra.service';

@Component({
  selector: 'app-plano-visor-dialog',
  standalone: true,
  imports: [CommonModule, ModalComponent, DatePipe],
  templateUrl: './plano-visor-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanoVisorDialogComponent implements OnDestroy {
  readonly #service = inject(ObraService);
  readonly #sanitizer = inject(DomSanitizer);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly plano = input<ObraPlano | null>(null);

  readonly closed = output<void>();
  readonly nuevaVersion = output<ObraPlano>();

  protected readonly estadoPlanoClass = estadoPlanoClass;
  protected readonly isLoading = signal(false);
  protected readonly error = signal('');
  protected readonly rawBlobUrl = signal<string | null>(null);
  protected readonly safeBlobUrl = signal<SafeResourceUrl | null>(null);
  protected readonly blobData = signal<Blob | null>(null);

  /** Detecta la extensión del archivo según la URL o formato_peso */
  protected readonly extension = computed(() => {
    const p = this.plano();
    if (!p) return '';
    if (p.formato_peso) {
      const match = p.formato_peso.match(/^([A-Z0-9]+)/i);
      if (match) return match[1].toLowerCase();
    }
    if (p.archivo_url) {
      const clean = p.archivo_url.split('?')[0];
      const ext = clean.split('.').pop();
      if (ext && ext.length <= 4) return ext.toLowerCase();
    }
    return 'pdf';
  });

  protected readonly esPdf = computed(() => {
    const ext = this.extension().toLowerCase();
    const mime = this.blobData()?.type ?? '';
    return ext === 'pdf' || mime.includes('pdf');
  });

  protected readonly esCadOBim = computed(() => {
    const ext = this.extension().toLowerCase();
    return ['dwg', 'dxf', 'rvt', 'ifc'].includes(ext);
  });

  protected readonly esEnlaceExterno = computed(() => {
    const url = this.plano()?.archivo_url ?? '';
    return /^https?:\/\//i.test(url);
  });

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const p = this.plano();

      if (!open || !p) {
        untracked(() => this.#liberarRecursos());
        return;
      }

      untracked(() => {
        this.#cargarPlano(p);
      });
    });
  }

  ngOnDestroy(): void {
    this.#liberarRecursos();
  }

  #cargarPlano(p: ObraPlano): void {
    this.#liberarRecursos();
    this.isLoading.set(true);
    this.error.set('');

    // Si es enlace externo a la nube (BIM 360 / Drive / OneDrive), no intentamos Blob local por CORS
    if (/^https?:\/\//i.test(p.archivo_url ?? '')) {
      this.isLoading.set(false);
      return;
    }

    this.#service.descargarArchivoPlanoBlob(this.idCentroCosto(), p.id, true).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        this.rawBlobUrl.set(objectUrl);
        this.safeBlobUrl.set(this.#sanitizer.bypassSecurityTrustResourceUrl(objectUrl));
        this.blobData.set(blob);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('No se pudo cargar el archivo del plano en memoria.');
      },
    });
  }

  #liberarRecursos(): void {
    const url = this.rawBlobUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.rawBlobUrl.set(null);
      this.safeBlobUrl.set(null);
      this.blobData.set(null);
    }
  }

  protected cerrar(): void {
    this.#liberarRecursos();
    this.closed.emit();
  }

  /** Descarga el archivo del plano directamente desde el blob en memoria */
  protected descargar(): void {
    const p = this.plano();
    if (!p) return;

    if (this.esEnlaceExterno() && p.archivo_url) {
      window.open(p.archivo_url, '_blank', 'noopener');
      return;
    }

    const blob = this.blobData();
    if (!blob) return;

    const ext = this.extension() ? `.${this.extension()}` : '.pdf';
    const nombreArchivo = `${p.codigo_plano}_${p.version || 'v1'}${ext}`;

    const url = this.rawBlobUrl() ?? URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /** Abre la vista en una pestaña nueva pero usando la URL virtual blob:// (sin exponer la API) */
  protected abrirEnNuevaPestana(): void {
    const url = this.rawBlobUrl();
    if (url) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    const enlace = this.plano()?.archivo_url;
    if (this.esEnlaceExterno() && enlace) {
      window.open(enlace, '_blank', 'noopener');
    }
  }

  /** Envía el plano PDF a la cola de impresión del navegador */
  protected imprimir(): void {
    const iframe = document.getElementById('visor-pdf-iframe');
    if (iframe instanceof HTMLIFrameElement && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      } catch {
        // Fallback si el iframe bloquea el foco cross-origin
      }
    }
    this.abrirEnNuevaPestana();
  }

  protected reintentar(): void {
    const p = this.plano();
    if (p) this.#cargarPlano(p);
  }
}
