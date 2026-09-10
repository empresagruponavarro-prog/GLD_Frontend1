import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CentrosCostosDashboardService } from './centros-costos-dashboard.service';
import { 
  CentroCostoItem, 
  ResumenFinanciero, 
  ConteoEstados, 
  CatalogosFiltros 
} from './interfaces';

/* Componente Standalone Angular para el Dashboard de Centros de Costos */
@Component({
  selector: 'app-centros-costos-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './centros-costos-dashboard.html',
  styleUrl: './centros-costos-dashboard.css'
})
export class CentrosCostosDashboardComponent implements OnInit {
  centros: CentroCostoItem[] = [];
  selectedCentro: CentroCostoItem | null = null;
  resumen: ResumenFinanciero | null = null;

  stats: ConteoEstados = { total: 0, abiertos: 0, cerrados: 0 };
  catalogos: CatalogosFiltros = {
    empresas: [],
    periodos: [],
    clientes: [],
    estados: [],
    pptoEstados: []
  };

  // Valores de los filtros
  filtroEstado: string = 'ABIERTO'; // Por defecto ABIERTO según imagen 1
  filtroEmpresa: string = 'TODOS';
  filtroPeriodo: string = 'TODOS';
  filtroCliente: string = 'TODOS';
  filtroCentroCosto: string = '';
  filtroPptoEstado: string = 'TODOS';
  filtroSearch: string = '';

  loadingCentros: boolean = false;
  loadingResumen: boolean = false;
  isDetailOpen: boolean = false;

  // Paginación de la tabla
  currentPage: number = 1;
  pageSize: number = 20;

  private searchDebounceTimer: any;
  private ctoDebounceTimer: any;

  constructor(
    private dashboardService: CentrosCostosDashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCatalogos();
    this.loadStats();
    this.loadCentros();
  }

  loadCatalogos(): void {
    this.dashboardService.getCatalogosFiltros().subscribe({
      next: (cats) => {
        this.catalogos = cats;
        this.cdr.detectChanges();
      },
      error: (err) => console.warn('Error al cargar catálogos de filtros:', err)
    });
  }

  loadStats(): void {
    this.dashboardService.getConteoEstados().subscribe({
      next: (data) => {
        this.stats = data;
        this.cdr.detectChanges();
      },
      error: (err) => console.warn('Error al cargar conteo de estados:', err)
    });
  }

  loadCentros(): void {
    this.loadingCentros = true;
    this.dashboardService.getCentrosCostos({
      search: this.filtroSearch,
      estado: this.filtroEstado,
      empresa: this.filtroEmpresa,
      periodo: this.filtroPeriodo,
      cliente: this.filtroCliente,
      centroCosto: this.filtroCentroCosto,
      pptoEstado: this.filtroPptoEstado
    }).subscribe({
      next: (data) => {
        this.centros = data;
        this.loadingCentros = false;
        this.currentPage = 1;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar centros de costos:', err);
        this.loadingCentros = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFilterChange(tipo: string, valor: string): void {
    if (tipo === 'estado') this.filtroEstado = valor;
    this.loadCentros();
  }

  onFilterSelect(tipo: 'empresa' | 'periodo' | 'cliente' | 'estado' | 'pptoEstado', event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (tipo === 'empresa') this.filtroEmpresa = val;
    if (tipo === 'periodo') this.filtroPeriodo = val;
    if (tipo === 'cliente') this.filtroCliente = val;
    if (tipo === 'estado') this.filtroEstado = val;
    if (tipo === 'pptoEstado') this.filtroPptoEstado = val;
    this.loadCentros();
  }

  onSearchInput(event: Event): void {
    this.filtroSearch = (event.target as HTMLInputElement).value;
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.loadCentros();
    }, 350);
  }

  onCentroCostoInput(event: Event): void {
    this.filtroCentroCosto = (event.target as HTMLInputElement).value;
    clearTimeout(this.ctoDebounceTimer);
    this.ctoDebounceTimer = setTimeout(() => {
      this.loadCentros();
    }, 350);
  }

  clearSearch(): void {
    this.filtroSearch = '';
    this.loadCentros();
  }

  resetFilters(): void {
    this.filtroEstado = 'TODOS';
    this.filtroEmpresa = 'TODOS';
    this.filtroPeriodo = 'TODOS';
    this.filtroCliente = 'TODOS';
    this.filtroCentroCosto = '';
    this.filtroPptoEstado = 'TODOS';
    this.filtroSearch = '';
    this.loadCentros();
  }

  refreshData(): void {
    this.loadCatalogos();
    this.loadStats();
    this.loadCentros();
  }

  // Paginación calculada
  get totalPages(): number {
    return Math.ceil(this.centros.length / this.pageSize) || 1;
  }

  get pagedCentros(): CentroCostoItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.centros.slice(start, start + this.pageSize);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onPageSizeChange(event: Event): void {
    const size = parseInt((event.target as HTMLSelectElement).value, 10);
    this.pageSize = size;
    this.currentPage = 1;
  }

  // Interacción al hacer click en una fila
  openDetail(item: CentroCostoItem): void {
    this.selectedCentro = item;
    this.isDetailOpen = true;
    this.loadingResumen = true;
    this.resumen = null;

    this.dashboardService.getResumenFinanciero(item.CodCentroCto).subscribe({
      next: (data) => {
        this.resumen = data;
        this.loadingResumen = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar resumen financiero:', err);
        this.loadingResumen = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeDetail(): void {
    this.isDetailOpen = false;
  }

  exportAllTable(): void {
    if (this.centros.length === 0) {
      alert('No hay registros para exportar.');
      return;
    }

    const headers = ['Empresa', 'IdPeriodo', 'CodCliente (Nombre)', 'Centro de costo Principal', 'Codigo CTO', 'CentroCosto', 'Estado', 'PresupuestoEstado'];
    const rows = this.centros.map(c => [
      `"${(c.Empresa || c.CodEmpresa || '').replace(/"/g, '""')}"`,
      c.IdPeriodo || '',
      `"${(c.Cliente || c.CodCliente || '').replace(/"/g, '""')}"`,
      `"${(c.CentroCostoPrincipal || c.CodCentroCtoPrincipal || '').replace(/"/g, '""')}"`,
      c.CodCentroCto,
      `"${(c.CentroCosto || '').replace(/"/g, '""')}"`,
      c.Estado || '',
      c.PresupuestoEstado || ''
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Centros_de_Costos_Filtrados.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportSummary(): void {
    if (!this.selectedCentro || !this.resumen) return;

    const c = this.selectedCentro;
    const r = this.resumen;

    const csvRows = [
      ['INFORME GERENCIAL - RESUMEN FINANCIERO DE CENTRO DE COSTOS'],
      ['Sistema GLD Arquitectura'],
      ['Fecha de Emisión', new Date().toLocaleString('es-PE')],
      [''],
      ['CÓDIGO DE CENTRO', c.CodCentroCto],
      ['CENTRO DE COSTO', `"${c.CentroCosto.replace(/"/g, '""')}"`],
      ['CLIENTE', `"${(c.Cliente || c.CodCliente || 'General').replace(/"/g, '""')}"`],
      ['EMPRESA', c.Empresa || c.CodEmpresa || 'E1'],
      ['PERIODO', c.IdPeriodo || '-'],
      ['ESTADO OPERATIVO', c.Estado || 'ABIERTO'],
      [''],
      ['MÉTRICA FINANCIERA', 'MONTO (S/)'],
      ['Presupuesto Base (Costo Directo + GG + Viáticos)', r.presupuestoBase.toFixed(2)],
      ['Presupuesto Comercial (Contratado)', r.presupuestoComercial.toFixed(2)],
      ['Pagos Realizados (Facturas y Planillas)', r.pagosRealizados.toFixed(2)],
      ['Gastos Acumulados (Compras y Caja Chica)', r.gastosAcumulados.toFixed(2)],
      ['Saldo Actual Disponible', r.saldoActual.toFixed(2)],
      ['Porcentaje de Ejecución (%)', `${r.porcentajeEjecucion}%`],
      [''],
      ['DESGLOSE POR FUENTE DE INFORMACIÓN', 'MONTO (S/)'],
      ['Facturas de Compra y Servicios (DocCompra)', (r.gastosFacturas || 0).toFixed(2)],
      ['Caja Chica y Egresos (CajaEgresosRetail)', (r.gastosCajaChica || 0).toFixed(2)],
      ['Planillas de Contratistas (PlanillaPago)', (r.pagosPlanillas || 0).toFixed(2)],
    ];

    const csvContent = '\uFEFF' + csvRows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Resumen_Financiero_${c.CodCentroCto}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
