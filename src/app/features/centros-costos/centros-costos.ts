import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { ModalComponent } from '../../shared/components/modal/modal';
import { DataTable } from '../../shared/interfaces';
import { CentroCosto } from './interfaces';
import { CentrosCostosService } from './centros-costos.service';

@Component({
  selector: 'app-centros-costos',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, ModalComponent],
  templateUrl: './centros-costos.html'
})
export class CentrosCostosComponent {
  private readonly router = inject(Router);

  columns: DataTable[] = [
    { label: 'Centro de Costo' },
    { label: 'Empresa' },
    { label: 'Cliente' },
    { label: 'CC Principal' },
    { label: 'Fecha Inicio' },
    { label: 'Fin Programado' },
    { label: 'Estado' },
    { label: 'Ppto. Estado' },
    { label: 'Acciones' }
  ];
  private centrosCostosService = inject(CentrosCostosService);

  items = signal<CentroCosto[]>([]);
  loading = signal<boolean>(false);
  showModal = signal<boolean>(false);
  editingCod = signal<string | null>(null);
  search = signal<string>('');
  catalogos = signal<{empresas: string[], clientes: string[]}>({ empresas: [], clientes: [] });

  // Resumen financiero (solo en edición)
  resumen = signal<any>(null);
  resumenLoading = signal<boolean>(false);

  empresaFilter = signal<string>('');
  clienteFilter = signal<string>('');
  estadoFilter = signal<string>('');
  pptoEstadoFilter = signal<string>('');
  periodoFilter = signal<string>('');

  estadoOptions = ['ABIERTO', 'CERRADO', 'POR LIQUIDAR'];
  presupuestoEstadoOptions = [
    'PENDIENTE',
    'EN DESARROLLO',
    'EN REVISION',
    'APROBADO',
    'LIQUIDADO',
    'RECHAZADO PROPUESTA',
    'RECHAZADO POR DEMORA'
  ];

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

  periodOptions = computed(() => {
    const periods = new Set<string>();

    this.items().forEach((item) => {
      if (item.IdPeriodo) {
        periods.add(item.IdPeriodo);
      }
    });

    return Array.from(periods).sort((a, b) => b.localeCompare(a));
  });

  activeFiltersCount = computed(() => {
    return [
      this.empresaFilter(),
      this.clienteFilter(),
      this.estadoFilter(),
      this.pptoEstadoFilter(),
      this.periodoFilter()
    ].filter((value) => !!value).length;
  });

  filteredItems = computed(() => {
    const q = this.search().toLowerCase().trim();
    const selectedEmpresa = this.empresaFilter().trim().toLowerCase();
    const selectedCliente = this.clienteFilter().trim().toLowerCase();
    const selectedEstado = this.estadoFilter().trim().toUpperCase();
    const selectedPptoEstado = this.normalizeEstado(this.pptoEstadoFilter());
    const selectedPeriodo = this.periodoFilter().trim();

    return this.items().filter((item) => {
      const hayTexto = !q ||
        (item.CodCentroCto || '').toLowerCase().includes(q) ||
        (item.CentroCosto || '').toLowerCase().includes(q) ||
        (item.Empresa || item.CodEmpresa || '').toLowerCase().includes(q) ||
        (item.Cliente || item.CodCliente || '').toLowerCase().includes(q);

      const empresaMatch = !selectedEmpresa ||
        (item.CodEmpresa || '').toLowerCase() === selectedEmpresa ||
        (item.Empresa || '').toLowerCase() === selectedEmpresa;

      const clienteMatch = !selectedCliente ||
        (item.CodCliente || '').toLowerCase() === selectedCliente ||
        (item.Cliente || '').toLowerCase() === selectedCliente;

      const estadoMatch = !selectedEstado || (item.Estado || '').toUpperCase() === selectedEstado;
      const pptoEstadoMatch = !selectedPptoEstado || this.normalizeEstado(item.PresupuestoEstado) === selectedPptoEstado;
      const periodoMatch = !selectedPeriodo || (item.IdPeriodo || '').toString() === selectedPeriodo;

      return hayTexto && empresaMatch && clienteMatch && estadoMatch && pptoEstadoMatch && periodoMatch;
    });
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
    this.centrosCostosService.getCatalogosFiltros().subscribe({
      next: (data) => this.catalogos.set({ empresas: data.empresas || [], clientes: data.clientes || [] }),
      error: (err) => console.warn('Error al cargar catálogos:', err)
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
    this.centrosCostosService.getAll().subscribe({
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

  private normalizeEstado(value?: string): string {
    return (value || '')
      .trim()
      .toUpperCase()
      .replace(/[_\s]+/g, '');
  }

  getCentroCostoPrincipalLabel(item: CentroCosto): string {
    const principalCode = item.CodCentroCtoPrincipal || item.CentroCostoPrincipal;

    if (!principalCode) {
      return '—';
    }

    const principal = this.items().find((centro) => centro.CodCentroCto === principalCode);

    if (principal?.CentroCosto) {
      return principal.CentroCosto;
    }

    return item.CentroCostoPrincipal || item.CodCentroCtoPrincipal || '—';
  }

  resetFilters() {
    this.search.set('');
    this.empresaFilter.set('');
    this.clienteFilter.set('');
    this.estadoFilter.set('');
    this.pptoEstadoFilter.set('');
    this.periodoFilter.set('');
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
    // Cargar resumen financiero al editar
    this.resumen.set(null);
    this.resumenLoading.set(true);
    this.centrosCostosService.getResumenFinanciero(item.CodCentroCto).subscribe({
      next: (data) => { this.resumen.set(data); this.resumenLoading.set(false); },
      error: () => { this.resumenLoading.set(false); }
    });
  }

  closeModal() {
    this.showModal.set(false);
    this.editingCod.set(null);
    this.resumen.set(null);
  }

  save() {
    if (!this.formData.CodCentroCto || !this.formData.CentroCosto) {
      alert('El Código y Nombre del Centro de Costo son obligatorios.');
      return;
    }

    const cod = this.editingCod();
    if (cod) {
      this.centrosCostosService.update(cod, this.formData).subscribe({
        next: () => { this.closeModal(); this.load(); },
        error: (err) => alert('Error al actualizar: ' + (err.error?.message || err.message))
      });
    } else {
      this.centrosCostosService.create(this.formData).subscribe({
        next: () => { this.closeModal(); this.load(); },
        error: (err) => alert('Error al crear: ' + (err.error?.message || err.message))
      });
    }
  }

  delete(item: CentroCosto) {
    const nombre = item.CentroCosto || item.CodCentroCto;

    if (confirm(`¿Eliminar el Centro de Costo "${nombre}"? Esta acción no se puede deshacer.`)) {
      this.centrosCostosService.delete(item.CodCentroCto).subscribe({
        next: () => this.load(),
        error: (err) => alert('Error al eliminar: ' + (err.error?.message || err.message))
      });
    }
  }

  goToPresupuestos() {
    this.router.navigate(['/presupuestos']);
  }
}
