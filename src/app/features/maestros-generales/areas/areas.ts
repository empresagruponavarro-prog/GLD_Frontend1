import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { ExportarBotonesComponent } from '../../../shared/components/exportar-botones/exportar-botones';
import { ModalComponent } from '../../../shared/components/modal/modal';
import type { DatosExportacion } from '../../../shared/utils/exportar';
import { errorMessage } from '../../almacen/almacen.utils';
import { Area } from '../../requerimientos/requerimientos.models';
import { AreasService, TrabajadorOpcion } from './areas.service';

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
    columnas: ['Código', 'Nombre', 'Descripción', 'Jefe o gerente', 'Estado'],
    filas: this.items().map((a) => [this.codigoDe(a), a.nombre, a.descripcion ?? '', a.jefe ?? '', a.estado ? 'Activa' : 'Inactiva']),
  }));
  protected readonly isLoading = signal(false);
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly editando = signal<Area | null>(null);

  protected readonly trabajadores = signal<TrabajadorOpcion[]>([]);

  protected readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    descripcion: new FormControl('', { nonNullable: true }),
    jefeTexto: new FormControl('', { nonNullable: true }),
    estado: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    this.load();
  }

  /** Código correlativo que se muestra (AR-01, AR-02…); sale del ID, no se escribe a mano. */
  protected codigoDe(a: Area): string {
    return `AR-${String(a.id).padStart(2, '0')}`;
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

  private cargarTrabajadores(): void {
    if (this.trabajadores().length > 0) return;
    this.areasService.getTrabajadores().subscribe({
      next: (r) => this.trabajadores.set(r),
      error: () => this.trabajadores.set([]),
    });
  }

  protected nueva(): void {
    if (!this.permisos.crear()) return;
    this.editando.set(null);
    this.modalError.set('');
    this.form.reset({ nombre: '', descripcion: '', jefeTexto: '', estado: true });
    this.cargarTrabajadores();
    this.isModalOpen.set(true);
  }

  protected editar(a: Area): void {
    if (!this.permisos.editar()) return;
    this.editando.set(a);
    this.modalError.set('');
    this.form.reset({ nombre: a.nombre, descripcion: a.descripcion ?? '', jefeTexto: a.jefe ?? '', estado: a.estado });
    this.cargarTrabajadores();
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.modalError.set('Indique el nombre del área.');
    }
    const v = this.form.getRawValue();
    const actual = this.editando();
    const nombre = v.nombre.trim();
    const descripcion = v.descripcion.trim();
    const textoJefe = v.jefeTexto.trim();
    // El dependiente se escribe o se elige, pero debe ser un trabajador registrado.
    const jefe = textoJefe ? this.trabajadores().find((x) => (x.nombre ?? '').trim().toLowerCase() === textoJefe.toLowerCase()) : undefined;
    if (textoJefe && !jefe) {
      return this.modalError.set('El dependiente debe ser un trabajador de la lista. Escribe para buscarlo y elígelo.');
    }
    const idJefe = jefe?.id ?? 0;
    this.isSaving.set(true);
    const request$ = actual
      ? this.areasService.update(actual.id, { nombre, descripcion, idJefe, estado: v.estado })
      : this.areasService.create({ nombre, ...(descripcion ? { descripcion } : {}), ...(idJefe > 0 ? { idJefe } : {}) });
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