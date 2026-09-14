import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmpresasService } from './empresas.service';
import { Empresa } from './interfaces';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTable } from '../../../shared/interfaces';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './empresas.html'
})
export class EmpresasComponent {
  private empresasService = inject(EmpresasService);

  columns: DataTable[] = [
    { label: 'Código' },
    { label: 'RUC' },
    { label: 'Razón Social' },
    { label: 'Domicilio Fiscal' },
    { label: 'Dirección Entrega' },
    { label: 'Correo Compras' },
    { label: 'Acciones' }
  ];

  empresas = signal<Empresa[]>([]);
  showModal = signal<boolean>(false);
  loading = signal<boolean>(false);
  editingId = signal<number | string | null>(null);

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
    this.editingId.set(null);
    this.formData = { CodEmpresa: '', RUC: '', RazonSocial: '', DomicilioFiscal: '', DireccionEntrega: '', CorreoCompras: '' };
    this.showModal.set(true);
  }

  editModal(item: Empresa) {
    const id = item.id ?? item.id_empresa ?? item.CodEmpresa;
    this.editingId.set(id);
    this.formData = { ...item };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
  }

  saveEmpresa() {
    if (!this.formData.CodEmpresa) {
      alert('El Código de Empresa es obligatorio.');
      return;
    }

    const id = this.editingId();
    if (id !== null) {
      this.empresasService.update(id, this.formData).subscribe({
        next: () => { this.closeModal(); this.loadEmpresas(); },
        error: (err) => alert('Error al actualizar: ' + (err.error?.message || err.message)),
      });
    } else {
      this.empresasService.create(this.formData).subscribe({
        next: () => { this.closeModal(); this.loadEmpresas(); },
        error: (err) => alert('Error al crear: ' + (err.error?.message || err.message)),
      });
    }
  }

  deleteEmpresa(item: Empresa) {
    const targetId = item.id ?? item.id_empresa ?? item.CodEmpresa;
    const label = item.RazonSocial || item.CodEmpresa;
    if (confirm(`¿Eliminar la empresa "${label}"? Esta acción no se puede deshacer.`)) {
      this.empresasService.delete(targetId).subscribe({
        next: () => this.loadEmpresas(),
        error: (err) => alert('Error al eliminar: ' + (err.error?.message || err.message)),
      });
    }
  }
}
