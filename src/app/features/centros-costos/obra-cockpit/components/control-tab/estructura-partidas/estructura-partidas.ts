import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { fechaCorta } from '../../../obra-control.calc';
import { ObraPartida, ObraSubpartida } from '../../../obra-control.interface';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../../obra-permisos';

/** Estructura de la obra: partidas con sus subpartidas, fechas programadas y metas (RF-OP-05..09). */
@Component({
  selector: 'app-estructura-partidas',
  standalone: true,
  templateUrl: './estructura-partidas.html',
  styleUrl: '../../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstructuraPartidasComponent {
  readonly partidas = input<readonly ObraPartida[]>([]);
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly importar = output<void>();
  readonly importarExcel = output<void>();
  readonly nuevaPartida = output<void>();
  readonly editarPartida = output<ObraPartida>();
  readonly eliminarPartida = output<ObraPartida>();
  readonly nuevaSubpartida = output<ObraPartida>();
  readonly editarSubpartida = output<{ partida: ObraPartida; subpartida: ObraSubpartida }>();
  readonly eliminarSubpartida = output<ObraSubpartida>();
  readonly metas = output<ObraSubpartida>();

  protected readonly fecha = fechaCorta;

  protected cantidadMetasManuales(s: ObraSubpartida): number {
    return s.metas_manuales.filter((m) => m !== null).length;
  }
}
