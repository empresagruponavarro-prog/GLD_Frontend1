import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { ExportarBotonesComponent } from '../../../shared/components/exportar-botones/exportar-botones';
import { ModalComponent } from '../../../shared/components/modal/modal';
import type { DatosExportacion } from '../../../shared/utils/exportar';
import { errorMessage } from '@shared/utils/errores-http';
import { Area } from '../../requerimientos/requerimientos.models';
import { AreasService } from './areas.service';

/** Áreas de la empresa (Costos y Presupuesto, Procura, Sistemas…): se usan en requerimientos, documentos de origen y el tablero. */
@Component({
  selector: 'app-areas',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, ExportarBotonesComponent],
  templateUrl: './areas.html',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AreasComponent {
  private readonly areasService = inject(AreasService);
  /** Nueva → crear; Editar (PATCH) → editar. */
  protected readonly permisos = permisosDePantalla('maestros.areas');

  protected readonly items = signal<Area[]>([]);
  protected readonly datosExportacion = computed<DatosExportacion>(() => ({
    nombre: 'Areas',
    columnas: ['Código', 'Nombre', 'Estado'],
    filas: this.items().map((a) => [a.codigo, a.nombre, a.estado ? 'Activa' : 'Inactiva']),
  }));
  protected readonly isLoading = signal(false);
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly editando = signal<Area | null>(null);

  protected readonly form = new FormGroup({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[A-Z0-9_-]{2,20}$/)] }),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    estado: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.areasService.getAll().subscribe({
      next: (r) => {
        this.items.set(r);
        this.isLoading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.isLoading.set(false);
      },
    });
  }

  protected nueva(): void {
    if (!this.permisos.crear()) return;
    this.editando.set(null);
    this.modalError.set('');
    this.form.reset({ estado: true });
    this.form.controls.codigo.enable();
    this.isModalOpen.set(true);
  }

  protected editar(a: Area): void {
    if (!this.permisos.editar()) return;
    this.editando.set(a);
    this.modalError.set('');
    this.form.reset({ codigo: a.codigo, nombre: a.nombre, estado: a.estado });
    this.form.controls.codigo.disable();
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.modalError.set('Indique un código (mayúsculas, números o guion) y el nombre.');
    }
    const v = this.form.getRawValue();
    const actual = this.editando();
    this.isSaving.set(true);
    const request$ = actual
      ? this.areasService.update(actual.id, { nombre: v.nombre.trim(), estado: v.estado })
      : this.areasService.create({ codigo: v.codigo.trim(), nombre: v.nombre.trim() });
    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeModal();
        this.load();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.modalError.set(errorMessage(err));
      },
    });
  }
}
