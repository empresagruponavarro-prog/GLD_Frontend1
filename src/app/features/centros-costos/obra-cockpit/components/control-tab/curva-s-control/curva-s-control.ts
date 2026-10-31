import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { diaMes, fraseCurvaS, geometriaCurvaS } from '../../../obra-control.calc';
import { CurvaS } from '../../../obra-control.interface';

export type FiltroCurvaS = 'todo' | 'C' | 'A';

/** Curva S: pactado (con reprogramaciones) frente al avance real por semana (RF-OP-11, RF-OP-12). */
@Component({
  selector: 'app-curva-s-control',
  standalone: true,
  templateUrl: './curva-s-control.html',
  styleUrl: '../../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurvaSControlComponent {
  readonly curva = input<CurvaS | null>(null);
  readonly filtro = input<FiltroCurvaS>('todo');
  /** Solo se ofrece el filtro Contractual/Adicionales si la obra tiene adicionales. */
  readonly hayAdicionales = input(false);

  readonly filtroCambiado = output<FiltroCurvaS>();

  protected readonly dia = diaMes;
  protected readonly filtros: { valor: FiltroCurvaS; etiqueta: string }[] = [
    { valor: 'todo', etiqueta: 'Todo' },
    { valor: 'C', etiqueta: 'Contractual' },
    { valor: 'A', etiqueta: 'Adicionales' },
  ];
  protected readonly geo = computed(() => {
    const c = this.curva();
    return c ? geometriaCurvaS(c) : null;
  });
  protected readonly frase = computed(() => {
    const c = this.curva();
    return c ? fraseCurvaS(c) : null;
  });
}
