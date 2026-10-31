import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { claseSituacion, iconoSituacion } from '../../../obra-control.calc';
import { Situacion } from '../../../obra-control.interface';

/** Chip de situación (A tiempo, Retrasada, En riesgo, En pausa…) con su color e ícono. */
@Component({
  selector: 'app-situacion-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (situacion(); as s) {
      <span class="situacion-chip" [class]="clase()" [attr.data-clave]="s.clave">
        <span class="material-symbols-outlined situacion-chip__icono" aria-hidden="true">{{ icono() }}</span>{{ s.texto }}
      </span>
    }
  `,
  styles: `
    .situacion-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 700;
      white-space: nowrap;
      border-radius: 999px;
    }
    .situacion-chip__icono {
      font-size: 0.875rem;
    }
  `,
})
export class SituacionChipComponent {
  readonly situacion = input<Situacion | null | undefined>(null);
  protected readonly clase = computed(() => {
    const s = this.situacion();
    return s ? claseSituacion(s.clave) : '';
  });
  protected readonly icono = computed(() => {
    const s = this.situacion();
    return s ? iconoSituacion(s.clave) : '';
  });
}
