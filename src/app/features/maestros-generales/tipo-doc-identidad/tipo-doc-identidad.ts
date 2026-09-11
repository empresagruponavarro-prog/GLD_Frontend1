import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TipoDocIdentidadService } from './tipo-doc-identidad.service';
import { TipoDocIdentidad } from './interfaces/tipo-doc-identidad.interface';

@Component({
  selector: 'app-tipo-doc-identidad',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="content-header">
      <div>
        <h1 class="content-title">Tipo de Documento de Identidad</h1>
        <p class="content-subtitle">Maestro de documento de identidad</p>
      </div>
    </div>

    <div class="content-body">
      <div class="table-card">
        <div class="table-toolbar">
          <span class="toolbar-title">Listado de documentos</span>
          <button class="btn btn-primary" type="button">
            <i class="fa-solid fa-plus"></i> Nuevo
          </button>
        </div>

        <table class="table table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo Anexo</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of tipos">
              <td>{{ item.id }}</td>
              <td>{{ item.tipoAnexo ?? '—' }}</td>
              <td>{{ item.descripcion ?? '—' }}</td>
            </tr>
            <tr *ngIf="!tipos.length">
              <td colspan="3" class="text-muted text-center">Sin registros</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class TipoDocIdentidadComponent implements OnInit {
  private readonly service = inject(TipoDocIdentidadService);
  tipos: TipoDocIdentidad[] = [];

  ngOnInit(): void {
    this.service.getAll({ page: 1, pageSize: 20 }).subscribe({
      next: (res) => {
        this.tipos = res.data ?? [];
      },
      error: () => {
        this.tipos = [];
      }
    });
  }
}
