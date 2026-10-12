import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { sinVacios } from '../../obra.calc';
import { CATEGORIAS_DOCUMENTO, DocumentoPayload, ESTADOS_DOCUMENTO, ObraDocumento } from '../../obra.interface';
import { ObraService } from '../../obra.service';

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

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly categorias = CATEGORIAS_DOCUMENTO;
  protected readonly estados = ESTADOS_DOCUMENTO;
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');

  protected readonly form = new FormGroup({
    titulo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    subtitulo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    categoria: new FormControl<string>('Acta', { nonNullable: true, validators: [Validators.required] }),
    nro_registro: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    fecha_emision: new FormControl('', { nonNullable: true }),
    vigencia_texto: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    estado: new FormControl<string>('Validado', { nonNullable: true }),
    archivo_url: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000), Validators.pattern(/^(https?:\/\/\S+)?$/i)] }),
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const d = this.documento();
      this.form.reset({
        titulo: d?.titulo ?? '',
        subtitulo: d?.subtitulo ?? '',
        categoria: d?.categoria ?? 'Acta',
        nro_registro: d?.nro_registro ?? '',
        fecha_emision: d?.fecha_emision ?? '',
        vigencia_texto: d?.vigencia_texto ?? '',
        estado: d?.estado ?? 'Validado',
        archivo_url: d?.archivo_url ?? '',
      });
    });
  }

  protected get isEdit(): boolean {
    return this.documento() !== null;
  }

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Completa título y categoría. El enlace debe empezar con http(s)://');
      return;
    }
    const v = this.form.getRawValue();
    const payload = sinVacios<DocumentoPayload>({
      titulo: v.titulo.trim(),
      subtitulo: v.subtitulo.trim(),
      categoria: v.categoria,
      nro_registro: v.nro_registro.trim(),
      fecha_emision: v.fecha_emision,
      vigencia_texto: v.vigencia_texto.trim(),
      estado: v.estado,
      archivo_url: v.archivo_url.trim(),
    });
    const d = this.documento();
    const req$ = d
      ? this.#service.updateDocumento(this.idCentroCosto(), d.id, payload)
      : this.#service.createDocumento(this.idCentroCosto(), payload);

    this.isSaving.set(true);
    req$.subscribe({
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

  protected onDelete(): void {
    const d = this.documento();
    if (!d || !confirm(`¿Eliminar el documento "${d.titulo}"?`)) return;
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
