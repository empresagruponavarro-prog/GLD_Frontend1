import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnexosService } from './anexos.service';
import { Anexo } from './interfaces/anexos.interface';

@Component({
  selector: 'app-anexos',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="content-header">
      <div>
        <h1 class="content-title">Anexos</h1>
        <p class="content-subtitle">Maestro de anexos</p>
      </div>
    </div>

    <div class="content-body">
      <div class="table-card">
        <div class="table-toolbar">
          <span class="toolbar-title">Listado de anexos</span>
          <button class="btn btn-primary" type="button">
            <i class="fa-solid fa-plus"></i> Nuevo
          </button>
        </div>

        <table class="table table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Especialidad</th>
              <th>Tipo Doc</th>
              <th>Documento</th>
              <th>Anexo</th>
              <th>Nombre Comercial</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of anexos">
              <td>{{ item.id }}</td>
              <td>{{ item.tipoAnexo ?? '—' }}</td>
              <td>{{ item.AnexoEspecialidadId ?? '—' }}</td>
              <td>{{ item.AnexoTipoDocIdeId ?? '—' }}</td>
              <td>{{ item.NumeroDocIde ?? '—' }}</td>
              <td>{{ item.Anexo ?? '—' }}</td>
              <td>{{ item.NombreComercial ?? '—' }}</td>
              <td>
                <span class="badge" [class.badge-success]="item.estado" [class.badge-danger]="!item.estado">
                  {{ item.estado ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
            </tr>
            <tr *ngIf="!anexos.length">
              <td colspan="8" class="text-muted text-center">Sin registros</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class AnexosComponent implements OnInit {
  private readonly service = inject(AnexosService);
  anexos: Anexo[] = [];

  ngOnInit(): void {
    this.service.getAll({ page: 1, pageSize: 20 }).subscribe({
      next: (res) => {
        this.anexos = res.data ?? [];
      },
      error: () => {
        this.anexos = [];
      }
    });
  }
}
