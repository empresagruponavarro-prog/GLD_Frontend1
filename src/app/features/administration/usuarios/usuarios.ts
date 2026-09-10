import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuariosService } from './usuarios.service';
import { Usuario } from './interfaces';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html'
})
export class UsuariosComponent {
  private usuariosService = inject(UsuariosService);

  usuarios = signal<Usuario[]>([]);
  showModal = signal<boolean>(false);
  editingId = signal<string | null>(null);
  loading = signal<boolean>(false);
  formData: Usuario = { IdUsuario: '', Nombres: '', Usuario: '', Rol: 'Promotor', Clave: '' };

  constructor() {
    this.loadUsuarios();
  }

  loadUsuarios() {
    this.loading.set(true);
    this.usuariosService.getAll().subscribe({
      next: (data) => {
        this.usuarios.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
      },
    });
  }

  openModal() {
    this.editingId.set(null);
    this.formData = { IdUsuario: '', Nombres: '', Usuario: '', Rol: 'Promotor', Clave: '' };
    this.showModal.set(true);
  }

  editModal(item: Usuario) {
    this.editingId.set(item.IdUsuario);
    this.formData = { ...item, Clave: '' };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
  }

  saveUsuario() {
    if (!this.formData.IdUsuario || !this.formData.Nombres || !this.formData.Usuario) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    const editId = this.editingId();
    if (editId) {
      const updatePayload: any = {
        Nombres: this.formData.Nombres,
        Usuario: this.formData.Usuario,
        Rol: this.formData.Rol,
      };
      if (this.formData.Clave) {
        updatePayload.Clave = this.formData.Clave;
      }
      this.usuariosService.update(editId, updatePayload).subscribe({
        next: () => { this.closeModal(); this.loadUsuarios(); },
        error: (err) => alert('Error al actualizar: ' + err.error?.message),
      });
    } else {
      this.usuariosService.create(this.formData).subscribe({
        next: () => { this.closeModal(); this.loadUsuarios(); },
        error: (err) => alert('Error al crear: ' + err.error?.message),
      });
    }
  }

  deleteUsuario(id: string) {
    if (confirm(`¿Eliminar el usuario "${id}"? Esta acción no se puede deshacer.`)) {
      this.usuariosService.delete(id).subscribe({
        next: () => this.loadUsuarios(),
        error: (err) => alert('Error al eliminar: ' + err.error?.message),
      });
    }
  }
}
