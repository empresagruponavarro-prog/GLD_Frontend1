import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@shared/utils/errores-http';
import { formatearBytes, hoyLimaIso, iconoArchivo, nombreArchivoDocumento, sinVacios } from '../../obra.calc';
import {
  CATEGORIAS_DOCUMENTO,
  DOCUMENTO_EXTENSIONES,
  DOCUMENTO_MAX_BYTES,
  DocumentoPatch,
  DocumentoPayload,
  ESTADOS_DOCUMENTO,
  ObraDocumento,
} from '../../obra.interface';
import { ObraService } from '../../obra.service';
import { PermisosObra, SIN_PERMISOS_OBRA, puedeGuardarObra } from '../../obra-permisos';

export type OrigenDocumento = 'local' | 'enlace';

/** Estado con el que nace un documento nuevo. */
const ESTADO_INICIAL = 'Pendiente';

interface ValoresFormulario {
  subtitulo: string;
  nro_registro: string;
  fecha_emision: string;
  vigencia_texto: string;
}

/** Etiquetas descriptivas de las categorías (el valor que viaja al backend no cambia). */
const ETIQUETA_CATEGORIA: Record<string, string> = {
  Acta: 'Acta Oficial',
  Permiso: 'Permiso / Licencia',
  Seguridad: 'Seguridad y Salud (SST)',
  Calidad: 'Control de Calidad',
  Contrato: 'Contrato',
  Otros: 'Otros',
};

/** Etiqueta y color del indicador de cada estado de validación. */
const ESTADO_VISUAL: Record<string, { etiqueta: string; punto: string }> = {
  Validado: { etiqueta: 'Validado por Supervisión Técnica', punto: 'bg-emerald-500' },
  Pendiente: { etiqueta: 'Pendiente de validación', punto: 'bg-amber-500' },
  Observado: { etiqueta: 'Observado', punto: 'bg-orange-500' },
  Vencido: { etiqueta: 'Vencido', punto: 'bg-rose-500' },
};

const REGEX_HTTP = /^https?:\/\//i;

@Component({
  selector: 'app-documento-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './documento-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentoDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly documento = input<ObraDocumento | null>(null);
  /** Nombre de la obra, para la cabecera. */
  readonly nombreObra = input<string>('');
  /**
   * Permisos de `obra`: guardar exige `crear` (alta) o `editar` (detalle); Eliminar, `eliminar`;
   * subir archivo, `crear`. Abierto desde «Detalle» sin `editar`, el formulario es de solo lectura.
   */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly categorias = CATEGORIAS_DOCUMENTO.map((valor) => ({ valor, etiqueta: ETIQUETA_CATEGORIA[valor] ?? valor }));
  protected readonly estados = ESTADOS_DOCUMENTO.map((valor) => ({
    valor,
    etiqueta: ESTADO_VISUAL[valor]?.etiqueta ?? valor,
  }));
  protected readonly extensionesAceptadas = DOCUMENTO_EXTENSIONES.join(',');
  protected readonly extensionesTexto = DOCUMENTO_EXTENSIONES.join(', ');
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeGuardar = computed(() => puedeGuardarObra(this.permisos(), this.documento() !== null));
  /** Sin permiso de guardar, el formulario se muestra en solo lectura. */
  protected readonly soloLectura = computed(() => !this.puedeGuardar());
  protected readonly puedeEliminar = computed(() => this.documento() !== null && this.permisos().eliminar);
  /** Subir un archivo (`POST …/documentos/archivo`) exige `crear` en el backend, también al editar. */
  protected readonly puedeSubirArchivo = computed(() => this.puedeGuardar() && this.permisos().crear);
  /** Error de la selección/subida del archivo (se muestra junto al control). */
  protected readonly archivoError = signal('');

  /** Origen del archivo: subida local o enlace externo. */
  protected readonly origen = signal<OrigenDocumento>('local');
  /** Nombre del archivo adjunto (subido ahora o ya existente). */
  protected readonly archivoNombre = signal('');
  /** Tamaño en bytes del archivo subido en esta sesión (se desconoce para el ya guardado). */
  protected readonly archivoBytes = signal<number | null>(null);
  protected readonly archivoInfo = computed(() => iconoArchivo(this.archivoNombre()));
  protected readonly archivoPeso = computed(() => formatearBytes(this.archivoBytes()));
  /** true mientras se arrastra un archivo sobre la zona de carga. */
  protected readonly arrastrando = signal(false);
  /** Clave local actualmente vinculada (espejo de form.archivo_url, para la plantilla). */
  protected readonly claveLocal = signal('');
  /** Progreso de subida 0-100; null cuando no hay subida en curso. */
  protected readonly progreso = signal<number | null>(null);
  protected readonly subiendo = computed(() => this.progreso() !== null);
  /** El archivo que ya tenía guardado el documento sigue vinculado (se puede ver/descargar). */
  protected readonly archivoGuardadoVigente = computed(() => {
    const original = this.documento()?.archivo_url;
    return !!original && !REGEX_HTTP.test(original) && this.claveLocal() === original;
  });

  #subida?: Subscription;
  /** Clave del archivo subido en esta sesión que aún no se guardó (se borra si se cancela). */
  #pendiente: string | null = null;

  protected readonly form = new FormGroup({
    titulo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    subtitulo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    categoria: new FormControl<string>('Acta', { nonNullable: true, validators: [Validators.required] }),
    nro_registro: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    fecha_emision: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    vigencia_texto: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    estado: new FormControl<string>(ESTADO_INICIAL, { nonNullable: true }),
    /** Clave del archivo local subido (no editable por el usuario). */
    archivo_url: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    /** URL externa (http/https). */
    enlace: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000), Validators.pattern(/^(https?:\/\/\S+)?$/i)],
    }),
  });

  /** Estado elegido, para colorear el indicador del selector. */
  protected readonly estadoActual = toSignal(this.form.controls.estado.valueChanges, { initialValue: ESTADO_INICIAL });
  protected readonly puntoEstado = computed(() => ESTADO_VISUAL[this.estadoActual()]?.punto ?? 'bg-slate-400');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#subida?.unsubscribe();
      this.#descartarPendiente();
    });
    effect(() => {
      const abierto = this.isOpen();
      const d = this.documento();
      const soloLectura = this.soloLectura();
      // Solo isOpen, documento y los permisos disparan el efecto; lo demás se lee sin dependencia.
      untracked(() => {
        if (!abierto) {
          // Modal cerrado sin guardar: se aborta la subida y se borra el archivo huérfano.
          this.cancelarSubida();
          this.#descartarPendiente();
          return;
        }
        this.cancelarSubida();
        this.#descartarPendiente();
        this.formError.set('');
        this.archivoError.set('');
        const original = d?.archivo_url ?? '';
        const esExterno = REGEX_HTTP.test(original);
        this.form.reset({
          titulo: d?.titulo ?? '',
          subtitulo: d?.subtitulo ?? '',
          categoria: d?.categoria ?? 'Acta',
          nro_registro: d?.nro_registro ?? '',
          // Documento nuevo: emisión de hoy y estado Pendiente. Al editar se respeta lo guardado.
          fecha_emision: d ? (d.fecha_emision ?? '') : hoyLimaIso(),
          vigencia_texto: d?.vigencia_texto ?? '',
          estado: d?.estado ?? ESTADO_INICIAL,
          archivo_url: esExterno ? '' : original,
          enlace: esExterno ? original : '',
        });
        this.origen.set(esExterno ? 'enlace' : 'local');
        this.claveLocal.set(esExterno ? '' : original);
        this.archivoNombre.set(esExterno ? '' : nombreArchivoDocumento(original));
        this.archivoBytes.set(null);
        this.arrastrando.set(false);
        if (soloLectura) this.form.disable({ emitEvent: false });
        else this.form.enable({ emitEvent: false });
      });
    });
  }

  protected get isEdit(): boolean {
    return this.documento() !== null;
  }

  /** Campo obligatorio tocado y vacío, para marcarlo en rojo. */
  protected invalido(campo: 'titulo' | 'fecha_emision'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  protected get enlaceInvalido(): boolean {
    const c = this.form.controls.enlace;
    return c.invalid && (c.touched || c.dirty);
  }

  protected get enlaceMensaje(): string {
    const e = this.form.controls.enlace.errors;
    if (e?.['pattern']) return 'El enlace debe empezar con http:// o https:// y no contener espacios.';
    if (e?.['maxlength']) return 'El enlace no puede superar 1000 caracteres.';
    return '';
  }

  /** Cambia entre archivo local y enlace: limpia el otro origen y descarta lo subido sin guardar. */
  protected setOrigen(nuevo: OrigenDocumento): void {
    if (this.origen() === nuevo || this.soloLectura()) return;
    this.cancelarSubida();
    this.#descartarPendiente();
    this.archivoError.set('');
    this.form.patchValue({ archivo_url: '', enlace: '' });
    this.form.controls.enlace.markAsPristine();
    this.form.controls.enlace.markAsUntouched();
    this.claveLocal.set('');
    this.archivoNombre.set('');
    this.archivoBytes.set(null);
    this.origen.set(nuevo);
  }

  /** Quita el archivo actual del formulario y descarta si había subida pendiente. */
  protected quitarArchivo(): void {
    if (this.soloLectura()) return;
    this.#descartarPendiente();
    this.form.patchValue({ archivo_url: '' });
    this.claveLocal.set('');
    this.archivoNombre.set('');
    this.archivoBytes.set(null);
    this.archivoError.set('');
  }

  /** Valida y sube el archivo elegido; al terminar llena archivo_url con la clave devuelta. */
  protected onArchivoSeleccionado(event: Event): void {
    const inputEl = event.target;
    if (!(inputEl instanceof HTMLInputElement) || !this.puedeSubirArchivo()) return;
    const archivo = inputEl.files?.[0];
    inputEl.value = ''; // permite volver a elegir el mismo archivo
    if (archivo) this.#procesarArchivo(archivo);
  }

  protected onArrastrar(event: DragEvent): void {
    event.preventDefault();
    if (!this.subiendo() && !this.isSaving() && this.puedeSubirArchivo()) this.arrastrando.set(true);
  }

  protected onSoltar(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando.set(false);
    if (this.subiendo() || this.isSaving() || !this.puedeSubirArchivo()) return;
    const archivo = event.dataTransfer?.files?.[0];
    if (archivo) this.#procesarArchivo(archivo);
  }

  #procesarArchivo(archivo: File): void {

    const punto = archivo.name.lastIndexOf('.');
    const ext = punto >= 0 ? archivo.name.slice(punto).toLowerCase() : '';
    if (!DOCUMENTO_EXTENSIONES.some((e) => e === ext)) {
      this.archivoError.set(`Formato no permitido${ext ? ` (${ext})` : ''}. Usa: ${this.extensionesTexto}`);
      return;
    }
    if (archivo.size > DOCUMENTO_MAX_BYTES) {
      this.archivoError.set('El archivo supera el máximo de 50 MB.');
      return;
    }

    this.archivoError.set('');
    this.cancelarSubida();
    this.progreso.set(0);
    this.#subida = this.#service.subirArchivoDocumento(this.idCentroCosto(), archivo).subscribe({
      next: (ev) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) {
          this.progreso.set(Math.round((ev.loaded / ev.total) * 100));
        } else if (ev.type === HttpEventType.Response && ev.body) {
          // Si ya había otro archivo subido sin guardar, se reemplaza y se borra.
          this.#descartarPendiente();
          this.#pendiente = ev.body.archivo_url;
          this.form.patchValue({ archivo_url: ev.body.archivo_url });
          this.claveLocal.set(ev.body.archivo_url);
          this.archivoNombre.set(ev.body.nombre_original);
          this.archivoBytes.set(ev.body.bytes);
          this.progreso.set(null);
        }
      },
      error: (err: unknown) => {
        this.progreso.set(null);
        this.archivoError.set(errorMessage(err));
      },
    });
  }

  protected cancelarSubida(): void {
    this.#subida?.unsubscribe();
    this.#subida = undefined;
    this.progreso.set(null);
  }

  /** Borra del servidor el archivo subido que no llegó a guardarse. */
  #descartarPendiente(): void {
    const clave = this.#pendiente;
    if (!clave) return;
    this.#pendiente = null;
    // `DELETE …/archivo` exige `eliminar` en el backend: sin él no se pide (el archivo queda huérfano).
    if (!this.permisos().eliminar) return;
    this.#service.descartarArchivoDocumento(this.idCentroCosto(), clave).subscribe({ error: () => undefined });
  }

  /** Ver (inline) o descargar el archivo guardado del documento en edición. */
  protected abrirArchivoGuardado(inline: boolean): void {
    const d = this.documento();
    if (!d?.archivo_url) return;
    this.formError.set('');
    const pestana = inline ? window.open('', '_blank') : null;
    this.#service.descargarArchivoDocumento(this.idCentroCosto(), d.id, inline).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (inline) {
          if (pestana) pestana.location.href = url;
          else window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          return;
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivoDocumento(d.archivo_url);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      error: () => {
        pestana?.close();
        this.formError.set('No se pudo abrir el archivo. Inténtalo nuevamente.');
      },
    });
  }

  protected onSubmit(): void {
    if (!this.puedeGuardar()) return;
    this.form.markAllAsTouched();
    if (this.subiendo()) {
      this.formError.set('Espera a que termine la subida del archivo.');
      return;
    }
    if (this.form.invalid) {
      this.formError.set('Revisa los campos marcados: el título, la categoría y la fecha de emisión son obligatorios y el enlace debe ser válido.');
      return;
    }
    this.formError.set('');
    const v = this.form.getRawValue();
    const archivo = (this.origen() === 'local' ? v.archivo_url : v.enlace).trim();
    const d = this.documento();

    const base = {
      titulo: v.titulo.trim(),
      categoria: v.categoria,
      estado: v.estado,
    };
    const req$ = d
      ? this.#service.updateDocumento(this.idCentroCosto(), d.id, this.#armarPatch(base, v, archivo, d))
      : this.#service.createDocumento(
          this.idCentroCosto(),
          sinVacios<DocumentoPayload>({
            ...base,
            subtitulo: v.subtitulo.trim(),
            nro_registro: v.nro_registro.trim(),
            fecha_emision: v.fecha_emision,
            vigencia_texto: v.vigencia_texto.trim(),
            archivo_url: archivo,
          }),
        );

    this.isSaving.set(true);
    req$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.#pendiente = null; // ya quedó vinculado al documento
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }

  /** En edición los opcionales vacíos se envían como null (limpiar); el archivo sin cambios no se toca. */
  #armarPatch(
    base: Pick<DocumentoPayload, 'titulo' | 'categoria' | 'estado'>,
    v: ValoresFormulario,
    archivo: string,
    d: ObraDocumento,
  ): DocumentoPatch {
    const vacioANull = (s: string): string | null => (s.trim() === '' ? null : s.trim());
    return {
      ...base,
      subtitulo: vacioANull(v.subtitulo),
      nro_registro: vacioANull(v.nro_registro),
      fecha_emision: v.fecha_emision === '' ? null : v.fecha_emision,
      vigencia_texto: vacioANull(v.vigencia_texto),
      archivo_url: archivo === (d.archivo_url ?? '') ? undefined : archivo === '' ? null : archivo,
    };
  }

  protected onDelete(): void {
    const d = this.documento();
    if (!d || !this.puedeEliminar() || !confirm(`¿Eliminar el documento "${d.titulo}"?`)) return;
    this.isSaving.set(true);
    this.#service.deleteDocumento(this.idCentroCosto(), d.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }
}
