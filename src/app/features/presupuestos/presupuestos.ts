import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataTable } from '../../shared/interfaces';
import { PresupuestosService, PresupuestoPrincipal, PaginatedResponse } from './presupuestos.service';

@Component({
  selector: 'app-presupuestos',
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './presupuestos.html'
})
export class PresupuestosComponent {
  private presupuestosService = inject(PresupuestosService);

  columns: DataTable[] = [
    { label: 'ID Presupuesto' },
    { label: 'Proyecto' },
    { label: 'Centro Costo' },
    { label: 'Empresa' },
    { label: 'Tipo' },
    { label: 'Costo Directo' },
    { label: 'Total' },
    { label: 'Periodo' },
    { label: 'Estado' },
    { label: 'Acciones' }
  ];

  presupuestos = signal<PresupuestoPrincipal[]>([]);
  loading = signal<boolean>(false);
  search = signal<string>('');
  searchInput = '';
  
  showModal = signal<boolean>(false);
  editingId = signal<string | null>(null);
  
  formData: Partial<PresupuestoPrincipal> = this.emptyForm();

  // Paginación
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalRecords = signal<number>(0);

  constructor() {
    this.loadData();
  }

  emptyForm(): Partial<PresupuestoPrincipal> {
    return {
      IdPresupuesto: '',
      Proyecto: '',
      CodEmpresa: '',
      CodCentroCto: '',
      IdPeriodo: '',
      TipoPpto: 'OBRA',
      CostoDirecto: 0,
      GGPorcentaje: 0,
      UtiliPorcentaje: 0,
      Viaticos: 0,
      DsctoComercial: 0,
      Estado: 'PENDIENTE',
      Comentarios: ''
    };
  }

  loadData() {
    this.loading.set(true);

    this.presupuestosService.getPresupuestos(
      this.currentPage(),
      this.pageSize(),
      this.search()
    ).subscribe({
      next: (res) => {
        if ('data' in res) {
          const paginated = res as PaginatedResponse;
          this.presupuestos.set(paginated.data || []);
          this.totalRecords.set(paginated.total || 0);
        } else if (Array.isArray(res)) {
          this.presupuestos.set(res);
          this.totalRecords.set(res.length);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar presupuestos:', err);
        this.loading.set(false);
      }
    });
  }

  onSearch() {
    this.search.set(this.searchInput);
    this.currentPage.set(1);
    this.loadData();
  }

  clearSearch() {
    this.searchInput = '';
    this.search.set('');
    this.currentPage.set(1);
    this.loadData();
  }

  goToPage(page: number) {
    this.currentPage.set(page);
    this.loadData();
  }

  onPageSizeChange(newSize: any) {
    this.pageSize.set(Number(newSize));
    this.currentPage.set(1);
    this.loadData();
  }

  badgeClass(estado?: string): string {
    if (!estado) return 'badge-secondary';
    const s = estado.toUpperCase();
    if (s === 'APROBADO' || s === 'ACTIVO') return 'badge-success';
    if (s === 'PENDIENTE') return 'badge-warning';
    if (s === 'RECHAZADO' || s === 'ANULADO') return 'badge-danger';
    if (s === 'EN REVISIÓN' || s === 'EN REVISION') return 'badge-info';
    return 'badge-secondary';
  }

  openModal() {
    this.editingId.set(null);
    this.formData = this.emptyForm();
    this.showModal.set(true);
  }

  editModal(item: PresupuestoPrincipal) {
    this.editingId.set(String(item.IdPresupuesto));
    this.formData = { ...item };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
  }

  save() {
    if (!this.formData.IdPresupuesto) {
      alert('El ID de Presupuesto es obligatorio.');
      return;
    }

    const id = this.editingId();
    if (id) {
      this.presupuestosService.updatePresupuesto(id, this.formData).subscribe({
        next: () => { this.closeModal(); this.loadData(); },
        error: (err) => alert('Error al actualizar: ' + (err.error?.message || err.message))
      });
    } else {
      this.presupuestosService.createPresupuesto(this.formData).subscribe({
        next: () => { this.closeModal(); this.loadData(); },
        error: (err) => alert('Error al crear: ' + (err.error?.message || err.message))
      });
    }
  }

  delete(id: string | number) {
    const idStr = String(id);
    if (confirm(`¿Eliminar el Presupuesto "${idStr}"? Esta acción no se puede deshacer.`)) {
      this.presupuestosService.deletePresupuesto(idStr).subscribe({
        next: () => this.loadData(),
        error: (err) => alert('Error al eliminar: ' + (err.error?.message || err.message))
      });
    }
  }
}
