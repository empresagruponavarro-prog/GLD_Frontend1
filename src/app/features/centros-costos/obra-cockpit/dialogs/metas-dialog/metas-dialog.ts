import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { valorDeEvento } from '@shared/utils/eventos';
import { lunesDeIso, metasAutomaticas, sumaMetas } from '../../obra-control.calc';
import { ObraSubpartida, SEMANAS_META } from '../../obra-control.interface';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';
import { ObraService } from '../../obra.service';

/**
 * Metas semanales (semanas 1-10) de una subpartida (RF-OP-07). Una celda vacía usa el reparto
 * automático por días laborables; escribir un valor la reemplaza. Cada subpartida debe sumar 100.
 */
@Component({
  selector: 'app-metas-dialog',
  standalone: true,
  imports: [DecimalPipe, ModalComponent],
  templateUrl: './metas-dialog.html',
  styleUrl: '../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetasDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly subpartida = input<ObraSubpartida | null>(null);
  /** Inicio de la obra (`YYYY-MM-DD`): la semana 1 es la que lo contiene. Sirve para calcular el reparto automático. */
  readonly inicioObra = input('');
  /** Permisos de `obra`: fijar metas (`PUT …/metas`) exige `editar`. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly semanas = Array.from({ length: SEMANAS_META }, (_v, i) => i + 1);
  protected readonly valorDe = valorDeEvento;
  /** Texto escrito en cada semana ('' = automática). */
  protected readonly textos = signal<string[]>(Array(SEMANAS_META).fill(''));
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeGuardar = computed(() => this.permisos().editar);

  /** Error por semana (null = válida). */
  protected readonly errores = computed(() =>
    this.textos().map((t) => {
      const x = t.trim().replace(',', '.');
      if (x === '') return null;
      const n = Number(x);
      return Number.isFinite(n) && n >= 0 && n <= 100 ? null : 'De 0 a 100';
    }),
  );
  protected readonly hayErrores = computed(() => this.errores().some((e) => e !== null));
  /** Reparto automático por días laborables: lo que valdrá una semana si se deja vacía. */
  protected readonly automaticas = computed(() => {
    const sp = this.subpartida();
    if (!sp) return Array<number>(SEMANAS_META).fill(0);
    return metasAutomaticas(sp.fecha_inicio, sp.fecha_fin, lunesDeIso(this.inicioObra() || sp.fecha_inicio));
  });
  /** Meta que valdrá cada semana al guardar: la escrita o, si está vacía, la automática. */
  protected readonly efectivas = computed(() => this.textos().map((t, i) => (t.trim() === '' ? (this.automaticas()[i] ?? 0) : Number(t.trim().replace(',', '.')) || 0)));
  protected readonly suma = computed(() => sumaMetas(this.efectivas()));
  protected readonly sumaOk = computed(() => Math.abs(this.suma() - 100) <= 0.5);

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const s = this.subpartida();
      this.textos.set(Array.from({ length: SEMANAS_META }, (_v, i) => (s?.metas_manuales[i] == null ? '' : String(s.metas_manuales[i]))));
    });
  }

  protected escribir(indice: number, texto: string): void {
    this.textos.update((t) => t.map((v, i) => (i === indice ? texto : v)));
  }

  protected restablecer(): void {
    this.textos.set(Array(SEMANAS_META).fill(''));
  }

  protected onSubmit(): void {
    const s = this.subpartida();
    if (!this.puedeGuardar() || !s) return;
    if (this.hayErrores()) {
      this.formError.set('Cada meta debe ser un número de 0 a 100 (o quedar vacía).');
      return;
    }
    const metas = this.textos().map((t) => {
      const x = t.trim().replace(',', '.');
      return x === '' ? null : Math.round(Number(x) * 10) / 10;
    });
    this.isSaving.set(true);
    this.formError.set('');
    this.#service.updateMetas(this.idCentroCosto(), s.id, metas).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }
}
