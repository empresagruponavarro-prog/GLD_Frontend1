import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTable } from '../../../shared/interfaces';
import { AlmacenService } from '../almacen.service';
import { KardexRow, MOTIVO_LABEL, SelectOption } from '../almacen.models';
import { ProductoElegido, ProductoPickerComponent } from '../producto-picker/producto-picker';
import { fmtMoney, fmtNum } from '../almacen.utils';

@Component({
  selector: 'app-kardex',
  standalone: true,
  imports: [DataTableComponent, ProductoPickerComponent],
  templateUrl: './kardex.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KardexComponent {
  private readonly service = inject(AlmacenService);
  private readonly route = inject(ActivatedRoute);

  protected readonly motivoLabel: Record<string, string | undefined> = MOTIVO_LABEL;
  protected readonly fmtNum = fmtNum;
  protected readonly fmtMoney = fmtMoney;

  protected readonly columns: DataTable[] = [
    { label: 'Fecha', width: '100px' },
    { label: 'Movimiento', width: '150px' },
    { label: 'Documento', width: '120px' },
    { label: 'Producto' },
    { label: 'Almacén', width: '130px' },
    { label: 'Entrada', align: 'right', width: '80px' },
    { label: 'Salida', align: 'right', width: '80px' },
    { label: 'Saldo alm.', align: 'right', width: '90px' },
    { label: 'Saldo total', align: 'right', width: '90px' },
    { label: 'C. unit.', align: 'right', width: '90px' },
    { label: 'C. promedio', align: 'right', width: '100px' },
    { label: 'Proveedor / destino' },
  ];

  protected readonly items = signal<KardexRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(50);
  protected readonly isLoading = signal(false);
  protected readonly almacenes = signal<SelectOption[]>([]);

  protected readonly productoId = signal<number | null>(null);
  protected readonly productoLabel = signal('');
  protected readonly almacenId = signal<number | null>(null);
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  constructor() {
    this.service.getAlmacenesSelect().subscribe({ next: (r) => this.almacenes.set(r), error: () => this.almacenes.set([]) });
    const preset = Number(this.route.snapshot.queryParamMap.get('producto'));
    if (preset > 0) {
      this.productoId.set(preset);
      this.productoLabel.set(`Producto #${preset}`);
    }
    this.load();
  }

  protected onProductoPicked(p: ProductoElegido): void {
    this.productoId.set(p.id);
    this.productoLabel.set(`${p.codigo} — ${p.descripcion}`);
    this.applyFilters();
  }

  protected clearProducto(): void {
    this.productoId.set(null);
    this.productoLabel.set('');
    this.applyFilters();
  }

  protected setAlmacen(value: string): void {
    this.almacenId.set(value === '' ? null : Number(value));
    this.applyFilters();
  }

  protected setFecha(target: 'desde' | 'hasta', value: string): void {
    (target === 'desde' ? this.desde : this.hasta).set(value);
    this.applyFilters();
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.service
      .getKardex({
        page: this.page(),
        pageSize: this.pageSize(),
        id_producto: this.productoId() ?? undefined,
        id_almacen: this.almacenId() ?? undefined,
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data);
          this.total.set(res.total);
          if (this.productoId() && res.data.length > 0 && this.productoLabel().startsWith('Producto #')) {
            this.productoLabel.set(`${res.data[0].codigo} — ${res.data[0].descripcion}`);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.items.set([]);
          this.total.set(0);
          this.isLoading.set(false);
        },
      });
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
