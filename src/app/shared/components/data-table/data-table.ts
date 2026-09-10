import { Component, computed, input, output, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTable } from '../../interfaces/data-table.interface';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.html',
})
export class DataTableComponent {
  columns = input<DataTable[]>([]);
  items = input<any[]>([]);
  loading = input<boolean>(false);
  totalItems = input<number>(0);
  currentPage = input<number>(1);
  pageSize = input<number>(10);
  pageSizeOptions = input<number[]>([10, 20, 50, 100]);
  emptyMessage = input<string>('No hay registros disponibles.');
  emptyIcon = input<string>('fa-solid fa-folder-open');
  minWidth = input<string>('900px');
  rowTemplate = input<TemplateRef<any> | undefined>(undefined);

  pageChange = output<number>();
  pageSizeChange = output<number>();

  totalPages = computed(() => {
    const total = this.totalItems() > 0 ? this.totalItems() : this.items().length;
    const size = this.pageSize() > 0 ? this.pageSize() : 10;
    return Math.max(1, Math.ceil(total / size));
  });

  onPageSizeSelect(event: Event): void {
    const val = Number((event.target as HTMLSelectElement).value);
    this.pageSizeChange.emit(val);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.pageChange.emit(page);
    }
  }
}
