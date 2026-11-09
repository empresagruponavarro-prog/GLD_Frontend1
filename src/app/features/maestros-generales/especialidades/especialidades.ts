import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { mensajeError } from '@shared/utils/errores-http';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ExportarBotonesComponent } from '../../../shared/components/exportar-botones/exportar-botones';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
import { traerTodasLasPaginas, type DatosExportacion } from '../../../shared/utils/exportar';
import { valorDeEvento } from '../../../shared/utils/eventos';
import { Especialidad, TipoAnexo } from './interfaces/especialidades.interface';
import { EspecialidadesService } from './especialidades.service';

@Component({
  selector: 'app-especialidades',
  standalone: true,
  imports: [ReactiveFormsModule, DataTableComponent, ModalComponent, ExportarBotonesComponent],
  templateUrl: './especialidades.html',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EspecialidadesComponent {
  private readonly service = inject(EspecialidadesService);
  protected readonly permisos = permisosDePantalla('maestros.generales');

  protected readonly columns: DataTable[] = [
    { label: 'ID', width: '100px' },
    { label: 'Tipo de Anexo', width: '180px' },
    { label: 'Descripción' },
    { label: 'Acciones', width: '130px', align: 'center' },
  ];

  // Listado y filtros
  protected readonly items = signal<readonly Especialidad[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly descripcionFiltro = signal('');
  protected readonly tipoAnexoFiltro = signal<TipoAnexo | 'TODOS'>('TODOS');
  protected readonly isLoading = signal(false);
  protected readonly listError = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  // Modal
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly editando = signal<Especialidad | null>(null);

  protected readonly form = new FormGroup({
    tipoAnexo: new FormControl<TipoAnexo>('Proveedor', { nonNullable: true, validators: [Validators.required] }),
    descripcion: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
  });

  readonly exportar = async (): Promise<DatosExportacion> => {
    const query = {
      tipoAnexo: this.tipoAnexoFiltro() === 'TODOS' ? undefined : (this.tipoAnexoFiltro() as TipoAnexo),
      descripcion: this.descripcionFiltro().trim() || undefined,
    };
    const filas = await traerTodasLasPaginas((page, pageSize) => this.service.getAll({ ...query, page, pageSize }));
    return {
      nombre: 'Especialidades',
      columnas: ['ID', 'Tipo de Anexo', 'Descripción'],
      filas: filas.map((e) => [e.id, e.tipoAnexo ?? 'Sin anexo', e.descripcion ?? '']),
    };
  };

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.listError.set('');
    this.service
      .getAll({
        page: this.page(),
        pageSize: this.pageSize(),
        tipoAnexo: this.tipoAnexoFiltro() === 'TODOS' ? undefined : (this.tipoAnexoFiltro() as TipoAnexo),
        descripcion: this.descripcionFiltro().trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data ?? []);
          this.total.set(res.total ?? 0);
          this.isLoading.set(false);
        },
        error: (err: unknown) => {
          this.items.set([]);
          this.total.set(0);
          this.listError.set(mensajeError(err));
          this.isLoading.set(false);
        },
      });
  }

  // Filtros
  protected onSearch(event: Event): void {
    this.descripcionFiltro.set(valorDeEvento(event));
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.irAPagina(1), 350);
  }

  protected onTipoAnexoChange(event: Event): void {
    const val = valorDeEvento(event) as TipoAnexo | 'TODOS';
    this.tipoAnexoFiltro.set(val);
    this.irAPagina(1);
  }

  protected restablecer(): void {
    this.descripcionFiltro.set('');
    this.tipoAnexoFiltro.set('TODOS');
    this.irAPagina(1);
  }

  protected irAPagina(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected cambiarTamano(size: number): void {
    this.pageSize.set(size);
    this.irAPagina(1);
  }

  // CRUD
  protected nueva(): void {
    if (!this.permisos.crear()) return;
    this.editando.set(null);
    this.modalError.set('');
    this.form.reset({ tipoAnexo: 'Proveedor', descripcion: '' });
    this.isModalOpen.set(true);
  }

  protected editar(item: Especialidad): void {
    if (!this.permisos.editar()) return;
    this.editando.set(item);
    this.modalError.set('');
    this.form.reset({
      tipoAnexo: item.tipoAnexo ?? 'Proveedor',
      descripcion: item.descripcion ?? '',
    });
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.modalError.set('Indique la descripción de la especialidad.');
    }
    const v = this.form.getRawValue();
    const payload = {
      tipoAnexo: v.tipoAnexo,
      descripcion: v.descripcion.trim().toUpperCase(),
    };
    const actual = this.editando();
    this.isSaving.set(true);
    const request$: Observable<Especialidad> = actual
      ? this.service.update(actual.id, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeModal();
        this.load();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.modalError.set(mensajeError(err));
      },
    });
  }

  protected eliminar(item: Especialidad): void {
    if (!this.permisos.eliminar()) return;
    if (!confirm(`¿Eliminar la especialidad "${item.descripcion}" (ID: ${item.id})? Esta acción no se puede deshacer.`)) return;
    this.service.delete(item.id).subscribe({
      next: () => this.load(),
      error: (err: unknown) => alert(mensajeError(err)),
    });
  }
}
