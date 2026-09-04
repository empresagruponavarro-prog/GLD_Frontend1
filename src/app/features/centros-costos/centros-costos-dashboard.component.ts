import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  CentrosCostosDashboardService, 
  CentroCostoItem, 
  ResumenFinanciero, 
  ConteoEstados,
  CatalogosFiltros 
} from './centros-costos-dashboard.service';

/* Componente Standalone Angular 22 para el Dashboard de Centros de Costos */
@Component({
  selector: 'app-centros-costos-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-wrapper">
      
      <!-- Encabezado del Dashboard -->
      <header class="dashboard-header">
        <div class="header-titles">
          <h1 class="page-title">Dashboard de Centros de Costos</h1>
          <p class="page-subtitle">Control presupuestal, estado operativo y consolidado financiero integral</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline" (click)="refreshData()" [disabled]="loadingCentros">
            <span [class.fa-spin]="loadingCentros">🔄</span> Actualizar
          </button>
          <button class="btn btn-primary" (click)="exportAllTable()">
            📥 Exportar Lista
          </button>
        </div>
      </header>

      <!-- Barra Horizontal de Filtros de Búsqueda (Uno al lado del otro) -->
      <div class="filters-horizontal-card card">
        
        <!-- Filtro Empresa -->
        <div class="filter-box col-empresa-filter">
          <label class="filter-title">Empresa</label>
          <select class="filter-select" [value]="filtroEmpresa" (change)="onFilterSelect('empresa', $event)">
            <option value="TODOS">Todas las Empresas</option>
            <option *ngFor="let emp of catalogos.empresas" [value]="emp">{{ emp }}</option>
          </select>
        </div>

        <!-- Filtro Periodo (Año) -->
        <div class="filter-box col-periodo-filter">
          <label class="filter-title">Periodo (Año)</label>
          <select class="filter-select" [value]="filtroPeriodo" (change)="onFilterSelect('periodo', $event)">
            <option value="TODOS">Todos</option>
            <option *ngFor="let per of catalogos.periodos" [value]="per">{{ per }}</option>
          </select>
        </div>

        <!-- Filtro Cliente (con nombre del cliente) -->
        <div class="filter-box col-cliente-filter">
          <label class="filter-title">Cliente</label>
          <select class="filter-select" [value]="filtroCliente" (change)="onFilterSelect('cliente', $event)">
            <option value="TODOS">Todos los Clientes</option>
            <option *ngFor="let cli of catalogos.clientes" [value]="cli">{{ cli }}</option>
          </select>
        </div>

        <!-- Filtro Centro de Costo (Nombre / Código) -->
        <div class="filter-box col-cto-filter">
          <label class="filter-title">Centro de Costo</label>
          <input 
            type="text" 
            class="filter-input" 
            placeholder="Filtrar por centro..." 
            [value]="filtroCentroCosto"
            (input)="onCentroCostoInput($event)"
          />
        </div>

        <!-- Filtro Estado -->
        <div class="filter-box col-estado-filter">
          <label class="filter-title">Estado</label>
          <select class="filter-select" [value]="filtroEstado" (change)="onFilterSelect('estado', $event)">
            <option value="TODOS">Todos ({{ stats.total }})</option>
            <option value="ABIERTO">ABIERTO ({{ stats.abiertos }})</option>
            <option value="CERRADO">CERRADO ({{ stats.cerrados }})</option>
            <ng-container *ngFor="let est of catalogos.estados">
              <option *ngIf="est !== 'ABIERTO' && est !== 'CERRADO'" [value]="est">{{ est }}</option>
            </ng-container>
          </select>
        </div>

        <!-- Filtro Presupuesto Estado -->
        <div class="filter-box col-ppto-filter">
          <label class="filter-title">Presupuesto Estado</label>
          <select class="filter-select" [value]="filtroPptoEstado" (change)="onFilterSelect('pptoEstado', $event)">
            <option value="TODOS">Todos</option>
            <option *ngFor="let p of catalogos.pptoEstados" [value]="p">{{ p }}</option>
          </select>
        </div>

        <!-- Buscador General -->
        <div class="filter-box col-search-filter">
          <label class="filter-title">Búsqueda General</label>
          <input 
            type="text" 
            class="filter-input" 
            placeholder="🔍 Código, empresa..." 
            [value]="filtroSearch"
            (input)="onSearchInput($event)"
          />
        </div>

        <!-- Botón Limpiar Filtros -->
        <div class="filter-box col-action-filter">
          <button class="btn-clear-filters" (click)="resetFilters()" title="Limpiar todos los filtros">
            🧹 Limpiar
          </button>
        </div>

      </div>

      <!-- Tabla Maestra de Centros de Costos -->
      <div class="card table-card">

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-empresa">Empresa</th>
                <th class="col-periodo">Año</th>
                <th class="col-cliente">Cliente</th>
                <th class="col-principal">Centro de costo Principal</th>
                <th class="col-codigo">Codigo CTO</th>
                <th class="col-nombre">CentroCosto</th>
                <th class="col-estado">Estado</th>
                <th class="col-ppto-estado">PresupuestoEstado</th>
                <th class="col-accion text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                *ngFor="let item of pagedCentros" 
                (click)="openDetail(item)"
                [class.row-selected]="selectedCentro?.CodCentroCto === item.CodCentroCto"
                class="table-row-clickable"
              >
                <!-- Empresa -->
                <td class="col-empresa" [title]="item.Empresa || item.CodEmpresa || ''">
                  {{ item.Empresa || item.CodEmpresa || '-' }}
                </td>

                <!-- IdPeriodo -->
                <td class="col-periodo">{{ item.IdPeriodo || '-' }}</td>

                <!-- CodCliente (Muestra el NOMBRE del cliente tal como se solicitó) -->
                <td class="col-cliente font-client" [title]="item.Cliente || item.CodCliente || ''">
                  {{ item.Cliente || item.CodCliente || '-' }}
                </td>

                <!-- Centro de costo Principal -->
                <td class="col-principal" [title]="item.CentroCostoPrincipal || item.CodCentroCtoPrincipal || ''">
                  {{ item.CentroCostoPrincipal || item.CodCentroCtoPrincipal || '-' }}
                </td>

                <!-- Codigo CTO -->
                <td class="col-codigo">
                  <span class="code-pill">{{ item.CodCentroCto }}</span>
                </td>

                <!-- CentroCosto -->
                <td class="col-nombre font-medium" [title]="item.CentroCosto">
                  {{ item.CentroCosto }}
                </td>

                <!-- Estado -->
                <td class="col-estado">
                  <span 
                    class="badge" 
                    [class.badge-abierto]="item.Estado === 'ABIERTO' || item.Estado === 'Activo'"
                    [class.badge-cerrado]="item.Estado === 'CERRADO' || item.Estado === 'Liquidado'"
                    [class.badge-proceso]="item.Estado === 'En Proceso' || item.Estado === 'POR LIQUIDAR'"
                  >
                    {{ item.Estado || 'ABIERTO' }}
                  </span>
                </td>

                <!-- PresupuestoEstado -->
                <td class="col-ppto-estado">
                  <span 
                    *ngIf="item.PresupuestoEstado" 
                    class="badge badge-ppto"
                    [class.badge-aprobado]="item.PresupuestoEstado === 'Aprobado'"
                  >
                    {{ item.PresupuestoEstado }}
                  </span>
                  <span *ngIf="!item.PresupuestoEstado" class="text-muted">-</span>
                </td>

                <!-- Acción -->
                <td class="col-accion text-center">
                  <button class="btn-icon-view" title="Ver análisis financiero" (click)="openDetail(item); $event.stopPropagation()">
                    <span class="arrow-icon">›</span>
                  </button>
                </td>
              </tr>

              <!-- Estado Vacío -->
              <tr *ngIf="centros.length === 0 && !loadingCentros">
                <td colspan="9" class="empty-cell">
                  <div class="empty-state">
                    <p class="empty-title">No se encontraron centros de costos con los filtros seleccionados</p>
                    <p class="empty-sub">Prueba ajustando los filtros de empresa, periodo, cliente o estado.</p>
                  </div>
                </td>
              </tr>

              <!-- Estado Cargando -->
              <tr *ngIf="loadingCentros">
                <td colspan="9" class="loading-cell">
                  <div class="table-loading">
                    <div class="spinner"></div>
                    <span>Cargando centros de costos...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación Inferior -->
        <div class="table-footer-flex" *ngIf="centros.length > 0">
          <div class="footer-left">
            <div class="footer-page-size">
              <span>Registros por página:</span>
              <select (change)="onPageSizeChange($event)" [value]="pageSize" class="select-page-size">
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <span class="tip-text">💡 Haz clic en cualquier fila para ver el análisis financiero (ppto.Sub Total en adelante)</span>
          </div>
          <div class="pagination-controls" *ngIf="totalPages > 1">
            <button class="btn-page" [disabled]="currentPage === 1" (click)="changePage(currentPage - 1)">‹ Anterior</button>
            <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
            <button class="btn-page" [disabled]="currentPage === totalPages" (click)="changePage(currentPage + 1)">Siguiente ›</button>
          </div>
        </div>
      </div>

      <!-- MODAL DETALLE FINANCIERO (Imagen 3: ppto.Sub Total en adelante) -->
      <div class="modal-backdrop" *ngIf="isDetailOpen && selectedCentro" (click)="closeDetail()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          
          <!-- Encabezado Oscuro (Imagen 3) -->
          <div class="detail-header-dark">
            <div class="detail-header-left">
              <div class="header-tags">
                <span class="tag-hash">{{ selectedCentro.CodCentroCto }}</span>
                <span class="tag-client">Cliente: {{ selectedCentro.Cliente || selectedCentro.CodCliente || 'CLI-001' }}</span>
                <span class="tag-company" *ngIf="selectedCentro.Empresa">{{ selectedCentro.Empresa }}</span>
              </div>
              <h2 class="detail-title">{{ selectedCentro.CentroCosto }}</h2>
              <div class="detail-substatus">
                Estado Operativo: <strong>{{ selectedCentro.Estado || 'ABIERTO' }}</strong>
                <span *ngIf="selectedCentro.PresupuestoEstado" class="substatus-sep">|</span>
                <span *ngIf="selectedCentro.PresupuestoEstado">Presupuesto: <strong>{{ selectedCentro.PresupuestoEstado }}</strong></span>
                <span *ngIf="selectedCentro.IdPeriodo" class="substatus-sep">|</span>
                <span *ngIf="selectedCentro.IdPeriodo">Periodo: <strong>{{ selectedCentro.IdPeriodo }}</strong></span>
              </div>
            </div>
            <div class="detail-header-right">
              <button class="btn-header-csv" (click)="exportSummary()" title="Exportar ficha en CSV">
                📊 CSV
              </button>
              <button class="btn-close-modal" (click)="closeDetail()" title="Cerrar vista">
                ✕
              </button>
            </div>
          </div>

          <!-- Cuerpo del Modal -->
          <div class="detail-body">
            
            <!-- Loading Resumen -->
            <div *ngIf="loadingResumen" class="loading-resumen">
              <div class="spinner"></div>
              <span>Calculando consolidado financiero en tiempo real...</span>
            </div>

            <ng-container *ngIf="!loadingResumen && resumen">
              
              <!-- 5 Tarjetas KPIs Financieras (Imagen 3) -->
              <div class="kpi-grid">
                
                <!-- 1. Presupuesto Base -->
                <div class="kpi-card card-kpi-base">
                  <div class="kpi-top">
                    <span class="kpi-icon">📌</span>
                    <span class="kpi-label">PRESUPUESTO BASE</span>
                  </div>
                  <div class="kpi-value">S/ {{ resumen.presupuestoBase | number:'1.2-2' }}</div>
                  <div class="kpi-footnote">Costo directo + GG + Viáticos</div>
                </div>

                <!-- 2. Presupuesto Comercial -->
                <div class="kpi-card card-kpi-comercial">
                  <div class="kpi-top">
                    <span class="kpi-icon">📈</span>
                    <span class="kpi-label">PRESUPUESTO COMERCIAL</span>
                  </div>
                  <div class="kpi-value">S/ {{ resumen.presupuestoComercial | number:'1.2-2' }}</div>
                  <div class="kpi-footnote">Monto adjudicado/contratado</div>
                </div>

                <!-- 3. Pagos Realizados -->
                <div class="kpi-card card-kpi-pagos">
                  <div class="kpi-top">
                    <span class="kpi-icon">💳</span>
                    <span class="kpi-label">PAGOS REALIZADOS</span>
                  </div>
                  <div class="kpi-value">S/ {{ resumen.pagosRealizados | number:'1.2-2' }}</div>
                  <div class="kpi-footnote">Facturas y planillas abonadas</div>
                </div>

                <!-- 4. Gastos Acumulados -->
                <div class="kpi-card card-kpi-gastos">
                  <div class="kpi-top">
                    <span class="kpi-icon">📉</span>
                    <span class="kpi-label">GASTOS ACUMULADOS</span>
                  </div>
                  <div class="kpi-value">S/ {{ resumen.gastosAcumulados | number:'1.2-2' }}</div>
                  <div class="kpi-footnote">Compras y caja ejecutada</div>
                </div>

                <!-- 5. Saldo Actual Disponible -->
                <div class="kpi-card card-kpi-saldo" [class.saldo-negativo]="resumen.saldoActual < 0">
                  <div class="kpi-top">
                    <span class="kpi-icon">💰</span>
                    <span class="kpi-label">SALDO ACTUAL DISPONIBLE</span>
                  </div>
                  <div class="kpi-value">S/ {{ resumen.saldoActual | number:'1.2-2' }}</div>
                  <div class="kpi-footnote">Diferencia Presupuestal</div>
                </div>

              </div>

              <!-- Barra de Progreso de Ejecución Comercial (Imagen 3) -->
              <div class="card progress-section">
                <div class="progress-info-row">
                  <span class="progress-title">Nivel de Ejecución del Presupuesto Comercial</span>
                  <span class="progress-badge" [class.badge-danger]="resumen.porcentajeEjecucion >= 100" [class.badge-warning]="resumen.porcentajeEjecucion >= 80 && resumen.porcentajeEjecucion < 100">
                    {{ resumen.porcentajeEjecucion }}% Ejecutado
                  </span>
                </div>
                <div class="progress-track-bg">
                  <div 
                    class="progress-fill-bar" 
                    [style.width.%]="resumen.porcentajeEjecucion > 100 ? 100 : resumen.porcentajeEjecucion"
                    [class.bar-danger]="resumen.porcentajeEjecucion >= 100"
                    [class.bar-warning]="resumen.porcentajeEjecucion >= 80 && resumen.porcentajeEjecucion < 100"
                  ></div>
                </div>
                <div class="progress-labels-row">
                  <span>S/ 0.00</span>
                  <span>Límite Comercial: S/ {{ resumen.presupuestoComercial | number:'1.2-2' }}</span>
                </div>
              </div>

              <!-- Desglose Consolidado por Fuente de Información (Imagen 3) -->
              <div class="card breakdown-section">
                <h3 class="breakdown-heading">Desglose Consolidado por Fuente de Información</h3>
                
                <div class="breakdown-list">
                  
                  <!-- Facturas DocCompra -->
                  <div class="breakdown-card-row">
                    <div class="b-row-left">
                      <div class="b-icon-box">🧾</div>
                      <div class="b-text">
                        <div class="b-primary-label">Facturas de Compra/Servicios</div>
                        <div class="b-secondary-label">DocCompra (Proveedores)</div>
                      </div>
                    </div>
                    <div class="b-row-right">
                      <span class="b-total-amount">S/ {{ (resumen.gastosFacturas || 0) | number:'1.2-2' }}</span>
                    </div>
                  </div>

                  <!-- Caja Chica y Egresos -->
                  <div class="breakdown-card-row">
                    <div class="b-row-left">
                      <div class="b-icon-box">💵</div>
                      <div class="b-text">
                        <div class="b-primary-label">Caja Chica y Egresos Retail</div>
                        <div class="b-secondary-label">CajaEgresosRetail</div>
                      </div>
                    </div>
                    <div class="b-row-right">
                      <span class="b-total-amount">S/ {{ (resumen.gastosCajaChica || 0) | number:'1.2-2' }}</span>
                    </div>
                  </div>

                  <!-- Planillas de Mano de Obra -->
                  <div class="breakdown-card-row">
                    <div class="b-row-left">
                      <div class="b-icon-box">👷</div>
                      <div class="b-text">
                        <div class="b-primary-label">Planillas y Mano de Obra</div>
                        <div class="b-secondary-label">PlanillaPago (Semanal)</div>
                      </div>
                    </div>
                    <div class="b-row-right">
                      <span class="b-total-amount">S/ {{ (resumen.pagosPlanillas || 0) | number:'1.2-2' }}</span>
                    </div>
                  </div>

                </div>
              </div>

            </ng-container>

          </div>

          <!-- Pie del Modal -->
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="closeDetail()">Cerrar</button>
            <button class="btn btn-primary" (click)="exportSummary()">📥 Exportar Ficha CSV</button>
          </div>

        </div>
      </div>

    </div>
  `,
  styles: [`
    /* Hace que el elemento host de Angular participe en la cadena flex */
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      overflow: hidden;
    }

    /* ==========================================================================
       ESTILOS CORPORATIVOS GLD - DASHBOARD DE CENTROS DE COSTOS
       ========================================================================== */

    .dashboard-wrapper {
      padding: 16px 24px 16px 24px;
      color: var(--text-main, #1f2937);
      background-color: var(--bg-app, #f8fafc);
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Encabezado */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      gap: 12px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .page-title {
      font-size: 1.65rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 0.88rem;
      color: #64748b;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    /* Tarjetas Base */
    .card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    /* ==========================================================================
       BARRA HORIZONTAL DE FILTROS (Uno al lado del otro)
       ========================================================================== */
    .filters-horizontal-card {
      padding: 10px 16px;
      margin-bottom: 12px;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 10px;
      background: #ffffff;
      flex-shrink: 0;
    }

    .filter-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .filter-title {
      font-size: 0.72rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }

    .filter-select, .filter-input {
      height: 36px;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      font-size: 0.82rem;
      color: #1e293b;
      background-color: #ffffff;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .filter-select:focus, .filter-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
    }

    /* Anchos específicos de los filtros para fluir horizontalmente uno al lado del otro */
    .col-empresa-filter { flex: 1.4; min-width: 170px; }
    .col-periodo-filter { flex: 0 0 95px; width: 95px; }
    .col-cliente-filter { flex: 1.4; min-width: 170px; }
    .col-cto-filter { flex: 1.1; min-width: 140px; }
    .col-estado-filter { flex: 0 0 130px; width: 130px; }
    .col-ppto-filter { flex: 0 0 135px; width: 135px; }
    .col-search-filter { flex: 1.1; min-width: 140px; }
    .col-action-filter { flex: 0 0 auto; }

    .btn-clear-filters {
      height: 36px;
      padding: 0 14px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #64748b;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s;
    }

    .btn-clear-filters:hover {
      background: #fee2e2;
      color: #ef4444;
      border-color: #fca5a5;
    }

    /* ==========================================================================
       TABLA MAESTRA
       ========================================================================== */
    .table-card {
      overflow: hidden;
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .table-header-flex {
      padding: 12px 20px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fafafa;
      flex-shrink: 0;
    }

    .records-count {
      font-size: 0.88rem;
      color: #334155;
      margin-right: 16px;
    }

    .tip-text {
      font-size: 0.82rem;
      color: #059669;
      font-weight: 500;
    }

    .table-responsive {
      overflow-x: auto;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.84rem;
    }

    .data-table thead th {
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      padding: 12px 14px;
      border-bottom: 2px solid #e2e8f0;
      white-space: nowrap;
      position: sticky;
      top: 0;
      z-index: 2;
    }

    .data-table tbody td {
      padding: 11px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      vertical-align: middle;
      white-space: nowrap;
    }

    .table-row-clickable {
      cursor: pointer;
      transition: background-color 0.12s ease;
    }

    .table-row-clickable:hover {
      background-color: #f1f5f9 !important;
    }

    .row-selected {
      background-color: #eff6ff !important;
    }

    /* Columnas */
    .col-empresa { max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
    .col-periodo { width: 90px; }
    .col-cliente { max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
    .col-principal { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
    .col-codigo { width: 110px; }
    .col-nombre { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
    .col-estado { width: 110px; }
    .col-ppto-estado { width: 130px; }
    .col-accion { width: 60px; }

    .code-pill {
      font-family: monospace;
      font-size: 0.8rem;
      background: #f1f5f9;
      padding: 3px 6px;
      border-radius: 4px;
      color: #1e293b;
      font-weight: 600;
    }

    .font-medium {
      font-weight: 600;
      color: #0f172a;
    }

    .font-client {
      font-weight: 600;
      color: #1e3a8a; /* Azul corporativo sutil para destacar el nombre del cliente */
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.74rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-abierto { background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .badge-cerrado { background-color: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
    .badge-proceso { background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }

    .badge-ppto {
      background-color: #f0fdf4;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }

    .badge-aprobado {
      background-color: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }

    .btn-icon-view {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #64748b;
      transition: all 0.15s;
    }

    .btn-icon-view:hover {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
    }

    .arrow-icon {
      font-size: 1.1rem;
      line-height: 1;
    }

    /* Paginación */
    .table-footer-flex {
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #e2e8f0;
      background: #fafafa;
      flex-shrink: 0;
    }

    .footer-page-size {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.84rem;
      color: #64748b;
    }

    .select-page-size {
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      font-size: 0.82rem;
      background: #ffffff;
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-page {
      padding: 5px 12px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      border-radius: 6px;
      font-size: 0.84rem;
      color: #334155;
      cursor: pointer;
    }

    .btn-page:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-page:not(:disabled):hover {
      background: #f1f5f9;
    }

    .page-indicator {
      font-size: 0.84rem;
      color: #475569;
      font-weight: 500;
    }

    /* Estados de Carga y Vacío */
    .empty-cell, .loading-cell {
      text-align: center;
      padding: 48px 20px !important;
    }

    .empty-state .empty-title {
      font-size: 1rem;
      font-weight: 600;
      color: #334155;
      margin: 0 0 6px 0;
    }

    .empty-state .empty-sub {
      font-size: 0.84rem;
      color: #64748b;
      margin: 0;
    }

    .table-loading {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: #64748b;
      font-size: 0.9rem;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 3px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ==========================================================================
       MODAL DETALLADO FINANCIERO (IMAGEN 3)
       ========================================================================== */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-card {
      background: #f8fafc;
      width: 100%;
      max-width: 1060px;
      max-height: 92vh;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.15);
      animation: modalSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalSlide {
      from { transform: translateY(18px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .detail-header-dark {
      background-color: #202724;
      color: #ffffff;
      padding: 24px 32px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }

    .footer-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .footer-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-tags {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .tag-hash {
      background: #026553;
      color: #a7f3d0;
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .tag-client {
      background: rgba(255, 255, 255, 0.12);
      color: #e2e8f0;
      font-size: 0.8rem;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .tag-company {
      background: rgba(255, 255, 255, 0.08);
      color: #94a3b8;
      font-size: 0.78rem;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .detail-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: #ffffff;
      margin: 4px 0 6px 0;
      text-transform: uppercase;
      letter-spacing: -0.01em;
    }

    .detail-substatus {
      font-size: 0.86rem;
      color: #94a3b8;
    }

    .detail-substatus strong {
      color: #a7f3d0;
    }

    .substatus-sep {
      margin: 0 8px;
      color: #475569;
    }

    .detail-header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-header-csv {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-header-csv:hover {
      background: rgba(255, 255, 255, 0.22);
    }

    .btn-close-modal {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #ffffff;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-close-modal:hover {
      background: rgba(239, 68, 68, 0.7);
    }

    .detail-body {
      padding: 24px 32px;
      overflow-y: auto;
      flex: 1;
    }

    .loading-resumen {
      padding: 40px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #64748b;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    @media (max-width: 1024px) {
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .kpi-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .card-kpi-base { border-left: 4px solid #3b82f6; }
    .card-kpi-comercial { border-left: 4px solid #84cc16; }
    .card-kpi-pagos { border-left: 4px solid #06b6d4; }
    .card-kpi-gastos { border-left: 4px solid #f97316; }
    .card-kpi-saldo { border-left: 4px solid #10b981; }
    .card-kpi-saldo.saldo-negativo { border-left-color: #ef4444; }

    .kpi-top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .kpi-icon {
      font-size: 1.1rem;
    }

    .kpi-label {
      font-size: 0.72rem;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.04em;
    }

    .kpi-value {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
      letter-spacing: -0.02em;
    }

    .kpi-footnote {
      font-size: 0.72rem;
      color: #64748b;
      margin-top: auto;
    }

    .progress-section {
      padding: 20px 24px;
      margin-bottom: 24px;
    }

    .progress-info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .progress-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #1e293b;
    }

    .progress-badge {
      font-size: 0.92rem;
      font-weight: 700;
      color: #059669;
    }

    .progress-badge.badge-warning { color: #0284c7; }
    .progress-badge.badge-danger { color: #dc2626; }

    .progress-track-bg {
      height: 12px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill-bar {
      height: 100%;
      background: #059669;
      border-radius: 999px;
      transition: width 0.4s ease-out;
    }

    .progress-fill-bar.bar-warning { background: #0284c7; }
    .progress-fill-bar.bar-danger { background: #ef4444; }

    .progress-labels-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.78rem;
      color: #64748b;
    }

    .breakdown-section {
      padding: 20px 24px;
    }

    .breakdown-heading {
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 16px 0;
    }

    .breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .breakdown-card-row {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background-color 0.15s;
    }

    .breakdown-card-row:hover {
      background: #ffffff;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
    }

    .b-row-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .b-icon-box {
      font-size: 1.3rem;
    }

    .b-primary-label {
      font-size: 0.92rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .b-secondary-label {
      font-size: 0.76rem;
      color: #64748b;
    }

    .b-total-amount {
      font-size: 1.15rem;
      font-weight: 800;
      color: #0f172a;
    }

    .modal-footer {
      background: #ffffff;
      padding: 16px 32px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .btn {
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease-in-out;
    }

    .btn-primary {
      background-color: #00695c;
      border: 1px solid #004d40;
      color: #ffffff;
    }

    .btn-primary:hover {
      background-color: #004d40;
    }

    .btn-outline {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #334155;
    }

    .btn-outline:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }
  `]
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

  constructor(private dashboardService: CentrosCostosDashboardService) {}

  ngOnInit(): void {
    this.loadCatalogos();
    this.loadStats();
    this.loadCentros();
  }

  loadCatalogos(): void {
    this.dashboardService.getCatalogosFiltros().subscribe({
      next: (cats) => {
        this.catalogos = cats;
      },
      error: (err) => console.warn('Error al cargar catálogos de filtros:', err)
    });
  }

  loadStats(): void {
    this.dashboardService.getConteoEstados().subscribe({
      next: (data) => {
        this.stats = data;
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
      },
      error: (err) => {
        console.error('Error al cargar centros de costos:', err);
        this.loadingCentros = false;
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
      },
      error: (err) => {
        console.error('Error al cargar resumen financiero:', err);
        this.loadingResumen = false;
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
