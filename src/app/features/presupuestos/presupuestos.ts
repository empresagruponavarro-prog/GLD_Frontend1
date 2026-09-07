import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface PresupuestoPrincipal {
  id: number;
  IdPresupuesto: string;
  CodCentroCto?: string;
  CodEmpresa?: string;
  IdPeriodo?: string;
  Version?: string;
  TipoPpto?: string;
  Proyecto?: string;
  Concepto?: string;
  CodCentroCtoPrincipal?: string;
  FechaRequerimiento?: string;
  FechaEntrega?: string;
  CostoDirecto?: number;
  GGPorcentaje?: number;
  GastosGenerales?: number;
  UtiliPorcentaje?: number;
  Utilidad?: number;
  Viaticos?: number;
  DsctoComercial?: number;
  SubTotalSinIGV?: number;
  IGV?: number;
  Total?: number;
  Estado?: string;
  Comentarios?: string;
  Usuario?: string;
  FechaCreacion?: string;
}

interface PaginatedResponse {
  data: PresupuestoPrincipal[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Component({
  selector: 'app-presupuestos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './presupuestos.html'
})
export class PresupuestosComponent {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/presupuestos';

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

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / this.pageSize())));

  pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) range.unshift(-1);
    if (current + delta < total - 1) range.push(-1);

    if (total > 1) {
      range.unshift(1);
      if (total > 1) range.push(total);
    } else if (total === 1) {
      return [1];
    }

    // Simplify: just show nearby pages
    const nearby: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
      nearby.push(i);
    }
    return nearby;
  });

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
    const params: any = {
      page: this.currentPage().toString(),
      pageSize: this.pageSize().toString(),
    };

    const searchVal = this.search();
    if (searchVal) {
      params.search = searchVal;
    }

    this.http.get<PaginatedResponse>(this.apiUrl, { params }).subscribe({
      next: (res) => {
        this.presupuestos.set(res.data || []);
        this.totalRecords.set(res.total || 0);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar presupuestos:', err);
        // Fallback: maybe API returns array directly
        if (Array.isArray(err)) {
          this.presupuestos.set(err);
          this.totalRecords.set(err.length);
        }
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
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadData();
    }
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
    this.editingId.set(item.IdPresupuesto);
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
      this.http.patch<PresupuestoPrincipal>(`${this.apiUrl}/${id}`, this.formData).subscribe({
        next: () => { this.closeModal(); this.loadData(); },
        error: (err) => alert('Error al actualizar: ' + (err.error?.message || err.message))
      });
    } else {
      this.http.post<PresupuestoPrincipal>(this.apiUrl, this.formData).subscribe({
        next: () => { this.closeModal(); this.loadData(); },
        error: (err) => alert('Error al crear: ' + (err.error?.message || err.message))
      });
    }
  }

  delete(id: string) {
    if (confirm(`¿Eliminar el Presupuesto "${id}"? Esta acción no se puede deshacer.`)) {
      this.http.delete(`${this.apiUrl}/${id}`).subscribe({
        next: () => this.loadData(),
        error: (err) => alert('Error al eliminar: ' + (err.error?.message || err.message))
      });
    }
  }
}
