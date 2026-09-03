import { Component, OnInit, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncidenciasService, Incidencia } from './incidencias.service';

declare var L: any; // Leaflet global JS library

@Component({
  selector: 'app-incidencias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="content-header">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="background: #10b981; color: white; width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
          <i class="fa-solid fa-clipboard-list"></i>
        </div>
        <div>
          <h1 class="content-title" style="margin: 0;">Registro de Casos / Incidencias</h1>
          <p class="content-subtitle" style="margin: 0;">Gestión e incidencias operativas de GLD Arquitectura.</p>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary" (click)="loadIncidencias()" [disabled]="loading">
          <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="loading"></i> {{ loading ? 'Actualizando...' : 'Actualizar' }}
        </button>
        <button class="btn btn-primary" style="background: #059669; border-color: #059669;" (click)="openCreateModal()">
          <i class="fa-solid fa-plus"></i> + Agregar Caso
        </button>
      </div>
    </div>

    <div class="content-body">
      <!-- Panel de Filtros -->
      <div class="filter-card" style="position: relative;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
          <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.4rem;">
            <i class="fa-solid fa-magnifying-glass"></i> FILTROS
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.8rem;" (click)="resetFilters()">
              <i class="fa-solid fa-rotate-left"></i> Limpiar
            </button>
            <button class="btn btn-primary" style="background: #10b981; border-color: #10b981; padding: 0.25rem 0.75rem; font-size: 0.8rem;" (click)="exportExcel()">
              <i class="fa-solid fa-file-excel"></i> Exportar Excel
            </button>
          </div>
        </div>

        <div class="filter-grid" style="grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.75rem;">
          <div class="form-group">
            <label>FECHA INICIO</label>
            <input type="date" class="form-control" [(ngModel)]="filters.fechaInicio" (change)="loadIncidencias()">
          </div>

          <div class="form-group">
            <label>FECHA FIN</label>
            <input type="date" class="form-control" [(ngModel)]="filters.fechaFin" (change)="loadIncidencias()">
          </div>

          <div class="form-group">
            <label>REGISTRADOR / PROMOTOR</label>
            <input type="text" class="form-control" [(ngModel)]="filters.promotor" (keyup.enter)="loadIncidencias()" placeholder="🔍 Nombre registrador...">
          </div>

          <div class="form-group">
            <label>ESTADO</label>
            <select class="form-control" [(ngModel)]="filters.estado" (change)="loadIncidencias()">
              <option value="Todos los estados">Todos los estados</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="EN PROCESO">EN PROCESO</option>
              <option value="RESUELTO">RESUELTO</option>
            </select>
          </div>

          <div class="form-group">
            <label>SOLICITANTE / CLIENTE</label>
            <input type="text" class="form-control" [(ngModel)]="filters.solicitante" (keyup.enter)="loadIncidencias()" placeholder="🔍 Nombres solicitante...">
          </div>

          <div class="form-group">
            <label>DETALLE / INCIDENCIA</label>
            <input type="text" class="form-control" [(ngModel)]="filters.incidencia" (keyup.enter)="loadIncidencias()" placeholder="🔍 Descripción...">
          </div>

          <div class="form-group">
            <label>RESPONSABLE / ÁREA</label>
            <input type="text" class="form-control" [(ngModel)]="filters.representante" (keyup.enter)="loadIncidencias()" placeholder="🔍 Responsable...">
          </div>
        </div>
      </div>

      <!-- Tabla Principal -->
      <div class="table-card" style="overflow-x: auto;">
        <table class="table" style="min-width: 1300px;">
          <thead>
            <tr>
              <th>ID ⇅</th>
              <th>REGISTRADOR ⇅</th>
              <th>DOC. IDENTIDAD ⇅</th>
              <th>CARGO ⇅</th>
              <th>SOLICITANTE ⇅</th>
              <th>DOC. SOLICITANTE ⇅</th>
              <th>TELÉFONO ⇅</th>
              <th>DOMICILIO ⇅</th>
              <th>FECHA ⇅</th>
              <th>ORIGEN ⇅</th>
              <th>DIRECCIÓN ⇅</th>
              <th style="text-align: center;">ESTADO ⇅</th>
              <th style="text-align: center;">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of incidencias">
              <td><strong>{{ item.id }}</strong></td>
              <td style="font-size: 0.8rem; font-weight: 600;">{{ item.promotor || '—' }}</td>
              <td style="font-size: 0.8rem;">{{ item.docRegistrador || '—' }}</td>
              <td style="font-size: 0.75rem; color: var(--text-muted);">{{ item.cargoRegistrador || '—' }}</td>
              <td style="font-weight: 600;">{{ item.solicitante || '—' }}</td>
              <td>{{ item.docSolicitante || '—' }}</td>
              <td>{{ item.telefonoSolicitante || '—' }}</td>
              <td style="font-size: 0.75rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                {{ item.domicilioSolicitante || '—' }}
              </td>
              <td style="font-size: 0.8rem; white-space: nowrap;">
                {{ item.fechaIncidencia || (item.fechaInicio ? (item.fechaInicio | date:'yyyy-MM-dd') : '—') }}
              </td>
              <td style="font-size: 0.75rem;">{{ item.origenIncidencia || 'DIRECTO' }}</td>
              <td style="font-size: 0.75rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                {{ item.direccionExacta || item.domicilioSolicitante || '—' }}
              </td>
              <td style="text-align: center;">
                <span class="status-pill" [class.pendiente]="(item.estado || 'PENDIENTE') === 'PENDIENTE'"
                  [class.en-proceso]="item.estado === 'EN PROCESO'"
                  [class.resuelto]="item.estado === 'RESUELTO'">
                  {{ item.estado || 'PENDIENTE' }}
                </span>
              </td>
              <td style="text-align: center; white-space: nowrap;">
                <button class="btn-icon-action" (click)="openDetailModal(item)" title="Ver Detalles de la Ficha">
                  <i class="fa-solid fa-eye"></i>
                </button>
                <button class="btn-icon-action" style="margin-left: 0.2rem;" (click)="openEditModal(item)" title="Editar Ficha">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn-icon-action primary" style="margin-left: 0.2rem;" (click)="duplicateIncidencia(item.id!)" title="Duplicar Ficha">
                  <i class="fa-solid fa-copy"></i>
                </button>
                <button class="btn-icon-action danger" style="margin-left: 0.2rem;" (click)="deleteIncidencia(item.id!)" title="Eliminar Caso">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </td>
            </tr>
            <tr *ngIf="incidencias.length === 0 && !loading">
              <td colspan="13" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-solid fa-clipboard-question" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block;"></i>
                No se encontraron casos o incidencias registradas.
              </td>
            </tr>
            <tr *ngIf="loading">
              <td colspan="13" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
                <i class="fa-solid fa-spinner fa-spin"></i> Cargando registros...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Formulario Ficha -->
    <div class="modal-overlay" *ngIf="showFormModal">
      <div class="modal-content" style="max-width: 780px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="background: linear-gradient(135deg, #0284c7 0%, #059669 100%); color: white;">
          <h3 style="display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 1.1rem; color: white;">
            <i class="fa-solid fa-square-plus"></i>
            {{ editingId ? 'Editar Ficha de Caso' : 'Nueva Ficha de Caso / Incidencia' }}
          </h3>
          <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem; color: white; background: rgba(255,255,255,0.2); border: none;" (click)="closeModals()">✕</button>
        </div>

        <div class="modal-body" style="gap: 1.25rem;">
          <!-- I.- DATOS DEL REGISTRADOR -->
          <div class="modal-section-title">
            <i class="fa-solid fa-user-gear"></i> I.- DATOS DEL REGISTRADOR
          </div>
          <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label>Nombre del Registrador *</label>
              <input type="text" class="form-control" [(ngModel)]="formData.promotor" placeholder="Ej. Juan Perez (GLD)">
            </div>
            <div class="form-group">
              <label>DNI / Documento</label>
              <input type="text" class="form-control" [(ngModel)]="formData.docRegistrador" placeholder="DNI del registrador">
            </div>
            <div class="form-group">
              <label>Cargo</label>
              <input type="text" class="form-control" [(ngModel)]="formData.cargoRegistrador" placeholder="Ej. Ingeniero de Proyecto">
            </div>
          </div>

          <!-- II.- DATOS DEL SOLICITANTE -->
          <div class="modal-section-title">
            <i class="fa-solid fa-id-card"></i> II.- DATOS DEL SOLICITANTE / CLIENTE
          </div>
          <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label>Nombres y Apellidos / Empresa *</label>
              <input type="text" class="form-control" [(ngModel)]="formData.solicitante" placeholder="Nombre cliente o razón social">
            </div>
            <div class="form-group">
              <label>RUC / DNI</label>
              <input type="text" class="form-control" [(ngModel)]="formData.docSolicitante" placeholder="Documento de identidad / RUC">
            </div>
            <div class="form-group">
              <label>Teléfono Contacto</label>
              <input type="text" class="form-control" [(ngModel)]="formData.telefonoSolicitante" placeholder="Teléfono de contacto">
            </div>
          </div>
          <div class="form-group">
            <label>Dirección / Domicilio</label>
            <input type="text" class="form-control" [(ngModel)]="formData.domicilioSolicitante" placeholder="Dirección del cliente o proyecto">
          </div>

          <!-- III.- DATOS DE LA INCIDENCIA -->
          <div class="modal-section-title">
            <i class="fa-solid fa-triangle-exclamation"></i> III.- DATOS DEL CASO / INCIDENCIA
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label>FECHA CASO</label>
              <input type="date" class="form-control" [(ngModel)]="formData.fechaIncidencia">
            </div>
            <div class="form-group">
              <label>HORA CASO</label>
              <input type="time" class="form-control" [(ngModel)]="formData.horaIncidencia">
            </div>
            <div class="form-group">
              <label>Origen del Registro</label>
              <select class="form-control" [(ngModel)]="formData.origenIncidencia">
                <option value="DIRECTO">DIRECTO</option>
                <option value="PRESENCIAL">PRESENCIAL</option>
                <option value="TELEFÓNICO">TELEFÓNICO</option>
                <option value="CORREO / WEB">CORREO / WEB</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label>Vía / Referencia</label>
              <input type="text" class="form-control" [(ngModel)]="formData.viaOrigen" placeholder="Ej. Av. Principal / Obra">
            </div>
            <div class="form-group">
              <label>Sector / Zona</label>
              <input type="text" class="form-control" [(ngModel)]="formData.sectorVecinal" placeholder="Ej. Zona Norte / Etapa 1">
            </div>
            <div class="form-group">
              <label>Tipificación / Tipo</label>
              <select class="form-control" [(ngModel)]="formData.tipificacion">
                <option value="INCIDENCIA TÉCNICA">INCIDENCIA TÉCNICA</option>
                <option value="OPERATIVA / OBRA">OPERATIVA / OBRA</option>
                <option value="PRESUPUESTO / FACTURACIÓN">PRESUPUESTO / FACTURACIÓN</option>
                <option value="SEGURIDAD Y SALUD">SEGURIDAD Y SALUD</option>
                <option value="ADMINISTRATIVA">ADMINISTRATIVA</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Lugar / Ubicación Exacta del Proyecto</label>
            <input type="text" class="form-control" [(ngModel)]="formData.direccionExacta" placeholder="Lugar exacto del evento o proyecto">
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label>Descripción de Incidencia / Caso *</label>
              <textarea class="form-control" rows="3" [(ngModel)]="formData.incidencia" placeholder="Detalle completo del evento o problema registrado..."></textarea>
            </div>
            <div class="form-group">
              <label>Prioridad / Categoría</label>
              <select class="form-control" [(ngModel)]="formData.prioridadCategoria">
                <option value="BAJA">BAJA</option>
                <option value="NORMAL">NORMAL</option>
                <option value="ALTA">ALTA</option>
                <option value="URGENTE">URGENTE</option>
              </select>
            </div>
          </div>

          <!-- Coordenadas & Mapa Interactivo Leaflet con Pin Verde Moviendo -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.75rem; margin-bottom: 0.5rem;">
            <label style="font-weight: 700; font-size: 0.8rem; color: #0369a1; display: flex; align-items: center; gap: 0.4rem;">
              <i class="fa-solid fa-map-location-dot"></i> MAPA Y UBICACIÓN (Arrastra el marcador verde o haz clic en el mapa)
            </label>
            <button type="button" class="btn btn-primary" style="background: #0284c7; border-color: #0284c7; padding: 0.25rem 0.65rem; font-size: 0.78rem;" (click)="getCurrentLocation()">
              <i class="fa-solid fa-location-crosshairs"></i> Ubicación GPS Actual
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label>LATITUD</label>
              <input type="text" class="form-control" [(ngModel)]="formData.latitud" (change)="updateMarkerFromInputs()" placeholder="-12.09120000">
            </div>
            <div class="form-group">
              <label>LONGITUD</label>
              <input type="text" class="form-control" [(ngModel)]="formData.longitud" (change)="updateMarkerFromInputs()" placeholder="-76.95340000">
            </div>
          </div>

          <!-- Contenedor del Mapa Interactivo Leaflet -->
          <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; background: #e2e8f0; position: relative;">
            <div id="leaflet-map-container" style="height: 220px; width: 100%; z-index: 1;"></div>
            <div style="position: absolute; bottom: 5px; left: 10px; background: rgba(255,255,255,0.92); padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; color: #334155; font-weight: 600; z-index: 500;">
              🟢 Arrastra el marcador verde o haz clic en cualquier punto del mapa para fijar coordenadas.
            </div>
          </div>

          <!-- IV.- ATENCIÓN DE LA INCIDENCIA -->
          <div class="modal-section-title">
            <i class="fa-solid fa-list-check"></i> IV.- ATENCIÓN Y SEGUIMIENTO
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label>Área / Gerencia Asignada</label>
              <input type="text" class="form-control" [(ngModel)]="formData.gerenciaAsignada" placeholder="Ej. Área de Operaciones GLD">
            </div>
            <div class="form-group">
              <label>Responsable de Atención</label>
              <input type="text" class="form-control" [(ngModel)]="formData.representante" placeholder="Ej. Ing. Responsable de Obra">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label>Estado del Caso</label>
              <select class="form-control" [(ngModel)]="formData.estado">
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="EN PROCESO">EN PROCESO</option>
                <option value="RESUELTO">RESUELTO</option>
              </select>
            </div>
            <div class="form-group">
              <label>Acción Previa</label>
              <input type="text" class="form-control" [(ngModel)]="formData.accionPrevia" placeholder="Acciones o inspección inicial...">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label>Acción Tomada</label>
              <input type="text" class="form-control" [(ngModel)]="formData.accionTomada" placeholder="Medida ejecutada para solución...">
            </div>
            <div class="form-group">
              <label>Documento / Expediente Referencia</label>
              <input type="text" class="form-control" [(ngModel)]="formData.documentoGestrad" placeholder="N° informe, correo o documento">
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
          <button class="btn btn-primary" style="background: #059669; border-color: #059669;" (click)="saveIncidencia()">
            <i class="fa-solid fa-floppy-disk"></i> Guardar Caso
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Detalle Ficha (Solo Lectura) -->
    <div class="modal-overlay" *ngIf="showDetailModal && selectedItem">
      <div class="modal-content" style="max-width: 650px; max-height: 85vh; overflow-y: auto;">
        <div class="modal-header" style="background: linear-gradient(135deg, #059669 0%, #0284c7 100%); color: white;">
          <div>
            <h3 style="margin: 0; color: white; font-size: 1.1rem;">
              <i class="fa-solid fa-file-lines"></i> Detalles de Ficha de Caso
            </h3>
            <small style="color: #e0f2fe; font-size: 0.75rem;">ID Registro: {{ selectedItem.id }}</small>
          </div>
          <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem; color: white; background: rgba(255,255,255,0.2); border: none;" (click)="closeModals()">✕</button>
        </div>

        <div class="modal-body" style="font-size: 0.85rem; gap: 1rem;">
          <div style="background: #f8fafc; padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="font-weight: 700; color: #047857; margin-bottom: 0.4rem;">👤 I.- REGISTRADOR</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
              <div><small style="color: var(--text-muted); display: block;">REGISTRADOR:</small> <strong>{{ selectedItem.promotor || '—' }}</strong></div>
              <div><small style="color: var(--text-muted); display: block;">DOCUMENTO:</small> <strong>{{ selectedItem.docRegistrador || '—' }}</strong></div>
              <div><small style="color: var(--text-muted); display: block;">CARGO:</small> <strong>{{ selectedItem.cargoRegistrador || '—' }}</strong></div>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="font-weight: 700; color: #047857; margin-bottom: 0.4rem;">🧑‍🤝‍🧑 II.- SOLICITANTE / CLIENTE</div>
            <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.4rem;">
              <div><small style="color: var(--text-muted); display: block;">NOMBRES / EMPRESA:</small> <strong>{{ selectedItem.solicitante || '—' }}</strong></div>
              <div><small style="color: var(--text-muted); display: block;">DOCUMENTO:</small> <strong>{{ selectedItem.docSolicitante || '—' }}</strong></div>
              <div><small style="color: var(--text-muted); display: block;">TELÉFONO:</small> <strong>{{ selectedItem.telefonoSolicitante || '—' }}</strong></div>
            </div>
            <div><small style="color: var(--text-muted); display: block;">DIRECCIÓN FISCAL:</small> <strong>{{ selectedItem.domicilioSolicitante || '—' }}</strong></div>
          </div>

          <div style="background: #f8fafc; padding: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="font-weight: 700; color: #047857; margin-bottom: 0.4rem;">📍 III.- DETALLES DEL CASO / INCIDENCIA</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.4rem;">
              <div><small style="color: var(--text-muted); display: block;">FECHA:</small> <strong>{{ selectedItem.fechaIncidencia || '—' }}</strong></div>
              <div><small style="color: var(--text-muted); display: block;">HORA:</small> <strong>{{ selectedItem.horaIncidencia || '—' }}</strong></div>
              <div><small style="color: var(--text-muted); display: block;">TIPIFICACIÓN:</small> <strong>{{ selectedItem.tipificacion || '—' }}</strong></div>
            </div>
            <div style="margin-top: 0.4rem;">
              <small style="color: var(--text-muted); display: block;">DESCRIPCIÓN COMPLETA:</small>
              <div style="background: #ffffff; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 0.2rem;">
                {{ selectedItem.incidencia || 'Sin descripción...' }}
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeModals()">Cerrar Detalles</button>
        </div>
      </div>
    </div>
  `
})
export class IncidenciasComponent implements OnInit, AfterViewChecked {
  incidencias: Incidencia[] = [];
  loading = false;

  // Leaflet Map References
  private leafletMap: any = null;
  private leafletMarker: any = null;
  private mapNeedsInit = false;

  // Modal State
  showFormModal = false;
  showDetailModal = false;
  editingId: number | null = null;
  selectedItem: Incidencia | null = null;

  filters = {
    fechaInicio: '',
    fechaFin: '',
    promotor: 'Todos los promotores',
    estado: 'Todos los estados',
    solicitante: '',
    incidencia: '',
    representante: '',
  };

  formData: Incidencia = {
    promotor: '',
    docRegistrador: '',
    cargoRegistrador: '',
    solicitante: '',
    docSolicitante: '',
    telefonoSolicitante: '',
    domicilioSolicitante: '',
    fechaIncidencia: new Date().toISOString().substring(0, 10),
    horaIncidencia: '08:30',
    origenIncidencia: 'DIRECTO',
    viaOrigen: '',
    cuadra: '',
    urbanizacion: '',
    sectorVecinal: '',
    tipificacion: 'INCIDENCIA TÉCNICA',
    direccionExacta: '',
    incidencia: '',
    prioridadCategoria: 'NORMAL',
    latitud: '-12.09120000',
    longitud: '-76.95340000',
    gerenciaAsignada: '',
    representante: '',
    estado: 'PENDIENTE',
  };

  constructor(private service: IncidenciasService) {}

  ngOnInit() {
    this.loadIncidencias();
  }

  ngAfterViewChecked() {
    if (this.showFormModal && this.mapNeedsInit) {
      this.mapNeedsInit = false;
      setTimeout(() => this.initLeafletMap(), 150);
    }
  }

  // Interactive Leaflet Map with Green Draggable Pin Marker
  initLeafletMap() {
    const mapElement = document.getElementById('leaflet-map-container');
    if (!mapElement || typeof L === 'undefined') return;

    const lat = Number(this.formData.latitud) || -12.0912;
    const lng = Number(this.formData.longitud) || -76.9534;

    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }

    this.leafletMap = L.map('leaflet-map-container').setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.leafletMap);

    // Green pin marker matching screenshot
    const greenIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    this.leafletMarker = L.marker([lat, lng], {
      draggable: true,
      icon: greenIcon,
    }).addTo(this.leafletMap);

    this.leafletMarker.bindPopup('🟢 Arrastra para mover').openPopup();

    // Event when dragging green marker ends
    this.leafletMarker.on('dragend', () => {
      const pos = this.leafletMarker.getLatLng();
      this.formData.latitud = pos.lat.toFixed(8);
      this.formData.longitud = pos.lng.toFixed(8);
    });

    // Event when clicking anywhere on map
    this.leafletMap.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      this.leafletMarker.setLatLng([lat, lng]);
      this.formData.latitud = lat.toFixed(8);
      this.formData.longitud = lng.toFixed(8);
    });

    setTimeout(() => {
      this.leafletMap.invalidateSize();
    }, 200);
  }

  updateMarkerFromInputs() {
    const lat = Number(this.formData.latitud);
    const lng = Number(this.formData.longitud);

    if (!isNaN(lat) && !isNaN(lng) && this.leafletMarker && this.leafletMap) {
      this.leafletMarker.setLatLng([lat, lng]);
      this.leafletMap.panTo([lat, lng]);
    }
  }

  getCurrentLocation() {
    if (navigator.geolocation) {
      this.loading = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(8);
          const lng = position.coords.longitude.toFixed(8);
          this.formData.latitud = lat;
          this.formData.longitud = lng;

          if (this.leafletMarker && this.leafletMap) {
            this.leafletMarker.setLatLng([Number(lat), Number(lng)]);
            this.leafletMap.setView([Number(lat), Number(lng)], 16);
          }
          this.loading = false;
        },
        (error) => {
          this.loading = false;
          alert('No se pudo detectar la posición GPS: ' + error.message);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Tu navegador no soporta geolocalización GPS.');
    }
  }

  loadIncidencias() {
    this.loading = true;
    this.service.getAll(this.filters).subscribe({
      next: (data) => {
        this.incidencias = data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      },
    });
  }

  resetFilters() {
    this.filters = {
      fechaInicio: '',
      fechaFin: '',
      promotor: 'Todos los promotores',
      estado: 'Todos los estados',
      solicitante: '',
      incidencia: '',
      representante: '',
    };
    this.loadIncidencias();
  }

  openCreateModal() {
    this.editingId = null;
    this.formData = {
      promotor: '',
      docRegistrador: '',
      cargoRegistrador: '',
      solicitante: '',
      docSolicitante: '',
      telefonoSolicitante: '',
      domicilioSolicitante: '',
      fechaIncidencia: new Date().toISOString().substring(0, 10),
      horaIncidencia: '08:30',
      origenIncidencia: 'DIRECTO',
      viaOrigen: '',
      cuadra: '',
      urbanizacion: '',
      sectorVecinal: '',
      tipificacion: 'INCIDENCIA TÉCNICA',
      direccionExacta: '',
      incidencia: '',
      prioridadCategoria: 'NORMAL',
      latitud: '-12.09120000',
      longitud: '-76.95340000',
      gerenciaAsignada: '',
      representante: '',
      estado: 'PENDIENTE',
    };
    this.showFormModal = true;
    this.mapNeedsInit = true;
  }

  openEditModal(item: Incidencia) {
    this.editingId = item.id!;
    this.formData = { ...item };
    this.showFormModal = true;
    this.mapNeedsInit = true;
  }

  openDetailModal(item: Incidencia) {
    this.selectedItem = item;
    this.showDetailModal = true;
  }

  saveIncidencia() {
    if (!this.formData.solicitante || !this.formData.incidencia) {
      alert('Por favor complete los campos obligatorios (*).');
      return;
    }

    if (this.editingId) {
      this.service.update(this.editingId, this.formData).subscribe({
        next: () => { this.closeModals(); this.loadIncidencias(); },
        error: (err) => alert('Error al actualizar: ' + err.error?.message),
      });
    } else {
      this.service.create(this.formData).subscribe({
        next: () => { this.closeModals(); this.loadIncidencias(); },
        error: (err) => alert('Error al crear: ' + err.error?.message),
      });
    }
  }

  duplicateIncidencia(id: number) {
    if (confirm('¿Deseas duplicar esta ficha de caso?')) {
      this.service.duplicate(id).subscribe({
        next: () => this.loadIncidencias(),
        error: (err) => alert('Error al duplicar: ' + err.error?.message),
      });
    }
  }

  deleteIncidencia(id: number) {
    if (confirm(`¿Eliminar la incidencia #${id}?`)) {
      this.service.delete(id).subscribe({
        next: () => this.loadIncidencias(),
        error: (err) => alert('Error al eliminar: ' + err.error?.message),
      });
    }
  }

  exportExcel() {
    this.service.exportExcel(this.filters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Registro_Casos_GLD_${new Date().toISOString().substring(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Error al exportar:', err),
    });
  }

  closeModals() {
    this.showFormModal = false;
    this.showDetailModal = false;
    this.editingId = null;
    this.selectedItem = null;
  }
}
