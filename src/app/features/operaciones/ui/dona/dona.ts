import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Porcion } from '../../operaciones.calc';

export const PALETA_DONA = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569', '#0d9488'] as const;
const R = 40;
const CIRCUNFERENCIA = 2 * Math.PI * R;

interface Arco {
  clave: string;
  etiqueta: string;
  valor: number;
  color: string;
  largo: number;
  desfase: number;
}

/** Dona con leyenda; con `clicable`, un clic en la leyenda emite la clave (filtra, RF-OP-47). */
@Component({
  selector: 'app-ops-dona',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../operaciones.css',
  template: `
    <div class="ops-dona">
      <svg class="ops-dona__svg" viewBox="0 0 100 100" role="img" [attr.aria-label]="titulo()">
        <circle cx="50" cy="50" [attr.r]="radio" fill="none" stroke="#e2e8f0" stroke-width="14" />
        @for (a of arcos(); track a.clave) {
          <circle
            cx="50"
            cy="50"
            [attr.r]="radio"
            fill="none"
            [attr.stroke]="a.color"
            stroke-width="14"
            [attr.stroke-dasharray]="a.largo + ' ' + (circunferencia - a.largo)"
            [attr.stroke-dashoffset]="-a.desfase"
            transform="rotate(-90 50 50)"
          />
        }
        <text x="50" y="55" text-anchor="middle" class="ops-dona__total">{{ total() }}</text>
      </svg>
      <ul class="ops-dona__leyenda">
        @for (a of arcos(); track a.clave) {
          <li>
            <button type="button" class="ops-dona__item" [class.ops-dona__item--clic]="clicable()" [disabled]="!clicable()" (click)="seleccion.emit(a.clave)">
              <span class="ops-dona__color" [style.background]="a.color"></span>
              <span class="ops-dona__nombre" [attr.title]="a.etiqueta">{{ a.etiqueta }}</span>
              <span class="ops-dona__valor">{{ a.valor }}</span>
            </button>
          </li>
        } @empty {
          <li class="ops-vacio">Sin datos</li>
        }
      </ul>
    </div>
  `,
})
export class DonaComponent {
  readonly porciones = input<readonly Porcion[]>([]);
  readonly titulo = input('Distribución');
  readonly clicable = input(false);
  /** Colores por clave (si no se indica, se usa la paleta en orden). */
  readonly colores = input<Readonly<Record<string, string>>>({});

  readonly seleccion = output<string>();

  protected readonly radio = R;
  protected readonly circunferencia = CIRCUNFERENCIA;
  protected readonly total = computed(() => this.porciones().reduce((a, p) => a + p.valor, 0));
  protected readonly arcos = computed<Arco[]>(() => {
    const total = this.total();
    let acumulado = 0;
    return this.porciones().map((p, i) => {
      const largo = total ? (p.valor / total) * CIRCUNFERENCIA : 0;
      const arco: Arco = { ...p, color: this.colores()[p.clave] ?? PALETA_DONA[i % PALETA_DONA.length], largo, desfase: acumulado };
      acumulado += largo;
      return arco;
    });
  });
}
