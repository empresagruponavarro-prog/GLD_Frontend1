import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ETIQUETAS_ESTADO_OBRA, EstadoObra } from '../../../centros-costos/obra-cockpit/obra-control.interface';

const CLASES: Readonly<Record<EstadoObra, string>> = {
  EN_EJECUCION: 'ops-chip--ejecucion',
  PROXIMO: 'ops-chip--proximo',
  POST_VENTA: 'ops-chip--postventa',
  CULMINADO: 'ops-chip--culminado',
  SUSPENDIDA: 'ops-chip--suspendida',
  CANCELADA: 'ops-chip--cancelada',
};

/** Estado de la obra (en ejecución, próximo, post venta…) con su color. */
@Component({
  selector: 'app-ops-estado-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../operaciones.css',
  template: `<span class="ops-chip" [class]="clase()" data-testid="estado-chip">{{ etiqueta() }}</span>`,
})
export class EstadoChipComponent {
  readonly estado = input.required<EstadoObra>();
  protected readonly etiqueta = computed(() => ETIQUETAS_ESTADO_OBRA[this.estado()]);
  protected readonly clase = computed(() => `ops-chip ${CLASES[this.estado()]}`);
}
