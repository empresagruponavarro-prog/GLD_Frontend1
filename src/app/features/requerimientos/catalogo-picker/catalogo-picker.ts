import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { ItemCatalogo } from '../requerimientos.models';
import { RequerimientosService } from '../requerimientos.service';

/** Buscador remoto del catálogo de bienes y servicios (productos y servicios, sin depender del stock). */
@Component({
  selector: 'app-catalogo-picker',
  standalone: true,
  templateUrl: './catalogo-picker.html',
  styleUrl: './catalogo-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoPickerComponent {
  private readonly service = inject(RequerimientosService);
  private readonly destroyRef = inject(DestroyRef);

  /** Texto a mostrar cuando ya hay un ítem elegido. */
  readonly label = input<string>('');
  readonly placeholder = input<string>('Buscar producto o servicio por código o descripción...');
  readonly disabled = input<boolean>(false);
  readonly picked = output<ItemCatalogo>();

  protected readonly term = signal('');
  protected readonly isOpen = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly results = signal<ItemCatalogo[]>([]);

  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.length < 2) {
            this.isLoading.set(false);
            return of<ItemCatalogo[]>([]);
          }
          this.isLoading.set(true);
          return this.service.buscarCatalogo(q).pipe(catchError(() => of<ItemCatalogo[]>([])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.results.set(items);
        this.isLoading.set(false);
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

  protected pick(item: ItemCatalogo): void {
    this.picked.emit(item);
    this.isOpen.set(false);
  }
}
