import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTable } from '../../../shared/interfaces';
import { AlmacenService } from '../almacen.service';
import {
  ALERTA_LABEL,
  Alerta,
  CLASE_LABEL,
  ClaseInventario,
  FamiliaOption,
  SelectOption,
  StockQuery,
  StockRow,
} from '../almacen.models';
import { alertaBadge, fmtMoney, fmtNum } from '../almacen.utils';

type Vista = 'stock' | 'compra';

@Component({
  selector: 'app-stock-actual',
  standalone: true,
  imports: [RouterLink, DataTableComponent],
  templateUrl: './stock.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockActualComponent {
  private readonly service = inject(AlmacenService);

  protected readonly alertaLabel = ALERTA_LABEL;
  protected readonly claseLabel = CLASE_LABEL;
  protected readonly alertaBadge = alertaBadge;
  protected readonly fmtNum = fmtNum;
  protected readonly fmtMoney = fmtMoney;
  protected readonly clases = Object.keys(CLASE_LABEL) as ClaseInventario[];
  protected readonly alertas = Object.keys(ALERTA_LABEL) as Alerta[];

  protected readonly vista = signal<Vista>('stock');
  protected readonly items = signal<StockRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly isLoading = signal(false);

  protected readonly almacenes = signal<SelectOption[]>([]);
  protected readonly familias = signal<FamiliaOption[]>([]);

  protected readonly q = signal('');
  protected readonly almacenId = signal<number | null>(null);
  protected readonly familiaId = signal<number | null>(null);
  protected readonly clase = signal<ClaseInventario | ''>('');
  protected readonly alerta = signal<Alerta | ''>('');
  protected readonly incluirSinStock = signal(false);

  protected readonly columns = computed<DataTable[]>(() =>
    this.vista() === 'stock'
      ? [
          { label: 'Código', width: '110px' },
          { label: 'Producto' },
          { label: 'Clase', width: '130px' },
          { label: 'Stock', align: 'right', width: '90px' },
          { label: 'Prestado', align: 'right', width: '90px' },
          { label: 'No oper.', align: 'right', width: '90px' },
          { label: 'Disponible', align: 'right', width: '100px' },
          { label: 'Mín / Obj', align: 'right', width: '100px' },
          { label: 'P. promedio', align: 'right', width: '110px' },
          { label: 'Valor', align: 'right', width: '110px' },
          { label: 'Alerta', align: 'center', width: '140px' },
          { label: '', width: '50px' },
        ]
      : [
          { label: 'Código', width: '110px' },
          { label: 'Producto' },
          { label: 'Unidad', width: '80px' },
          { label: 'Disponible', align: 'right', width: '100px' },
          { label: 'Mínimo', align: 'right', width: '90px' },
          { label: 'Objetivo', align: 'right', width: '90px' },
          { label: 'Compra sugerida', align: 'right', width: '140px' },
          { label: 'P. promedio', align: 'right', width: '110px' },
          { label: '', width: '50px' },
        ],
  );

  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.service.getAlmacenesSelect().subscribe({ next: (r) => this.almacenes.set(r), error: () => this.almacenes.set([]) });
    this.service.getFamiliasSelect().subscribe({ next: (r) => this.familias.set(r), error: () => this.familias.set([]) });
    this.load();
  }

  protected setVista(vista: Vista): void {
    this.vista.set(vista);
    this.page.set(1);
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    const query: StockQuery = {
      page: this.page(),
      pageSize: this.pageSize(),
      q: this.q().trim() || undefined,
      id_almacen: this.almacenId() ?? undefined,
      id_familia: this.familiaId() ?? undefined,
      clase_inventario: this.clase() || undefined,
      alerta: this.vista() === 'stock' ? this.alerta() || undefined : undefined,
      incluir_sin_stock: this.vista() === 'stock' && this.incluirSinStock() ? true : undefined,
    };
    const request$ = this.vista() === 'stock' ? this.service.getStock(query) : this.service.getCompraSugerida(query);
    request$.subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.total.set(res.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.total.set(0);
        this.isLoading.set(false);
      },
    });
  }

  protected onSearch(value: string): void {
    this.q.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.applyFilters(), 350);
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected setNumber(target: 'almacen' | 'familia', value: string): void {
    const parsed = value === '' ? null : Number(value);
    (target === 'almacen' ? this.almacenId : this.familiaId).set(parsed);
    this.applyFilters();
  }

  protected setClase(value: string): void {
    this.clase.set(value as ClaseInventario | '');
    this.applyFilters();
  }

  protected setAlerta(value: string): void {
    this.alerta.set(value as Alerta | '');
    this.applyFilters();
  }

  protected toggleSinStock(checked: boolean): void {
    this.incluirSinStock.set(checked);
    this.applyFilters();
  }

  protected reset(): void {
    this.q.set('');
    this.almacenId.set(null);
    this.familiaId.set(null);
    this.clase.set('');
    this.alerta.set('');
    this.incluirSinStock.set(false);
    this.applyFilters();
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }
}
