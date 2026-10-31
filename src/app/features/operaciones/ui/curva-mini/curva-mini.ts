import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PuntoCurvaResumen } from '../../operaciones.interface';

const ANCHO = 120;
const ALTO = 36;

/** Mini Curva S (pactado y real) para tablas y tarjetas (RF-OP-40). */
@Component({
  selector: 'app-ops-curva-mini',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (puntos(); as p) {
      <svg [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" [attr.width]="ancho" [attr.height]="alto" role="img" aria-label="Curva S: pactado y real">
        <path [attr.d]="p.pactado" fill="none" stroke="#2563eb" stroke-width="1.5" />
        @if (p.real) {
          <path [attr.d]="p.real" fill="none" stroke="#16a34a" stroke-width="2" />
        }
      </svg>
    } @else {
      <span aria-label="Sin curva">—</span>
    }
  `,
})
export class CurvaMiniComponent {
  readonly curva = input<readonly PuntoCurvaResumen[] | null>(null);

  protected readonly ancho = ANCHO;
  protected readonly alto = ALTO;
  protected readonly puntos = computed(() => {
    const c = this.curva();
    if (!c?.length) return null;
    const x = (i: number) => ((i + 1) / c.length) * ANCHO;
    const y = (v: number) => ALTO - 2 - (Math.min(100, Math.max(0, v)) / 100) * (ALTO - 4);
    const traza = (vals: (number | null)[]) => {
      const partes = [`M0,${y(0).toFixed(1)}`];
      vals.forEach((v, i) => {
        if (v !== null) partes.push(`L${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      });
      return partes.join(' ');
    };
    const hayReal = c.some((p) => p.real !== null);
    return { pactado: traza(c.map((p) => p.pactado)), real: hayReal ? traza(c.map((p) => p.real)) : '' };
  });
}
