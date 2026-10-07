import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SearchSelectOption {
  id: number;
  nombre: string | null;
}

const MAX_VISIBLE = 50;

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Selector con búsqueda local para listas largas (proveedores, trabajadores,
 * centros de costos). Se integra con Reactive Forms como `FormControl<number | null>`.
 */
@Component({
  selector: 'app-search-select',
  standalone: true,
  templateUrl: './search-select.html',
  styleUrl: './search-select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchSelectComponent), multi: true }],
})
export class SearchSelectComponent implements ControlValueAccessor {
  readonly options = input<SearchSelectOption[]>([]);
  readonly placeholder = input<string>('Buscar...');
  /** `id` del input interno, para asociarlo con un `<label for>`. */
  readonly inputId = input<string>('');

  protected readonly term = signal('');
  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);
  protected readonly selectedId = signal<number | null>(null);

  protected readonly selectedLabel = computed(
    () => this.options().find((o) => o.id === this.selectedId())?.nombre ?? '',
  );

  protected readonly filtered = computed(() => {
    const term = normalize(this.term().trim());
    const list = this.options();
    const matches = term ? list.filter((o) => normalize(o.nombre ?? '').includes(term)) : list;
    return matches.slice(0, MAX_VISIBLE);
  });

  protected readonly hasMore = computed(() => {
    const term = normalize(this.term().trim());
    const list = this.options();
    const total = term ? list.filter((o) => normalize(o.nombre ?? '').includes(term)).length : list.length;
    return total > MAX_VISIBLE;
  });

  private onChange: (value: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: number | null): void {
    this.selectedId.set(value ?? null);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  protected onFocus(): void {
    this.term.set('');
    this.isOpen.set(true);
  }

  protected onInput(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
    this.isOpen.set(true);
  }

  protected onBlur(): void {
    this.isOpen.set(false);
    this.onTouched();
  }

  protected pick(option: SearchSelectOption): void {
    this.selectedId.set(option.id);
    this.onChange(option.id);
    this.isOpen.set(false);
  }

  protected clear(): void {
    this.selectedId.set(null);
    this.onChange(null);
  }
}
