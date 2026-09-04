import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CentrosCostosDashboardService, CentroCostoItem, ResumenFinanciero } from './centros-costos-dashboard.service';

/* Componente Standalone Angular 17 para el Dashboard Situacional de Centros de Costos */
@Component({
  selector: 'app-centros-costos-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Encabezado del Dashboard Situacional -->
    <div class="dashboard-header">
      <div class="header-titles">
        <h1 class="page-title">Dashboard Situacional de Centros de Costos</h1>
        <p class="page-subtitle">Consolidado financiero en tiempo real: Presupuestos, Gastos, Pagos y Saldos</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" (click)="refreshData()">
          🔄 Actualizar Datos
        </button>
        <button class="btn btn-primary" (click)="exportSummary()">
          📊 Exportar Resumen
        </button>
      </div>
    </div>

    <!-- Contenedor Maestro-Detalle -->
    <div class="dashboard-grid">

      <!-- Panel Izquierdo: Lista de Centros de Costos -->
      <div class="card master-panel">
        <div class="card-header-flex">
          <h2 class="card-title">Centros de Costos</h2>
          <span class="badge badge-neutral">{{ filteredCentros.length }} Registros</span>
        </div>

        <!-- Buscador de Centro de Costos -->
        <div class="search-box">
          <input 
            type="text" 
            class="form-control" 
            placeholder="🔍 Buscar por código o nombre..." 
            [(ngModel)]="searchTerm" 
            (input)="onSearchChange()" 
          />
        </div>

        <!-- Lista de Centros de Costos -->
        <div class="list-container">
          <div 
            *ngFor="let item of filteredCentros" 
            class="list-item" 
            [class.active]="selectedCentro?.CodCentroCto === item.CodCentroCto" 
            (click)="selectCentro(item)"
          >
            <div class="item-top">
              <span class="item-code">{{ item.CodCentroCto }}</span>
              <span class="badge" [class.badge-success]="item.Estado === 'Activo'" [class.badge-warning]="item.Estado === 'En Proceso'" [class.badge-secondary]="item.Estado === 'Liquidado'">
                {{ item.Estado || 'Activo' }}
              </span>
            </div>
            <div class="item-name">{{ item.CentroCosto }}</div>
            <div class="item-sub">Empresa: {{ item.CodEmpresa || 'E1' }} | Cliente: {{ item.CodCliente || 'General' }}</div>
          </div>

          <div *ngIf="filteredCentros.length === 0" class="empty-state">
            No se encontraron centros de costos con la búsqueda especificada.
          </div>
        </div>
      </div>

      <!-- Panel Derecho: Resumen Financiero Consolidado -->
      <div class="detail-panel" *ngIf="selectedCentro">

        <!-- Encabezado del Centro Seleccionado -->
        <div class="card selected-header-card">
          <div class="selected-meta">
            <span class="tag-code">{{ selectedCentro.CodCentroCto }}</span>
            <span class="tag-client">Cliente: {{ selectedCentro.CodCliente || 'CLI-001' }}</span>
          </div>
          <h2 class="selected-title">{{ selectedCentro.CentroCosto }}</h2>
          <div class="selected-status">
            Estado Operativo: <strong>{{ selectedCentro.Estado || 'Activo' }}</strong>
          </div>
        </div>

        <!-- Spinner de Carga de Métricas -->
        <div *ngIf="loadingResumen" class="loading-box card">
          <p>⏳ Cargando resumen financiero consolidado...</p>
        </div>

        <ng-container *ngIf="!loadingResumen && resumen">

          <!-- Grilla de las 5 Tarjetas KPI Financieras -->
          <div class="kpi-grid">

            <!-- 1. Presupuesto Base -->
            <div class="card kpi-card kpi-base">
              <div class="kpi-icon">📌</div>
              <div class="kpi-content">
                <span class="kpi-label">Presupuesto Base</span>
                <h3 class="kpi-value">S/ {{ resumen.presupuestoBase | number:'1.2-2' }}</h3>
                <span class="kpi-hint">Costo directo + GG + Viáticos</span>
              </div>
            </div>

            <!-- 2. Presupuesto Comercial -->
            <div class="card kpi-card kpi-comercial">
              <div class="kpi-icon">📈</div>
              <div class="kpi-content">
                <span class="kpi-label">Presupuesto Comercial</span>
                <h3 class="kpi-value">S/ {{ resumen.presupuestoComercial | number:'1.2-2' }}</h3>
                <span class="kpi-hint">Monto adjudicado/contratado</span>
              </div>
            </div>

            <!-- 3. Pagos Realizados -->
            <div class="card kpi-card kpi-pagos">
              <div class="kpi-icon">💳</div>
              <div class="kpi-content">
                <span class="kpi-label">Pagos Realizados</span>
                <h3 class="kpi-value">S/ {{ resumen.pagosRealizados | number:'1.2-2' }}</h3>
                <span class="kpi-hint">Facturas y planillas abonadas</span>
              </div>
            </div>

            <!-- 4. Gastos Acumulados -->
            <div class="card kpi-card kpi-gastos">
              <div class="kpi-icon">📉</div>
              <div class="kpi-content">
                <span class="kpi-label">Gastos Acumulados</span>
                <h3 class="kpi-value">S/ {{ resumen.gastosAcumulados | number:'1.2-2' }}</h3>
                <span class="kpi-hint">Compras y caja ejecutada</span>
              </div>
            </div>

            <!-- 5. Saldo Actual (Destacado) -->
            <div class="card kpi-card kpi-saldo" [class.saldo-alert]="resumen.saldoActual < 0">
              <div class="kpi-icon">💰</div>
              <div class="kpi-content">
                <span class="kpi-label">Saldo Actual Disponible</span>
                <h3 class="kpi-value">S/ {{ resumen.saldoActual | number:'1.2-2' }}</h3>
                <span class="kpi-hint">Diferencia Presupuestal</span>
              </div>
            </div>

          </div>

          <!-- Barra de Progreso Presupuestal -->
          <div class="card progress-card">
            <div class="progress-header">
              <span class="progress-title">Nivel de Ejecución del Presupuesto Comercial</span>
              <span class="progress-percentage" [class.text-danger]="resumen.porcentajeEjecucion >= 100" [class.text-warning]="resumen.porcentajeEjecucion >= 80 && resumen.porcentajeEjecucion < 100">
                {{ resumen.porcentajeEjecucion }}% Ejecutado
              </span>
            </div>
            <div class="progress-track">
              <div 
                class="progress-fill" 
                [style.width.%]="resumen.porcentajeEjecucion > 100 ? 100 : resumen.porcentajeEjecucion"
                [class.bg-danger]="resumen.porcentajeEjecucion >= 100"
                [class.bg-warning]="resumen.porcentajeEjecucion >= 80 && resumen.porcentajeEjecucion < 100"
                [class.bg-success]="resumen.porcentajeEjecucion < 80"
              ></div>
            </div>
            <div class="progress-footer">
              <span>S/ 0.00</span>
              <span>Límite Comercial: S/ {{ resumen.presupuestoComercial | number:'1.2-2' }}</span>
            </div>
          </div>

          <!-- Desglose Financiero Detallado por Rubro -->
          <div class="card breakdown-card">
            <h3 class="card-title-sm">Desglose Consolidado por Fuente de Información</h3>
            
            <div class="breakdown-grid">
              <div class="breakdown-item">
                <div class="b-icon">🧾</div>
                <div class="b-info">
                  <span class="b-label">Facturas de Compra/Servicios</span>
                  <span class="b-sub">DocCompra (Proveedores)</span>
                </div>
                <span class="b-amount">S/ {{ (resumen.gastosFacturas || 0) | number:'1.2-2' }}</span>
              </div>

              <div class="breakdown-item">
                <div class="b-icon">💵</div>
                <div class="b-info">
                  <span class="b-label">Caja Chica y Egresos Retail</span>
                  <span class="b-sub">CajaEgresosRetail</span>
                </div>
                <span class="b-amount">S/ {{ (resumen.gastosCajaChica || 0) | number:'1.2-2' }}</span>
              </div>

              <div class="breakdown-item">
                <div class="b-icon">👷</div>
                <div class="b-info">
                  <span class="b-label">Planillas y Mano de Obra</span>
                  <span class="b-sub">PlanillaPago (Semanal)</span>
                </div>
                <span class="b-amount">S/ {{ (resumen.pagosPlanillas || 0) | number:'1.2-2' }}</span>
              </div>
            </div>
          </div>

        </ng-container>

      </div>

    </div>
  `,
  styles: [`
    /* Estilos del Dashboard Situacional (Basados en variables corporativas GLD) */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .page-title {
      font-size: 1.6rem;
      font-weight: 700;
      color: var(--text-main, #1f2321);
      margin-bottom: 4px;
    }

    .page-subtitle {
      font-size: 0.9rem;
      color: var(--text-muted, #64748b);
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    /* Grilla Principal */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 24px;
      align-items: start;
    }

    @media (max-width: 992px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Tarjeta Genérica */
    .card {
      background-color: var(--card-bg, #ffffff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: var(--radius-md, 10px);
      padding: 20px;
      box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05));
    }

    .card-header-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .card-title {
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--text-main, #1f2321);
    }

    .card-title-sm {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-main, #1f2321);
      margin-bottom: 16px;
    }

    /* Buscador */
    .search-box {
      margin-bottom: 16px;
    }

    .form-control {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-control:focus {
      border-color: var(--gld-green-primary, #5a9e80);
    }

    /* Lista Maestro */
    .list-container {
      max-height: 580px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .list-item {
      padding: 12px 14px;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: var(--radius-sm, 6px);
      cursor: pointer;
      background-color: #ffffff;
      transition: all 0.2s ease;
    }

    .list-item:hover {
      background-color: #f1f5f3;
      border-color: var(--gld-green-primary, #5a9e80);
    }

    .list-item.active {
      background-color: #e8f4ef;
      border-color: var(--gld-green-primary, #5a9e80);
      border-left: 4px solid var(--gld-green-primary, #5a9e80);
    }

    .item-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .item-code {
      font-weight: 700;
      font-size: 0.85rem;
      color: var(--gld-green-dark, #3b7a5e);
    }

    .item-name {
      font-weight: 600;
      font-size: 0.92rem;
      color: var(--text-main, #1f2321);
      margin-bottom: 4px;
    }

    .item-sub {
      font-size: 0.78rem;
      color: var(--text-muted, #64748b);
    }

    .empty-state {
      padding: 20px;
      text-align: center;
      color: var(--text-muted, #64748b);
      font-size: 0.88rem;
    }

    /* Panel Detalle */
    .detail-panel {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .selected-header-card {
      background: linear-gradient(135deg, #1f2321 0%, #2d312e 100%);
      color: #ffffff;
      border: none;
    }

    .selected-meta {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
    }

    .tag-code {
      background-color: var(--gld-green-primary, #5a9e80);
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.82rem;
    }

    .tag-client {
      background-color: rgba(255,255,255,0.15);
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 0.82rem;
    }

    .selected-title {
      font-size: 1.35rem;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .selected-status {
      font-size: 0.88rem;
      color: #b5b882;
    }

    .loading-box {
      text-align: center;
      padding: 40px;
      font-size: 1rem;
      color: var(--text-muted, #64748b);
    }

    /* Grilla KPI (5 Tarjetas) */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .kpi-card {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 16px;
      border-left: 4px solid var(--border-color, #e2e8f0);
    }

    .kpi-icon {
      font-size: 1.6rem;
      line-height: 1;
    }

    .kpi-label {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted, #64748b);
    }

    .kpi-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-main, #1f2321);
      margin: 4px 0;
    }

    .kpi-hint {
      font-size: 0.75rem;
      color: var(--text-muted, #64748b);
    }

    .kpi-base { border-left-color: #3b82f6; }
    .kpi-comercial { border-left-color: #b5b882; }
    .kpi-pagos { border-left-color: #10b981; }
    .kpi-gastos { border-left-color: #f59e0b; }
    .kpi-saldo { 
      border-left-color: var(--gld-green-primary, #5a9e80); 
      background-color: #f4fbf7;
    }

    .saldo-alert {
      border-left-color: #ef4444;
      background-color: #fef2f2;
    }

    /* Barra de Progreso */
    .progress-card {
      padding: 20px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .progress-track {
      height: 12px;
      background-color: #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      border-radius: 6px;
      transition: width 0.4s ease;
    }

    .progress-footer {
      display: flex;
      justify-content: space-between;
      font-size: 0.78rem;
      color: var(--text-muted, #64748b);
    }

    .bg-success { background-color: var(--gld-green-primary, #5a9e80); }
    .bg-warning { background-color: #b5b882; }
    .bg-danger { background-color: #ef4444; }

    .text-danger { color: #ef4444; }
    .text-warning { color: #b5b882; }

    /* Desglose */
    .breakdown-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .breakdown-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background-color: #f8faf9;
      border-radius: var(--radius-sm, 6px);
      border: 1px solid var(--border-color, #e2e8f0);
    }

    .b-icon {
      font-size: 1.3rem;
      margin-right: 12px;
    }

    .b-info {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }

    .b-label {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-main, #1f2321);
    }

    .b-sub {
      font-size: 0.78rem;
      color: var(--text-muted, #64748b);
    }

    .b-amount {
      font-weight: 700;
      font-size: 1rem;
      color: var(--text-main, #1f2321);
    }

    /* Botones */
    .btn {
      padding: 10px 18px;
      border-radius: var(--radius-sm, 6px);
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
      border: none;
      transition: background-color 0.2s ease;
    }

    .btn-primary {
      background-color: var(--gld-green-primary, #5a9e80);
      color: #ffffff;
    }

    .btn-primary:hover {
      background-color: var(--gld-green-dark, #3b7a5e);
    }

    .btn-outline {
      background-color: transparent;
      border: 1px solid var(--border-color, #e2e8f0);
      color: var(--text-main, #1f2321);
    }

    .btn-outline:hover {
      background-color: #f1f5f3;
    }

    /* Badges */
    .badge {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-neutral { background-color: #e2e8f0; color: #334155; }
    .badge-success { background-color: #d1fae5; color: #065f46; }
    .badge-warning { background-color: #fef3c7; color: #92400e; }
    .badge-secondary { background-color: #f1f5f9; color: #475569; }
  `]
})
export class CentrosCostosDashboardComponent implements OnInit {
  centros: CentroCostoItem[] = [];
  filteredCentros: CentroCostoItem[] = [];
  selectedCentro: CentroCostoItem | null = null;
  resumen: ResumenFinanciero | null = null;

  searchTerm: string = '';
  loadingResumen: boolean = false;

  constructor(private dashboardService: CentrosCostosDashboardService) {}

  ngOnInit(): void {
    this.loadCentros();
  }

  loadCentros(): void {
    this.dashboardService.getCentrosCostos().subscribe({
      next: (data) => {
        this.centros = data;
        this.filteredCentros = data;
        if (data.length > 0) {
          this.selectCentro(data[0]);
        }
      },
      error: (err) => {
        console.error('Error al cargar centros de costos:', err);
      }
    });
  }

  onSearchChange(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredCentros = this.centros;
    } else {
      this.filteredCentros = this.centros.filter(c =>
        c.CodCentroCto.toLowerCase().includes(term) ||
        c.CentroCosto.toLowerCase().includes(term)
      );
    }
  }

  selectCentro(item: CentroCostoItem): void {
    this.selectedCentro = item;
    this.loadingResumen = true;
    this.dashboardService.getResumenFinanciero(item.CodCentroCto).subscribe({
      next: (res) => {
        this.resumen = res;
        this.loadingResumen = false;
      },
      error: (err) => {
        console.error('Error al cargar resumen financiero:', err);
        this.loadingResumen = false;
      }
    });
  }

  refreshData(): void {
    if (this.selectedCentro) {
      this.selectCentro(this.selectedCentro);
    } else {
      this.loadCentros();
    }
  }

  exportSummary(): void {
    if (!this.selectedCentro || !this.resumen) return;
    alert(`Exportando resumen consolidado de ${this.selectedCentro.CodCentroCto} - ${this.selectedCentro.CentroCosto}`);
  }
}
