import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmpresasService } from './empresas.service';
import { Empresa } from './empresas.interface';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empresas.html'
})
export class EmpresasComponent {
  private empresasService = inject(EmpresasService);

  empresas = signal<Empresa[]>([]);
  showModal = signal<boolean>(false);
  loading = signal<boolean>(false);
  editingCod = signal<string | null>(null);

  formData: Empresa = {
    CodEmpresa: '',
    RUC: '',
    RazonSocial: '',
    DomicilioFiscal: '',
    DireccionEntrega: '',
    CorreoCompras: '',
  };

  constructor() {
    this.loadEmpresas();
  }

  loadEmpresas() {
    this.loading.set(true);
    this.empresasService.getAll().subscribe({
      next: (data) => {
        this.empresas.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
      },
    });
  }

  openModal() {
    this.editingCod.set(null);
    this.formData = { CodEmpresa: '', RUC: '', RazonSocial: '', DomicilioFiscal: '', DireccionEntrega: '', CorreoCompras: '' };
    this.showModal.set(true);
  }

  editModal(item: Empresa) {
    this.editingCod.set(item.CodEmpresa);
    this.formData = { ...item };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingCod.set(null);
  }

  saveEmpresa() {
    if (!this.formData.CodEmpresa) {
      alert('El Código de Empresa es obligatorio.');
      return;
    }

    const cod = this.editingCod();
    if (cod) {
      this.empresasService.update(cod, this.formData).subscribe({
        next: () => { this.closeModal(); this.loadEmpresas(); },
        error: (err) => alert('Error al actualizar: ' + err.error?.message),
      });
    } else {
      this.empresasService.create(this.formData).subscribe({
        next: () => { this.closeModal(); this.loadEmpresas(); },
        error: (err) => alert('Error al crear: ' + err.error?.message),
      });
    }
  }

  deleteEmpresa(cod: string) {
    if (confirm(`¿Eliminar la empresa "${cod}"? Esta acción no se puede deshacer.`)) {
      this.empresasService.delete(cod).subscribe({
        next: () => this.loadEmpresas(),
        error: (err) => alert('Error al eliminar: ' + err.error?.message),
      });
    }
  }
}
