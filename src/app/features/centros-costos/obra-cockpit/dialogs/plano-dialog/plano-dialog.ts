import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { sinVacios } from '../../obra.calc';
import { DISCIPLINAS_PLANO, ESTADOS_APROBACION_PLANO, ObraPlano, PlanoPayload } from '../../obra.interface';
import { ObraService } from '../../obra.service';

export type ModoPlano = 'crear' | 'editar' | 'version';

const URL_PATTERN = /^(https?:\/\/\S+)?$/i;

@Component({
  selector: 'app-plano-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './plano-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanoDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly plano = input<ObraPlano | null>(null);
  readonly modo = input<ModoPlano>('crear');

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly disciplinas = DISCIPLINAS_PLANO;
  protected readonly estadosAprobacion = ESTADOS_APROBACION_PLANO;
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');

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
    estado_aprobacion: new FormControl<string>('Aprobado Obra', { nonNullable: true }),
    fecha_vobo: new FormControl('', { nonNullable: true }),
    formato_peso: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    archivo_url: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000), Validators.pattern(URL_PATTERN)] }),
    emitido_por: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const p = this.plano();
      const modo = this.modo();
      this.form.reset({
        codigo_plano: p?.codigo_plano ?? '',
        nombre_plano: p?.nombre_plano ?? '',
        disciplina: p?.disciplina ?? 'Arquitectura',
        version: modo === 'crear' ? 'v1.0' : modo === 'editar' ? (p?.version ?? '') : '',
        estado_aprobacion: modo === 'version' ? 'En Revisión' : (p?.estado_aprobacion ?? 'Aprobado Obra'),
        fecha_vobo: modo === 'version' ? '' : (p?.fecha_vobo ?? ''),
        formato_peso: modo === 'version' ? '' : (p?.formato_peso ?? ''),
        archivo_url: modo === 'version' ? '' : (p?.archivo_url ?? ''),
        emitido_por: p?.emitido_por ?? '',
      });
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

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Completa los campos obligatorios. El enlace del archivo debe empezar con http(s)://');
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
