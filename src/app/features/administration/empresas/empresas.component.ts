import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Empresa {
  CodEmpresa: string;
  RUC?: string;
  RazonSocial?: string;
  DomicilioFiscal?: string;
  DireccionEntrega?: string;
  CorreoCompras?: string;
}

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="content-header">
      <div>
        <h1 class="content-title">Empresas</h1>
        <p class="content-subtitle">Administración de empresas registradas en el sistema GLD.</p>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary" (click)="loadEmpresas()" [disabled]="loading">
          <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="loading"></i> {{ loading ? 'Actualizando...' : 'Actualizar' }}
        </button>
        <button class="btn btn-primary" (click)="openModal()">
          <i class="fa-solid fa-building-circle-check"></i> + Nueva Empresa
        </button>
      </div>
    </div>

    <div class="content-body">
      <div class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>RUC</th>
              <th>Razón Social</th>
              <th>Domicilio Fiscal</th>
              <th>Dirección Entrega</th>
              <th>Correo Compras</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of empresas">
              <td><strong>{{ item.CodEmpresa }}</strong></td>
              <td>{{ item.RUC || '—' }}</td>
              <td>{{ item.RazonSocial || '—' }}</td>
              <td>{{ item.DomicilioFiscal || '—' }}</td>
              <td>{{ item.DireccionEntrega || '—' }}</td>
              <td>{{ item.CorreoCompras || '—' }}</td>
              <td>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; margin-right: 0.25rem;" (click)="editModal(item)" title="Editar">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn btn-danger" style="padding: 0.25rem 0.5rem;" (click)="deleteEmpresa(item.CodEmpresa)" title="Eliminar">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </td>
            </tr>
            <tr *ngIf="empresas.length === 0 && !loading">
              <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fa-solid fa-building-circle-xmark" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block;"></i>
                No se encontraron empresas registradas.
              </td>
            </tr>
            <tr *ngIf="loading">
              <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fa-solid fa-spinner fa-spin"></i> Cargando...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Formulario -->
    <div class="modal-overlay" *ngIf="showModal">
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h3 style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid fa-building"></i>
            {{ editingCod ? 'Editar Empresa' : 'Nueva Empresa' }}
          </h3>
          <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem;" (click)="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Código de Empresa *</label>
            <input type="text" class="form-control" [(ngModel)]="formData.CodEmpresa"
              placeholder="Ej. EMP001" [disabled]="!!editingCod"
              [style.background]="editingCod ? '#f1f5f9' : ''">
            <small *ngIf="editingCod" style="color: var(--text-muted); font-size: 0.75rem;">
              El código no se puede modificar una vez creado.
            </small>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label>RUC</label>
              <input type="text" class="form-control" [(ngModel)]="formData.RUC" placeholder="Ej. 20123456789" maxlength="11">
            </div>
            <div class="form-group">
              <label>Correo de Compras</label>
              <input type="email" class="form-control" [(ngModel)]="formData.CorreoCompras" placeholder="compras@empresa.com">
            </div>
          </div>
          <div class="form-group">
            <label>Razón Social</label>
            <input type="text" class="form-control" [(ngModel)]="formData.RazonSocial" placeholder="Nombre legal de la empresa">
          </div>
          <div class="form-group">
            <label>Domicilio Fiscal</label>
            <input type="text" class="form-control" [(ngModel)]="formData.DomicilioFiscal" placeholder="Dirección fiscal registrada en SUNAT">
          </div>
          <div class="form-group">
            <label>Dirección de Entrega</label>
            <input type="text" class="form-control" [(ngModel)]="formData.DireccionEntrega" placeholder="Dirección operativa de entrega">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
          <button class="btn btn-primary" (click)="saveEmpresa()">
            <i class="fa-solid fa-floppy-disk"></i> Guardar Empresa
          </button>
        </div>
      </div>
    </div>
  `
})
export class EmpresasComponent implements OnInit {
  empresas: Empresa[] = [];
  showModal = false;
  loading = false;
  editingCod: string | null = null;

  formData: Empresa = {
    CodEmpresa: '',
    RUC: '',
    RazonSocial: '',
    DomicilioFiscal: '',
    DireccionEntrega: '',
    CorreoCompras: '',
  };

  private apiUrl = 'http://localhost:3000/administration/empresas';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadEmpresas();
  }

  loadEmpresas() {
    this.loading = true;
    this.http.get<Empresa[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.empresas = data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      },
    });
  }

  openModal() {
    this.editingCod = null;
    this.formData = { CodEmpresa: '', RUC: '', RazonSocial: '', DomicilioFiscal: '', DireccionEntrega: '', CorreoCompras: '' };
    this.showModal = true;
  }

  editModal(item: Empresa) {
    this.editingCod = item.CodEmpresa;
    this.formData = { ...item };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingCod = null;
  }

  saveEmpresa() {
    if (!this.formData.CodEmpresa) {
      alert('El Código de Empresa es obligatorio.');
      return;
    }

    if (this.editingCod) {
      this.http.patch<Empresa>(`${this.apiUrl}/${this.editingCod}`, this.formData).subscribe({
        next: () => { this.closeModal(); this.loadEmpresas(); },
        error: (err) => alert('Error al actualizar: ' + err.error?.message),
      });
    } else {
      this.http.post<Empresa>(this.apiUrl, this.formData).subscribe({
        next: () => { this.closeModal(); this.loadEmpresas(); },
        error: (err) => alert('Error al crear: ' + err.error?.message),
      });
    }
  }

  deleteEmpresa(cod: string) {
    if (confirm(`¿Eliminar la empresa "${cod}"? Esta acción no se puede deshacer.`)) {
      this.http.delete(`${this.apiUrl}/${cod}`).subscribe({
        next: () => this.loadEmpresas(),
        error: (err) => alert('Error al eliminar: ' + err.error?.message),
      });
    }
  }
}
