import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { pctMostrado } from '../../../centros-costos/obra-cockpit/obra-control.calc';
import { ClaveSituacion } from '../../../centros-costos/obra-cockpit/obra-control.interface';

/** Barra de avance real con una marca en lo programado (RF-OP-29, 39). */
@Component({
  selector: 'app-ops-barra-avance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../operaciones.css',
  template: `
    <div class="ops-barra" role="img" [attr.aria-label]="'Real ' + realTxt() + ' por ciento, programado ' + progTxt() + ' por ciento'">
      <div class="ops-barra__real" [class]="'ops-barra__real ops-barra__real--' + clave()" [style.width.%]="anchoReal()"></div>
      <div class="ops-barra__marca" [style.left.%]="anchoMeta()"></div>
    </div>
    @if (conTexto()) {
      <span class="ops-barra__texto">Real {{ realTxt() }}% · Prog. {{ progTxt() }}%</span>
    }
  `,
})
export class BarraAvanceComponent {
  readonly valor = input.required<number>();
  readonly meta = input.required<number>();
  readonly clave = input<ClaveSituacion>('good');
  readonly conTexto = input(true);

  protected readonly anchoReal = computed(() => Math.min(100, Math.max(0, this.valor())));
  protected readonly anchoMeta = computed(() => Math.min(100, Math.max(0, this.meta())));
  protected readonly realTxt = computed(() => pctMostrado(this.valor()));
  protected readonly progTxt = computed(() => pctMostrado(this.meta()));
}
