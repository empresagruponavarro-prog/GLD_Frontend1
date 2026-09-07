import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface CentroCosto {
  CodCentroCto: string;
  CodCentroCtoPrincipal?: string;
  CentroCostoPrincipal?: string;
  CentroCosto: string;
  Estado?: string;
  CodEmpresa?: string;
  Empresa?: string;
  IdPeriodo?: string;
  CodCliente?: string;
  Cliente?: string;
  PresupuestoEstado?: string;
  PresupuestoMonto?: string | number;
}

@Component({
  selector: 'app-centros-costos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './centros-costos.html'
})
export class CentrosCostosComponent {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/centros-costos';

  items = signal<CentroCosto[]>([]);
  loading = signal<boolean>(false);
  showModal = signal<boolean>(false);
  editingCod = signal<string | null>(null);
  search = signal<string>('');
  catalogos = signal<{empresas: string[], clientes: string[]}>({ empresas: [], clientes: [] });

  empresasList = [
    { id: 'E1', nombre: 'Grupo Navarro SAC' },
    { id: 'E2', nombre: 'Hermes' },
    { id: 'E3', nombre: 'GLD Servicios Generales EIRL' },
    { id: 'E4', nombre: 'Consorcio Aruma' }
  ];

  clientesList = [
    { id: 'CLI-001', nombre: 'SEDAPAL' },
    { id: '5ef24aa7', nombre: 'Cliente Retail SA' },
    { id: '34689840', nombre: 'Constructora del Norte' },
    { id: '626d2014', nombre: 'Inmobiliaria Central' },
    { id: '5fa9c9b0', nombre: 'Proyectos Urbanos' }
  ];

  onEmpresaChange() {
    const found = this.empresasList.find(e => e.id === this.formData.CodEmpresa);
    this.formData.Empresa = found ? found.nombre : '';
  }

  onClienteChange() {
    const found = this.clientesList.find(c => c.id === this.formData.CodCliente);
    this.formData.Cliente = found ? found.nombre : '';
  }


  // Paginación
  currentPage = signal<number>(1);
  pageSize = signal<number>(15);

  formData: CentroCosto = this.emptyForm();

  filteredItems = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.items();
    return this.items().filter(c =>
      (c.CodCentroCto || '').toLowerCase().includes(q) ||
      (c.CentroCosto || '').toLowerCase().includes(q) ||
      (c.Empresa || c.CodEmpresa || '').toLowerCase().includes(q) ||
      (c.Cliente || c.CodCliente || '').toLowerCase().includes(q)
    );
  });

  totalPages = computed(() => Math.ceil(this.filteredItems().length / this.pageSize()));

  pagedItems = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });

  pages = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  constructor() {
    this.load();
    this.http.get<any>(this.apiUrl + '/catalogos-filtros').subscribe(data => {
      this.catalogos.set({ empresas: data.empresas || [], clientes: data.clientes || [] });
    });
  }

  emptyForm(): CentroCosto {
    return {
      CodCentroCto: Math.random().toString(16).substring(2, 10),
      CodCentroCtoPrincipal: '',
      CentroCostoPrincipal: '',
      CentroCosto: '',
      Estado: 'ABIERTO',
      CodEmpresa: '',
      Empresa: '',
      IdPeriodo: '',
      CodCliente: '',
      Cliente: '',
      PresupuestoEstado: 'PENDIENTE',
      PresupuestoMonto: '',
    };
  }

  load() {
    this.loading.set(true);
    this.http.get<CentroCosto[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
        this.currentPage.set(1);
      },
      error: (err) => { console.error(err); this.loading.set(false); }
    });
  }

  onSearch(value: string) {
    this.search.set(value);
    this.currentPage.set(1);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  openModal() {
    this.editingCod.set(null);
    this.formData = this.emptyForm();
    this.showModal.set(true);
  }

  editModal(item: CentroCosto) {
    this.editingCod.set(item.CodCentroCto);
    this.formData = { ...item };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingCod.set(null);
  }

  save() {
    if (!this.formData.CodCentroCto || !this.formData.CentroCosto) {
      alert('El Código y Nombre del Centro de Costo son obligatorios.');
      return;
    }

    const cod = this.editingCod();
    if (cod) {
      this.http.patch<CentroCosto>(`${this.apiUrl}/${cod}`, this.formData).subscribe({
        next: () => { this.closeModal(); this.load(); },
        error: (err) => alert('Error al actualizar: ' + (err.error?.message || err.message))
      });
    } else {
      this.http.post<CentroCosto>(this.apiUrl, this.formData).subscribe({
        next: () => { this.closeModal(); this.load(); },
        error: (err) => alert('Error al crear: ' + (err.error?.message || err.message))
      });
    }
  }

  delete(cod: string) {
    if (confirm(`¿Eliminar el Centro de Costo "${cod}"? Esta acción no se puede deshacer.`)) {
      this.http.delete(`${this.apiUrl}/${cod}`).subscribe({
        next: () => this.load(),
        error: (err) => alert('Error al eliminar: ' + (err.error?.message || err.message))
      });
    }
  }
}
