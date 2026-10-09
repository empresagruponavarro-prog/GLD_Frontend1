import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
import { AlmacenService } from '../almacen.service';
import { Almacen } from '../almacen.models';
import { errorMessage } from '../almacen.utils';
import { EmpresasService } from '../../administration/empresas/empresas.service';
import { Empresa } from '../../administration/empresas/interfaces';

@Component({
  selector: 'app-almacenes',
  standalone: true,
  imports: [ReactiveFormsModule, DataTableComponent, ModalComponent],
  templateUrl: './almacenes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlmacenesComponent {
  private readonly service = inject(AlmacenService);
  private readonly empresasService = inject(EmpresasService);

  protected readonly columns: DataTable[] = [
    { label: 'ID', width: '60px' },
    { label: 'Empresa', width: '200px' },
    { label: 'Código', width: '160px' },
    { label: 'Nombre' },
    { label: 'Estado', align: 'center', width: '100px' },
    { label: 'Acciones', align: 'center', width: '120px' },
  ];

  protected readonly items = signal<Almacen[]>([]);
  protected readonly empresas = signal<Empresa[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly isLoading = signal(false);
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly formError = signal('');

  protected readonly form = new FormGroup({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    estado: new FormControl(true, { nonNullable: true }),
    id_empresa: new FormControl<number | null>(null),
  });

  constructor() {
    this.load();
    this.empresasService.getAll().subscribe(res => this.empresas.set(res));
  }

  protected load(): void {
    this.isLoading.set(true);
    this.service.getAlmacenes({ page: this.page(), pageSize: this.pageSize() }).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.total.set(res.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.total.set(0);
        this.isLoading.set(false);
      },
    });
  }

  protected getEmpresaNombre(id_empresa: number | null): string {
    if (!id_empresa) return '—';
    const emp = this.empresas().find(e => e.id === id_empresa);
    return emp ? (emp.razon_social || emp.RazonSocial || 'Desconocida') : '—';
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({ codigo: '', nombre: '', estado: true, id_empresa: null });
    this.formError.set('');
    this.isModalOpen.set(true);
  }

  protected openEdit(item: Almacen): void {
    this.editingId.set(item.id);
    this.form.reset({ codigo: item.codigo, nombre: item.nombre, estado: item.estado, id_empresa: item.id_empresa });
    this.formError.set('');
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Complete el código y el nombre.');
      return;
    }
    const value = this.form.getRawValue();
    const payload = { codigo: value.codigo.trim(), nombre: value.nombre.trim(), estado: value.estado, id_empresa: value.id_empresa };
    const id = this.editingId();
    this.isSaving.set(true);
    const request$ = id === null ? this.service.createAlmacen(payload) : this.service.updateAlmacen(id, payload);
    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeModal();
        this.load();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }

  protected deactivate(item: Almacen): void {
    if (!confirm(`¿Desactivar el almacén "${item.nombre}"? No debe tener stock.`)) return;
    this.service.deleteAlmacen(item.id).subscribe({
      next: () => this.load(),
      error: (err) => alert(errorMessage(err)),
    });
  }
}
