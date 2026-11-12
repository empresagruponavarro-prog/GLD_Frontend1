import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { valorDeEvento } from '@shared/utils/eventos';
import { sinVacios } from '../../obra.calc';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  DisciplinaPlano,
  ESTADOS_APROBACION_PLANO,
  ObraPlano,
  PLANO_EXTENSIONES,
  PLANO_MAX_BYTES,
  PlanoPayload,
} from '../../obra.interface';
import { ObraService } from '../../obra.service';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';

export type ModoPlano = 'crear' | 'editar' | 'version';

/** Plano de la lista requerida que se sube: su código, nombre y disciplina vienen del catálogo y no se cambian. */
export interface PlanoInicial {
  codigo_plano: string;
  nombre_plano: string;
  disciplina: string;
}

/** Siguiente código sugerido con el prefijo de la disciplina (ARQ-01, ARQ-02…), a partir de los planos de la obra. Puro. */
export function generarSiguienteCodigoPlano(prefijo: string, planos: readonly ObraPlano[]): string {
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
  /** Solo al crear: plano de la lista requerida (fija código y disciplina y exige el archivo). */
  readonly inicial = input<PlanoInicial | null>(null);
  readonly planosExistentes = input<readonly ObraPlano[]>([]);
  readonly responsables = input<readonly string[]>([]);
  /**
   * Permisos de `obra`: guardar exige `crear` (alta) o `editar` (edición y nueva versión, que el
   * backend marca `@Accion('editar')`); Eliminar, `eliminar`; subir archivo, `crear`.
   */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  /** Disciplinas de la obra: columna «Disciplina» de los tipos de plano de su tipo de proyecto (Catálogos de proyecto). */
  protected readonly disciplinasCatalogo = rxResource({
    params: () => (this.isOpen() ? this.idCentroCosto() : undefined),
    stream: ({ params }) => this.#service.getDisciplinasPlano(params),
  });
  /** Opciones del desplegable; la disciplina que ya tiene el plano se conserva aunque ya no sea del tipo de proyecto. */
  protected readonly disciplinasOpciones = computed<DisciplinaPlano[]>(() => {
    const lista = this.disciplinasCatalogo.hasValue() ? this.disciplinasCatalogo.value() : [];
    const actual = this.plano()?.disciplina ?? (this.modo() === 'crear' ? this.inicial()?.disciplina : undefined);
    return actual && !lista.some((d) => d.nombre === actual) ? [...lista, { nombre: actual, prefijo: 'PLN' }] : lista;
  });
  protected readonly estadosAprobacion = ESTADOS_APROBACION_PLANO;
  protected readonly extensionesAceptadas = PLANO_EXTENSIONES.join(',');
  protected readonly extensionesTexto = PLANO_EXTENSIONES.join(', ');
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeGuardar = computed(() => (this.modo() === 'crear' ? this.permisos().crear : this.permisos().editar));
  /** Sin permiso de guardar, el formulario se muestra en solo lectura. */
  protected readonly soloLectura = computed(() => !this.puedeGuardar());
  protected readonly puedeEliminar = computed(() => this.modo() === 'editar' && this.permisos().eliminar);
  /** Subir un archivo (`POST …/planos/archivo`) exige `crear` en el backend, también al editar o versionar. */
  protected readonly puedeSubirArchivo = computed(() => this.puedeGuardar() && this.permisos().crear);

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
      default: {
        const ini = this.inicial();
        return ini ? `Subir plano ${ini.codigo_plano}` : 'Registrar nuevo plano de obra';
      }
    }
  });

  protected readonly form = new FormGroup({
    codigo_plano: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    nombre_plano: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    disciplina: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
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
      const ini = modo === 'crear' ? this.inicial() : null;
      // Sin disciplina fija, al crear se elige la primera de la obra cuando llega la lista (ver el efecto de abajo).
      const disciplinaInicial = p?.disciplina ?? ini?.disciplina ?? '';
      const codigoInicial = p?.codigo_plano || ini?.codigo_plano || '';

      this.form.reset({
        codigo_plano: codigoInicial,
        nombre_plano: p?.nombre_plano ?? ini?.nombre_plano ?? '',
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
      this.form.enable({ emitEvent: false });
      if (modo === 'crear') {
        c.codigo_plano.enable();
        c.disciplina.enable();
        c.version.enable();
        // El plano de la lista requerida conserva el código y la disciplina del catálogo.
        if (ini) c.codigo_plano.disable();
        if (ini?.disciplina) c.disciplina.disable();
      } else {
        c.codigo_plano.disable();
        if (modo === 'version') c.disciplina.disable();
        else c.disciplina.enable();
        if (modo === 'editar') c.version.disable();
        else c.version.enable();
      }
      if (this.soloLectura()) this.form.disable({ emitEvent: false });
    });
    // Alta libre (sin plano de la lista): al llegar las disciplinas de la obra se elige la primera y se sugiere su código.
    effect(() => {
      const opciones = this.disciplinasOpciones();
      if (!this.isOpen() || this.modo() !== 'crear' || this.inicial()?.codigo_plano) return;
      untracked(() => {
        const control = this.form.controls.disciplina;
        if (control.value || opciones.length === 0) return;
        control.setValue(opciones[0].nombre);
        this.form.controls.codigo_plano.setValue(generarSiguienteCodigoPlano(opciones[0].prefijo, this.planosExistentes()));
      });
    });
  }

  /** Prefijo de código de una disciplina de la obra (PLN si no está en la lista). */
  #prefijoDe(disciplina: string): string {
    return this.disciplinasOpciones().find((d) => d.nombre === disciplina)?.prefijo ?? 'PLN';
  }

  /** Al cambiar de disciplina, si estamos en modo crear autogeneramos el correlativo */
  protected onDisciplinaChange(event: Event): void {
    if (this.modo() === 'crear' && !this.form.controls.codigo_plano.disabled) {
      const cod = generarSiguienteCodigoPlano(this.#prefijoDe(valorDeEvento(event)), this.planosExistentes());
      this.form.controls.codigo_plano.setValue(cod);
    }
  }

  /** Permite al usuario regenerar el código automáticamente en base a la disciplina actual */
  protected regenerarCodigo(): void {
    if (this.soloLectura() || this.form.controls.codigo_plano.disabled) return;
    const cod = generarSiguienteCodigoPlano(this.#prefijoDe(this.form.controls.disciplina.value), this.planosExistentes());
    this.form.controls.codigo_plano.setValue(cod);
  }

  /** Quita el archivo actual del formulario y descarta si había subida pendiente. */
  protected quitarArchivo(): void {
    if (this.soloLectura()) return;
    this.#descartarPendiente();
    this.form.patchValue({ archivo_url: '', formato_peso: '' });
    this.archivoNombre.set('');
  }

  /** Valida y sube el archivo elegido con el botón; al terminar llena archivo_url y formato/peso. */
  protected onArchivoSeleccionado(event: Event): void {
    const inputEl = event.target;
    if (!(inputEl instanceof HTMLInputElement) || !this.puedeSubirArchivo()) return;
    const archivo = inputEl.files?.[0];
    inputEl.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    const ext = archivo.name.slice(archivo.name.lastIndexOf('.')).toLowerCase();
    if (!PLANO_EXTENSIONES.some((e) => e === ext)) {
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
    // `DELETE …/archivo` exige `eliminar` en el backend: sin él no se pide (el archivo queda huérfano).
    if (!this.permisos().eliminar) return;
    this.#service.descartarArchivoPlano(this.idCentroCosto(), clave).subscribe({ error: () => undefined });
  }

  protected onSubmit(): void {
    if (!this.puedeGuardar()) return;
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
    if (this.modo() === 'crear' && this.inicial() && !v.archivo_url.trim()) {
      this.formError.set('Adjunta el archivo o el enlace del plano: sin archivo no se puede marcar como entregado.');
      return;
    }
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
    if (!p || !this.puedeEliminar()) return;
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
