import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Usuario {
  IdUsuario: string;
  Nombres: string;
  Usuario: string;
  Clave?: string;
  Rol?: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="content-header">
      <div>
        <h1 class="content-title">Administración de Usuarios y Roles</h1>
        <p class="content-subtitle">Gestión centralizada de usuarios, accesos y permisos en GLD.</p>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary" (click)="loadUsuarios()" [disabled]="loading">
          <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="loading"></i> {{ loading ? 'Actualizando...' : 'Actualizar' }}
        </button>
        <button class="btn btn-primary" (click)="openModal()">
          <i class="fa-solid fa-user-plus"></i> + Nuevo Usuario
        </button>
      </div>
    </div>

    <div class="content-body">
      <div class="table-card">
        <table class="table">
          <thead>
            <tr>
              <th>ID Usuario</th>
              <th>Nombres Completos</th>
              <th>Usuario / Login</th>
              <th>Rol Asignado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of usuarios">
              <td><strong>{{ item.IdUsuario }}</strong></td>
              <td>{{ item.Nombres }}</td>
              <td>{{ item.Usuario }}</td>
              <td>
                <span class="badge badge-progress">{{ item.Rol || 'Sin Rol' }}</span>
              </td>
              <td>
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; margin-right: 0.25rem;" (click)="editModal(item)" title="Editar">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn btn-danger" style="padding: 0.25rem 0.5rem;" (click)="deleteUsuario(item.IdUsuario)" title="Eliminar">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </td>
            </tr>
            <tr *ngIf="usuarios.length === 0">
              <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
                <i class="fa-solid fa-users-slash" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                No se registraron usuarios aún.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Formulario -->
    <div class="modal-overlay" *ngIf="showModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingId ? 'Editar Usuario' : 'Nuevo Usuario' }}</h3>
          <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem;" (click)="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>ID / Código Usuario *</label>
            <input type="text" class="form-control" [(ngModel)]="formData.IdUsuario"
              placeholder="Ej. USR001"
              [disabled]="!!editingId"
              [style.background]="editingId ? '#f1f5f9' : ''">
            <small *ngIf="editingId" style="color: var(--text-muted); font-size: 0.75rem;">El ID no se puede modificar.</small>
          </div>
          <div class="form-group">
            <label>Nombres Completos *</label>
            <input type="text" class="form-control" [(ngModel)]="formData.Nombres" placeholder="Ej. Carlos Mendoza">
          </div>
          <div class="form-group">
            <label>Nombre de Usuario (Login) *</label>
            <input type="text" class="form-control" [(ngModel)]="formData.Usuario" placeholder="Ej. cmendoza">
          </div>
          <div class="form-group">
            <label>Rol Asignado</label>
            <select class="form-control" [(ngModel)]="formData.Rol">
              <option value="Administrador">Administrador</option>
              <option value="Promotor">Promotor</option>
              <option value="Supervisor">Supervisor</option>
              <option value="Operador">Operador</option>
            </select>
          </div>
          <div class="form-group" *ngIf="!editingId">
            <label>Contraseña</label>
            <input type="password" class="form-control" [(ngModel)]="formData.Clave" placeholder="Dejar en blanco para usar 123456">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
          <button class="btn btn-primary" (click)="saveUsuario()">
            <i class="fa-solid fa-floppy-disk"></i> {{ editingId ? 'Guardar Cambios' : 'Crear Usuario' }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class UsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  showModal = false;
  editingId: string | null = null;
  loading = false;
  formData: Usuario = { IdUsuario: '', Nombres: '', Usuario: '', Rol: 'Promotor', Clave: '' };

  private apiUrl = 'http://localhost:3000/administration/usuarios';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadUsuarios();
  }

  loadUsuarios() {
    this.loading = true;
    this.http.get<Usuario[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.usuarios = data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      },
    });
  }

  openModal() {
    this.editingId = null;
    this.formData = { IdUsuario: '', Nombres: '', Usuario: '', Rol: 'Promotor', Clave: '' };
    this.showModal = true;
  }

  editModal(item: Usuario) {
    this.editingId = item.IdUsuario;
    this.formData = { ...item, Clave: '' };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingId = null;
  }

  saveUsuario() {
    if (!this.formData.IdUsuario || !this.formData.Nombres || !this.formData.Usuario) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    if (this.editingId) {
      const updatePayload: any = {
        Nombres: this.formData.Nombres,
        Usuario: this.formData.Usuario,
        Rol: this.formData.Rol,
      };
      if (this.formData.Clave) {
        updatePayload.Clave = this.formData.Clave;
      }
      this.http.patch<Usuario>(`${this.apiUrl}/${this.editingId}`, updatePayload).subscribe({
        next: () => { this.closeModal(); this.loadUsuarios(); },
        error: (err) => alert('Error al actualizar: ' + err.error?.message),
      });
    } else {
      this.http.post<Usuario>(this.apiUrl, this.formData).subscribe({
        next: () => { this.closeModal(); this.loadUsuarios(); },
        error: (err) => alert('Error al crear: ' + err.error?.message),
      });
    }
  }

  deleteUsuario(id: string) {
    if (confirm(`¿Eliminar el usuario "${id}"? Esta acción no se puede deshacer.`)) {
      this.http.delete(`${this.apiUrl}/${id}`).subscribe({
        next: () => this.loadUsuarios(),
        error: (err) => alert('Error al eliminar: ' + err.error?.message),
      });
    }
  }
}
