import { Component, computed, input, output, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTable } from '../../interfaces/data-table.interface';
import { valorDeEvento } from '../../utils/eventos';

/** Contexto de la plantilla de fila (`<ng-template #fila let-item let-i="index">`). */
export interface FilaDataTable {
  $implicit: unknown;
  index: number;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.html',
})
export class DataTableComponent {
  columns = input<DataTable[]>([]);
  items = input<readonly unknown[]>([]);
  loading = input<boolean>(false);
  totalItems = input<number>(0);
  currentPage = input<number>(1);
  pageSize = input<number>(10);
  pageSizeOptions = input<number[]>([10, 20, 50, 100]);
  emptyMessage = input<string>('No hay registros disponibles.');
  emptyIcon = input<string>('fa-solid fa-folder-open');
  minWidth = input<string>('900px');
  rowTemplate = input<TemplateRef<FilaDataTable> | undefined>(undefined);

  pageChange = output<number>();
  pageSizeChange = output<number>();

  totalPages = computed(() => {
    const total = this.totalItems() > 0 ? this.totalItems() : this.items().length;
    const size = this.pageSize() > 0 ? this.pageSize() : 10;
    return Math.max(1, Math.ceil(total / size));
  });

  onPageSizeSelect(event: Event): void {
    const val = Number(valorDeEvento(event));
    this.pageSizeChange.emit(val);
  }

  /** Valor de la columna `key` de una fila (filas sin plantilla propia). */
  celda(item: unknown, key: string): unknown {
    if (typeof item !== 'object' || item === null || !(key in item)) return undefined;
    const valor: unknown = Reflect.get(item, key);
    return valor;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.pageChange.emit(page);
    }
  }
}
