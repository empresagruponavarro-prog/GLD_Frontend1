import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { sinVacios } from '../../obra.calc';
import {
  DISCIPLINAS_PLANO,
  ESTADOS_APROBACION_PLANO,
  ObraPlano,
  PLANO_EXTENSIONES,
  PLANO_MAX_BYTES,
  PlanoPayload,
} from '../../obra.interface';
import { ObraService } from '../../obra.service';

export type ModoPlano = 'crear' | 'editar' | 'version';

export const PREFIJOS_DISCIPLINA: Record<string, string> = {
  Arquitectura: 'ARQ',
  Estructuras: 'EST',
  Eléctricas: 'IE',
  Sanitarias: 'IS',
  Mecánicas: 'MEC',
  Comunicaciones: 'COM',
  Otros: 'PLN',
};

export function generarSiguienteCodigoPlano(disciplina: string, planos: readonly ObraPlano[]): string {
  const prefijo = PREFIJOS_DISCIPLINA[disciplina] || 'PLN';
  const regex = new RegExp(`^${prefijo}-(\\d+)`, 'i');
  let maxNum = 0;
  for (const p of planos) {
    const match = p.codigo_plano.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  const siguiente = maxNum + 1;
  return `${prefijo}-${siguiente.toString().padStart(2, '0')}`;
}

/** Nombre legible de un archivo guardado: quita carpeta y prefijo uuid_. */
function nombreArchivo(archivoUrl: string | undefined | null): string {
  if (!archivoUrl) return '';
  if (/^https?:\/\//i.test(archivoUrl)) return 'Enlace externo';
  return (archivoUrl.split('/').pop() ?? '').replace(/^[0-9a-f]{8}_/i, '');
}

@Component({
  selector: 'app-plano-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './plano-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanoDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly nombreObra = input<string>('');
  readonly plano = input<ObraPlano | null>(null);
  readonly modo = input<ModoPlano>('crear');
  readonly planosExistentes = input<readonly ObraPlano[]>([]);
  readonly responsables = input<readonly string[]>([]);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly disciplinas = DISCIPLINAS_PLANO;
  protected readonly disciplinasOpciones = [
    { value: 'Arquitectura', label: 'Arquitectura (ARQ)' },
    { value: 'Estructuras', label: 'Estructuras (EST)' },
    { value: 'Eléctricas', label: 'Instalaciones Eléctricas (IE)' },
    { value: 'Sanitarias', label: 'Instalaciones Sanitarias (IS)' },
    { value: 'Mecánicas', label: 'Mecánicas (MEC)' },
    { value: 'Comunicaciones', label: 'Comunicaciones (COM)' },
    { value: 'Otros', label: 'Otros' },
  ];
  protected readonly estadosAprobacion = ESTADOS_APROBACION_PLANO;
  protected readonly extensionesAceptadas = PLANO_EXTENSIONES.join(',');
  protected readonly extensionesTexto = PLANO_EXTENSIONES.join(', ');
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');

  /** Tipo de origen: subida local o enlace externo / nube / BIM 360 */
  protected readonly tipoOrigen = signal<'local' | 'nube'>('local');

  /** Nombre del archivo adjunto (subido ahora o ya existente). */
  protected readonly archivoNombre = signal('');
  /** Progreso de subida 0-100; null cuando no hay subida en curso. */
  protected readonly progreso = signal<number | null>(null);
  protected readonly subiendo = computed(() => this.progreso() !== null);
  #subida?: Subscription;
  /** Clave del archivo subido en esta sesión que aún no se guardó en un plano (se borra si se cancela). */
  #pendiente: string | null = null;

  protected readonly titulo = computed(() => {
    const p = this.plano();
    switch (this.modo()) {
      case 'editar':
        return `Editar plano ${p?.codigo_plano ?? ''}`;
      case 'version':
        return `Nueva versión de ${p?.codigo_plano ?? ''} (actual ${p?.version ?? ''})`;
      default:
        return 'Registrar nuevo plano de obra';
    }
  });

  protected readonly form = new FormGroup({
    codigo_plano: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    nombre_plano: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    disciplina: new FormControl<string>('Arquitectura', { nonNullable: true, validators: [Validators.required] }),
    version: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    estado_aprobacion: new FormControl<string>('En Revisión', { nonNullable: true }),
    fecha_vobo: new FormControl('', { nonNullable: true }),
    formato_peso: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    archivo_url: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    emitido_por: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#subida?.unsubscribe();
      this.#descartarPendiente();
    });
    effect(() => {
      if (!this.isOpen()) {
        // Modal cerrado sin guardar: se aborta la subida y se borra el archivo huérfano.
        untracked(() => {
          this.cancelarSubida();
          this.#descartarPendiente();
        });
        return;
      }
      this.formError.set('');
      const p = this.plano();
      const modo = this.modo();
      const disciplinaInicial = p?.disciplina ?? 'Arquitectura';
      const codigoInicial = p?.codigo_plano || (modo === 'crear' ? generarSiguienteCodigoPlano(disciplinaInicial, this.planosExistentes()) : '');

      this.form.reset({
        codigo_plano: codigoInicial,
        nombre_plano: p?.nombre_plano ?? '',
        disciplina: disciplinaInicial,
        version: modo === 'crear' ? 'v1.0' : modo === 'editar' ? (p?.version ?? '') : '',
        estado_aprobacion: modo === 'crear' || modo === 'version' ? 'En Revisión' : (p?.estado_aprobacion ?? 'En Revisión'),
        fecha_vobo: modo === 'version' ? '' : (p?.fecha_vobo ?? ''),
        formato_peso: modo === 'version' ? '' : (p?.formato_peso ?? ''),
        archivo_url: modo === 'version' ? '' : (p?.archivo_url ?? ''),
        emitido_por: p?.emitido_por ?? '',
      });
      this.archivoNombre.set(modo === 'version' ? '' : nombreArchivo(p?.archivo_url));
      this.tipoOrigen.set(p?.archivo_url && /^https?:\/\//i.test(p.archivo_url) ? 'nube' : 'local');
      const c = this.form.controls;
      if (modo === 'crear') {
        c.codigo_plano.enable();
        c.disciplina.enable();
        c.version.enable();
      } else {
        c.codigo_plano.disable();
        if (modo === 'version') c.disciplina.disable();
        else c.disciplina.enable();
        if (modo === 'editar') c.version.disable();
        else c.version.enable();
      }
    });
  }

  /** Al cambiar de disciplina, si estamos en modo crear autogeneramos el correlativo */
  protected onDisciplinaChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (this.modo() === 'crear') {
      const cod = generarSiguienteCodigoPlano(select.value, this.planosExistentes());
      this.form.controls.codigo_plano.setValue(cod);
    }
  }

  /** Permite al usuario regenerar el código automáticamente en base a la disciplina actual */
  protected regenerarCodigo(): void {
    const disc = this.form.controls.disciplina.value || 'Arquitectura';
    const cod = generarSiguienteCodigoPlano(disc, this.planosExistentes());
    this.form.controls.codigo_plano.setValue(cod);
  }

  /** Quita el archivo actual del formulario y descarta si había subida pendiente. */
  protected quitarArchivo(): void {
    this.#descartarPendiente();
    this.form.patchValue({ archivo_url: '', formato_peso: '' });
    this.archivoNombre.set('');
  }

  /** Valida y sube el archivo elegido con el botón; al terminar llena archivo_url y formato/peso. */
  protected onArchivoSeleccionado(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const archivo = inputEl.files?.[0];
    inputEl.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    const ext = archivo.name.slice(archivo.name.lastIndexOf('.')).toLowerCase();
    if (!(PLANO_EXTENSIONES as readonly string[]).includes(ext)) {
      this.formError.set(`Formato no permitido. Usa: ${this.extensionesTexto}`);
      return;
    }
    if (archivo.size > PLANO_MAX_BYTES) {
      this.formError.set('El archivo supera el máximo de 50 MB');
      return;
    }

    this.formError.set('');
    this.cancelarSubida();
    this.progreso.set(0);
    this.#subida = this.#service.subirArchivoPlano(this.idCentroCosto(), archivo).subscribe({
      next: (ev) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) {
          this.progreso.set(Math.round((ev.loaded / ev.total) * 100));
        } else if (ev.type === HttpEventType.Response && ev.body) {
          // Si ya había otro archivo subido sin guardar, se reemplaza y se borra.
          this.#descartarPendiente();
          this.#pendiente = ev.body.archivo_url;
          this.form.patchValue({ archivo_url: ev.body.archivo_url, formato_peso: ev.body.formato_peso });
          this.archivoNombre.set(ev.body.nombre_original);
          this.progreso.set(null);
        }
      },
      error: (err: unknown) => {
        this.progreso.set(null);
        this.formError.set(errorMessage(err));
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
    this.#service.descartarArchivoPlano(this.idCentroCosto(), clave).subscribe({ error: () => undefined });
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.subiendo()) {
      this.formError.set('Espera a que termine la subida del archivo');
      return;
    }
    if (this.form.invalid) {
      this.formError.set('Completa los campos obligatorios.');
      return;
    }
    const v = this.form.getRawValue();
    const comun = {
      nombre_plano: v.nombre_plano.trim(),
      estado_aprobacion: v.estado_aprobacion,
      fecha_vobo: v.fecha_vobo,
      formato_peso: v.formato_peso.trim(),
      archivo_url: v.archivo_url.trim(),
      emitido_por: v.emitido_por.trim(),
    };
    const id = this.idCentroCosto();
    const p = this.plano();
    let req$: Observable<unknown>;
    if (this.modo() === 'editar' && p) {
      req$ = this.#service.updatePlano(id, p.id, sinVacios({ ...comun, disciplina: v.disciplina }));
    } else if (this.modo() === 'version' && p) {
      req$ = this.#service.nuevaVersionPlano(id, p.id, sinVacios({ ...comun, version: v.version.trim() }));
    } else {
      req$ = this.#service.createPlano(
        id,
        sinVacios<PlanoPayload>({ ...comun, codigo_plano: v.codigo_plano.trim(), disciplina: v.disciplina, version: v.version.trim() }),
      );
    }

    this.isSaving.set(true);
    req$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.#pendiente = null; // ya quedó vinculado al plano
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }

  protected onDelete(): void {
    const p = this.plano();
    if (!p) return;
    const msg = p.id_plano_anterior
      ? `¿Eliminar la versión ${p.version} de ${p.codigo_plano}? La versión anterior volverá a quedar vigente.`
      : `¿Eliminar el plano ${p.codigo_plano}?`;
    if (!confirm(msg)) return;
    this.isSaving.set(true);
    this.#service.deletePlano(this.idCentroCosto(), p.id).subscribe({
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
