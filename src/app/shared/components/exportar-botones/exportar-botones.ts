import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { DatosExportacion, FormatoExportacion, exportarDatos } from '../../utils/exportar';

/** Par de botones "Excel" y "CSV" que descargan los datos que la pantalla tiene filtrados. */
@Component({
  selector: 'app-exportar-botones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn btn-primary"
      style="background: #10b981; border-color: #10b981;"
      [disabled]="deshabilitado()"
      (click)="exportar('xlsx')"
    >
      <i class="fa-solid fa-file-excel"></i> Exportar Excel
    </button>
    <button type="button" class="btn btn-secondary" [disabled]="deshabilitado()" (click)="exportar('csv')">
      <i class="fa-solid fa-file-csv"></i> Exportar CSV
    </button>
  `,
  styles: [':host { display: contents; }'],
})
export class ExportarBotonesComponent {
  /** Datos ya en memoria (pantallas que cargan todo el listado). */
  datos = input<DatosExportacion | undefined>(undefined);
  /** Obtiene los datos al pulsar (pantallas paginadas: trae todas las páginas con los filtros activos). */
  obtener = input<(() => Promise<DatosExportacion>) | undefined>(undefined);
  /** Bloquea los botones mientras la pantalla carga. */
  cargando = input<boolean>(false);

  protected readonly exportando = signal(false);

  protected deshabilitado(): boolean {
    if (this.exportando() || this.cargando()) return true;
    const datos = this.datos();
    if (datos) return datos.filas.length === 0;
    return this.obtener() === undefined;
  }

  protected async exportar(formato: FormatoExportacion): Promise<void> {
    if (this.deshabilitado()) return;
    this.exportando.set(true);
    try {
      const datos = this.datos() ?? (await this.obtener()?.());
      if (!datos || datos.filas.length === 0) {
        alert('No hay registros para exportar.');
        return;
      }
      await exportarDatos(datos, formato);
    } catch (err: unknown) {
      console.error('Error al exportar:', err);
      alert('No se pudo generar el archivo. Intente nuevamente.');
    } finally {
      this.exportando.set(false);
    }
  }
}
