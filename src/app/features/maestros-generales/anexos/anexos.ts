import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
import { Anexo, AnexoQuery, SelectOption, TipoAnexo } from './interfaces/anexos.interface';
import { AnexosService } from './anexos.service';

@Component({
  selector: 'app-anexos',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, ModalComponent],
  templateUrl: './anexos.html',
  styleUrl: './anexos.css',
})
export class AnexosComponent {
  private readonly service = inject(AnexosService);

  readonly tiposAnexo: TipoAnexo[] = ['Proveedor', 'Cliente', 'Trabajador'];

  columns: DataTable[] = [
    { label: 'ID', width: '60px' },
    { label: 'Tipo' },
    { label: 'Especialidad' },
    { label: 'Tipo Doc' },
    { label: 'N° Documento' },
    { label: 'Anexo' },
    { label: 'Nombre Comercial' },
    { label: 'Contacto' },
    { label: 'Estado', align: 'center', width: '90px' },
    { label: 'Acciones', align: 'center', width: '150px' },
  ];

  // Listado
  anexos = signal<Anexo[]>([]);
  loading = signal<boolean>(false);
  currentPage = signal<number>(1);
  pageSize = signal<number>(20);
  totalRecords = signal<number>(0);

  // Filtros
  tipoAnexoFilter = signal<TipoAnexo | ''>('');
  anexoFilter = signal<string>('');
  estadoFilter = signal<boolean | null>(null);

  // Modal formulario
  showModal = signal<boolean>(false);
  saving = signal<boolean>(false);
  editingId = signal<number | null>(null);
  formData: Anexo = this.emptyForm();

  // Modal detalle
  showDetail = signal<boolean>(false);
  detail = signal<Anexo | null>(null);

  // Combos
  especialidades = signal<SelectOption[]>([]);
  tiposDocIde = signal<SelectOption[]>([]);
  especialidadesForm = signal<SelectOption[]>([]);
  tiposDocIdeForm = signal<SelectOption[]>([]);

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / this.pageSize())));

  private searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.loadCombos();
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.getAll(this.buildQuery()).subscribe({
      next: (res) => {
        this.anexos.set(res.data ?? []);
        this.totalRecords.set(res.total ?? 0);
        this.currentPage.set(res.page ?? 1);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar anexos:', err);
        this.anexos.set([]);
        this.totalRecords.set(0);
        this.loading.set(false);
      },
    });
  }

  private buildQuery(): AnexoQuery {
    return {
      page: this.currentPage(),
      pageSize: this.pageSize(),
      tipoAnexo: this.tipoAnexoFilter() || undefined,
      Anexo: this.anexoFilter().trim() || undefined,
      estado: this.estadoFilter() ?? undefined,
    };
  }

  onSearch(value: string) {
    this.anexoFilter.set(value);
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage.set(1);
      this.load();
    }, 350);
  }

  onFilterChange() {
    this.currentPage.set(1);
    this.load();
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load();
  }

  resetFilters() {
    this.tipoAnexoFilter.set('');
    this.anexoFilter.set('');
    this.estadoFilter.set(null);
    this.currentPage.set(1);
    this.load();
  }

  openCreate() {
    this.editingId.set(null);
    this.formData = this.emptyForm();
    this.saving.set(false);
    this.showModal.set(true);
    this.loadCombosForm(null);
  }

  openEdit(item: Anexo) {
    this.editingId.set(item.id);
    this.formData = { ...this.emptyForm(), ...item };
    this.saving.set(false);
    this.showModal.set(true);
    this.loadCombosForm(item.tipoAnexo);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
  }

  openDetail(item: Anexo) {
    this.detail.set(item);
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.detail.set(null);
  }

  onTipoAnexoChange(tipo: TipoAnexo | null) {
    this.formData.tipoAnexo = tipo;
    this.formData.AnexoEspecialidadId = null;
    this.formData.AnexoTipoDocIdeId = null;
    this.loadCombosForm(tipo);
  }

  saveAnexo() {
    const anexo = (this.formData.Anexo ?? '').trim();
    if (!anexo) {
      alert('El campo "Anexo" es obligatorio.');
      return;
    }

    const payload: Partial<Anexo> = {
      tipoAnexo: this.formData.tipoAnexo || null,
      AnexoEspecialidadId: this.formData.AnexoEspecialidadId || null,
      AnexoTipoDocIdeId: this.formData.AnexoTipoDocIdeId || null,
      NumeroDocIde: this.formData.NumeroDocIde || null,
      Anexo: anexo,
      NombreComercial: this.formData.NombreComercial || null,
      Direccion: this.formData.Direccion || null,
      Contacto: this.formData.Contacto || null,
      Telefono: this.formData.Telefono || null,
      Correo: this.formData.Correo || null,
      estado: this.formData.estado,
    };

    this.saving.set(true);
    const id = this.editingId();
    const request$ = id !== null ? this.service.update(id, payload) : this.service.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: (err) => {
        console.error('Error al guardar anexo:', err);
        this.saving.set(false);
        alert(
          (id !== null ? 'Error al actualizar: ' : 'Error al crear: ') +
            (err.error?.message || err.message),
        );
      },
    });
  }

  deleteAnexo(item: Anexo) {
    const label = item.Anexo || item.NombreComercial || `ID ${item.id}`;
    if (!confirm(`¿Eliminar el anexo "${label}"? Esta acción no se puede deshacer.`)) return;
    this.service.delete(item.id).subscribe({
      next: () => this.load(),
      error: (err) => alert('Error al eliminar: ' + (err.error?.message || err.message)),
    });
  }

  nombreEspecialidad(id: number | null): string {
    if (id === null || id === undefined) return '—';
    return this.especialidades().find((e) => e.id === id)?.nombre ?? `ID ${id}`;
  }

  nombreTipoDoc(id: number | null): string {
    if (id === null || id === undefined) return '—';
    return this.tiposDocIde().find((t) => t.id === id)?.nombre ?? `ID ${id}`;
  }

  private loadCombos() {
    this.service.getEspecialidadesSelect().subscribe({
      next: (res) => this.especialidades.set(Array.isArray(res) ? res : []),
      error: () => this.especialidades.set([]),
    });
    this.service.getTiposDocIdeSelect().subscribe({
      next: (res) => this.tiposDocIde.set(Array.isArray(res) ? res : []),
      error: () => this.tiposDocIde.set([]),
    });
  }

  private loadCombosForm(tipoAnexo: TipoAnexo | null) {
    this.service.getEspecialidadesSelect(tipoAnexo ?? undefined).subscribe({
      next: (res) => this.especialidadesForm.set(Array.isArray(res) ? res : []),
      error: () => this.especialidadesForm.set([]),
    });
    this.service.getTiposDocIdeSelect(tipoAnexo ?? undefined).subscribe({
      next: (res) => this.tiposDocIdeForm.set(Array.isArray(res) ? res : []),
      error: () => this.tiposDocIdeForm.set([]),
    });
  }

  private emptyForm(): Anexo {
    return {
      id: 0,
      tipoAnexo: null,
      AnexoEspecialidadId: null,
      AnexoTipoDocIdeId: null,
      NumeroDocIde: null,
      Anexo: null,
      NombreComercial: null,
      Direccion: null,
      Contacto: null,
      Telefono: null,
      Correo: null,
      estado: true,
    };
  }
}
