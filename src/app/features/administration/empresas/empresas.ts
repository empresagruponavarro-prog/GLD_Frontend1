import { Component, OnInit } from '@angular/core';
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

  constructor(private empresasService: EmpresasService) {}

  ngOnInit() {
    this.loadEmpresas();
  }

  loadEmpresas() {
    this.loading = true;
    this.empresasService.getAll().subscribe({
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
      this.empresasService.update(this.editingCod, this.formData).subscribe({
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
