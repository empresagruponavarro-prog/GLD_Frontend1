import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { AlmacenService } from '../almacen.service';
import { ClaseInventario, StockRow } from '../almacen.models';

export interface ProductoElegido {
  id: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  disponible: string;
  costo_promedio: string;
}

/** Buscador remoto de productos por código o descripción (la lista tiene miles de filas). */
@Component({
  selector: 'app-producto-picker',
  standalone: true,
  templateUrl: './producto-picker.html',
  styleUrl: './producto-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoPickerComponent {
  private readonly service = inject(AlmacenService);
  private readonly destroyRef = inject(DestroyRef);

  /** Texto a mostrar cuando ya hay un producto elegido. */
  readonly label = input<string>('');
  readonly placeholder = input<string>('Buscar por código o descripción...');
  /** Restringe la búsqueda (p. ej. solo equipos retornables en préstamos). */
  readonly clase = input<ClaseInventario | undefined>(undefined);
  readonly picked = output<ProductoElegido>();

  protected readonly term = signal('');
  protected readonly isOpen = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly results = signal<StockRow[]>([]);

  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.length < 2) {
            this.isLoading.set(false);
            return of(null);
          }
          this.isLoading.set(true);
          return this.service.getStock({ q, incluir_sin_stock: true, pageSize: 10, clase_inventario: this.clase() });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.results.set(res?.data ?? []);
          this.isLoading.set(false);
        },
        error: () => {
          this.results.set([]);
          this.isLoading.set(false);
        },
      });
  }

  protected onFocus(): void {
    this.term.set('');
    this.isOpen.set(true);
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.term.set(value);
    this.isOpen.set(true);
    this.search$.next(value.trim());
  }

  protected onBlur(): void {
    this.isOpen.set(false);
  }

  protected pick(row: StockRow): void {
    this.picked.emit({
      id: row.id_producto,
      codigo: row.codigo,
      descripcion: row.descripcion,
      unidad: row.unidad,
      disponible: row.disponible,
      costo_promedio: row.costo_promedio,
    });
    this.isOpen.set(false);
  }
}
