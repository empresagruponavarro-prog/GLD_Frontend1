import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuariosService } from './usuarios.service';
import { Usuario } from './usuarios.interface';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html'
})
export class UsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  showModal = false;
  editingId: string | null = null;
  loading = false;
  formData: Usuario = { IdUsuario: '', Nombres: '', Usuario: '', Rol: 'Promotor', Clave: '' };

  constructor(private usuariosService: UsuariosService) {}

  ngOnInit() {
    this.loadUsuarios();
  }

  loadUsuarios() {
    this.loading = true;
    this.usuariosService.getAll().subscribe({
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
      this.usuariosService.update(this.editingId, updatePayload).subscribe({
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
