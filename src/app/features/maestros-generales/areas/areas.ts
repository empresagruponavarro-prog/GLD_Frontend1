import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
    columnas: ['Código', 'Nombre', 'Depende de', 'Jefe superior', 'Jefe del área', 'Estado'],
    filas: this.items().map((a) => [
      this.codigoDe(a),
      a.nombre,
      a.areaPadre ?? '',
      a.jefeSuperior ?? '',
      a.jefe ?? '',
      a.estado ? 'Activa' : 'Inactiva',
    ]),
  }));
  protected readonly isLoading = signal(false);
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly editando = signal<Area | null>(null);

  protected readonly trabajadores = signal<TrabajadorOpcion[]>([]);

  protected readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    jefeTexto: new FormControl('', { nonNullable: true }),
    idAreaPadre: new FormControl(0, { nonNullable: true }),
    estado: new FormControl(true, { nonNullable: true }),
  });

  /** Áreas que se pueden elegir como superior: sin la propia ni las que dependen de ella (sería un ciclo). */
  protected readonly opcionesPadre = computed(() => {
    const actual = this.editando();
    if (!actual) return this.items();
    const dependientes = this.dependientesDe(actual.id);
    return this.items().filter((a) => a.id !== actual.id && !dependientes.has(a.id));
  });

  private readonly padreElegido = toSignal(this.form.controls.idAreaPadre.valueChanges, { initialValue: 0 });

  /** Ayuda bajo «Depende de»: quién será el jefe superior según el área elegida. */
  protected readonly pistaPadre = computed(() => {
    const id = Number(this.padreElegido());
    if (!id) return 'Será un área superior (no depende de otra).';
    const padre = this.items().find((a) => a.id === id);
    if (!padre) return '';
    return padre.jefe ? `Su jefe superior será: ${padre.jefe}` : 'Esa área no tiene jefe designado todavía (vacante).';
  });

  /** Texto de cada opción de «Depende de»: el área y su jefe (o vacante). */
  protected etiquetaPadre(a: Area): string {
    return `${a.nombre}  ·  ${a.jefe ? `Jefe: ${a.jefe}` : 'vacante'}`;
  }

  constructor() {
    this.load();
  }

  /** Ids de todas las áreas que cuelgan, directa o indirectamente, de `id`. */
  private dependientesDe(id: number): Set<number> {
    const resultado = new Set<number>();
    const pendientes = [id];
    while (pendientes.length > 0) {
      const actual = pendientes.pop();
      for (const a of this.items()) {
        if (a.idAreaPadre === actual && !resultado.has(a.id)) {
          resultado.add(a.id);
          pendientes.push(a.id);
        }
      }
    }
    return resultado;
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
    this.form.reset({ nombre: '', jefeTexto: '', idAreaPadre: 0, estado: true });
    this.cargarTrabajadores();
    this.isModalOpen.set(true);
  }

  protected editar(a: Area): void {
    if (!this.permisos.editar()) return;
    this.editando.set(a);
    this.modalError.set('');
    this.form.reset({ nombre: a.nombre, jefeTexto: a.jefe ?? '', idAreaPadre: a.idAreaPadre ?? 0, estado: a.estado });
    this.cargarTrabajadores();
    this.isModalOpen.set(true);
  }

  protected eliminar(a: Area): void {
    if (!this.permisos.eliminar()) return;
    if (!confirm(`¿Eliminar el área "${a.nombre}" (${this.codigoDe(a)})? Esta acción no se puede deshacer.`)) return;
    this.areasService.delete(a.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => alert(errorMessage(err)),
    });
  }
  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected guardar(): void {
    if (this.isSaving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.modalError.set('Indique el nombre del área.');
    }
    const v = this.form.getRawValue();
    const actual = this.editando();
    const nombre = v.nombre.trim();
    const textoJefe = v.jefeTexto.trim();
    // El jefe o gerente se escribe o se elige, pero debe ser un trabajador registrado.
    const jefe = textoJefe ? this.trabajadores().find((x) => (x.nombre ?? '').trim().toLowerCase() === textoJefe.toLowerCase()) : undefined;
    if (textoJefe && !jefe) {
      return this.modalError.set('El jefe o gerente debe ser un trabajador de la lista. Escribe para buscarlo y elígelo.');
    }
    const idJefe = jefe?.id ?? 0;
    const idAreaPadre = Number(v.idAreaPadre);
    this.isSaving.set(true);
    const request$ = actual
      ? this.areasService.update(actual.id, { nombre, idJefe, idAreaPadre, estado: v.estado })
      : this.areasService.create({
          nombre,
          ...(idJefe > 0 ? { idJefe } : {}),
          ...(idAreaPadre > 0 ? { idAreaPadre } : {}),
          estado: v.estado,
        });
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