import { KeyValuePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { concat, toArray } from 'rxjs';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { valorDeEvento } from '@shared/utils/eventos';
import {
  CambioAvance,
  agruparPorSemana,
  claveCelda,
  diaMes,
  sumaOtrasSemanas,
  validarAvance,
  valorAvance,
} from '../../../obra-control.calc';
import { AvanceObra, AvanceSubpartida } from '../../../obra-control.interface';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../../obra-permisos';
import { ObraService } from '../../../obra.service';

/**
 * Grilla de avance semanal (RF-OP-08): subpartidas × 16 semanas. Se escribe lo avanzado SOLO esa
 * semana (no el acumulado). Las semanas futuras están bloqueadas y la suma de una subpartida no
 * puede pasar de 100 (RV-07, RV-09, RV-10).
 */
@Component({
  selector: 'app-avance-semanal',
  standalone: true,
  imports: [KeyValuePipe],
  templateUrl: './avance-semanal.html',
  styleUrl: '../../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvanceSemanalComponent {
  readonly #service = inject(ObraService);

  readonly idCentroCosto = input.required<number>();
  readonly avance = input<AvanceObra | null>(null);
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  /** Se guardó al menos una semana: el contenedor recarga el resultado. */
  readonly saved = output<void>();

  protected readonly valorDe = valorDeEvento;
  protected readonly dia = diaMes;
  protected readonly claveCelda = claveCelda;
  /** Lo escrito y todavía no guardado, por celda (`idSubpartida:semana`). */
  protected readonly editados = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeEditar = computed(() => this.permisos().editar);

  /** Error por celda editada. */
  protected readonly errores = computed(() => {
    const out = new Map<string, string>();
    const datos = this.avance();
    if (!datos) return out;
    for (const [clave, texto] of this.editados()) {
      const [id, semana] = clave.split(':').map(Number);
      const sub = datos.subpartidas.find((s) => s.id === id);
      if (!sub) continue;
      const msg = validarAvance(texto, sumaOtrasSemanas(this.#valores(sub), semana));
      if (msg) out.set(clave, msg);
    }
    return out;
  });
  protected readonly hayErrores = computed(() => this.errores().size > 0);
  protected readonly cambios = computed<CambioAvance[]>(() => {
    const datos = this.avance();
    if (!datos) return [];
    const out: CambioAvance[] = [];
    for (const [clave, texto] of this.editados()) {
      const [id, semana] = clave.split(':').map(Number);
      const sub = datos.subpartidas.find((s) => s.id === id);
      if (!sub) continue;
      const nuevo = valorAvance(texto);
      if (nuevo !== (sub.avance[semana - 1] ?? null)) out.push({ idSubpartida: id, semana, avance: nuevo });
    }
    return out;
  });

  constructor() {
    // Datos nuevos del servidor reemplazan lo escrito.
    effect(() => {
      this.avance();
      this.editados.set(new Map());
      this.formError.set('');
    });
  }

  /** Avance de la subpartida con lo escrito aplicado (las celdas inválidas cuentan como vacías). */
  #valores(sub: AvanceSubpartida): (number | null)[] {
    const editados = this.editados();
    return sub.avance.map((v, i) => {
      const t = editados.get(claveCelda(sub.id, i + 1));
      if (t === undefined) return v;
      const x = t.trim().replace(',', '.');
      const n = Number(x);
      return x === '' || !Number.isFinite(n) ? null : n;
    });
  }

  protected texto(sub: AvanceSubpartida, semana: number): string {
    const e = this.editados().get(claveCelda(sub.id, semana));
    if (e !== undefined) return e;
    const v = sub.avance[semana - 1];
    return v == null ? '' : String(v);
  }

  protected escribir(sub: AvanceSubpartida, semana: number, texto: string): void {
    this.editados.update((m) => new Map(m).set(claveCelda(sub.id, semana), texto));
  }

  protected totalReal(sub: AvanceSubpartida): number {
    return Math.round(this.#valores(sub).reduce<number>((a, v) => a + (v ?? 0), 0) * 10) / 10;
  }

  protected meta(sub: AvanceSubpartida, semana: number): number | null {
    return semana <= sub.metas.length ? sub.metas[semana - 1] : null;
  }

  protected descartar(): void {
    this.editados.set(new Map());
    this.formError.set('');
  }

  protected guardar(): void {
    if (!this.puedeEditar() || this.hayErrores() || this.cambios().length === 0) return;
    const grupos = agruparPorSemana(this.cambios());
    this.isSaving.set(true);
    this.formError.set('');
    concat(...grupos.map((g) => this.#service.guardarAvanceSemana(this.idCentroCosto(), g.semana, g.lineas)))
      .pipe(toArray())
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.saved.emit();
        },
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.formError.set(errorMessage(err));
          this.saved.emit(); // las semanas ya guardadas no deben volver a mostrarse como pendientes
        },
      });
  }
}
