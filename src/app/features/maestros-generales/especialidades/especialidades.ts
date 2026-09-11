import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EspecialidadesService } from './especialidades.service';
import { Especialidad } from './interfaces/especialidades.interface';

@Component({
  selector: 'app-especialidades',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="content-header">
      <div>
        <h1 class="content-title">Especialidades</h1>
        <p class="content-subtitle">Maestro de especialidades</p>
      </div>
    </div>

    <div class="content-body">
      <div class="table-card">
        <div class="table-toolbar">
          <span class="toolbar-title">Listado de especialidades</span>
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
            <tr *ngFor="let item of especialidades">
              <td>{{ item.id }}</td>
              <td>{{ item.tipoAnexo ?? '—' }}</td>
              <td>{{ item.descripcion ?? '—' }}</td>
            </tr>
            <tr *ngIf="!especialidades.length">
              <td colspan="3" class="text-muted text-center">Sin registros</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class EspecialidadesComponent implements OnInit {
  private readonly service = inject(EspecialidadesService);
  especialidades: Especialidad[] = [];

  ngOnInit(): void {
    this.service.getAll({ page: 1, pageSize: 20 }).subscribe({
      next: (res) => {
        this.especialidades = res.data ?? [];
      },
      error: () => {
        this.especialidades = [];
      }
    });
  }
}
