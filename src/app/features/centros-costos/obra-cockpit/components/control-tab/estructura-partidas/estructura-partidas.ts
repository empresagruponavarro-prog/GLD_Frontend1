import { formatNumber } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { fechaCorta } from '../../../obra-control.calc';
import { ObraPartida, ObraSubpartida, ResultadoObra } from '../../../obra-control.interface';
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
  /** Resultado del motor: de ahí salen el peso de cada subpartida y con qué se pesó la obra. */
  readonly resultado = input<ResultadoObra | null>(null);

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

  /** Hay montos en la estructura (de un presupuesto aprobado o escritos a mano). */
  protected readonly hayMontos = computed(() => this.partidas().some((p) => p.subpartidas.some((s) => s.monto != null && Number(s.monto) > 0)));
  protected readonly pesaPorMonto = computed(() => this.resultado()?.pesoPor === 'MONTO');
  /** La estructura ya vino de un presupuesto aprobado: no hace falta importarla otra vez. */
  protected readonly vieneDelPresupuesto = computed(() => this.partidas().some((p) => p.id_ppto_detalle_fase !== null));

  /** Peso (% de la obra) de una subpartida o de una partida, por su ítem; `null` si el motor aún no calculó la obra. */
  protected readonly pesos = computed(() => {
    const m = new Map<string, number>();
    for (const p of this.resultado()?.partidas ?? []) {
      if (p.pesoPct !== undefined) m.set(p.item, p.pesoPct);
      for (const s of p.subpartidas) if (s.pesoPct !== undefined) m.set(s.item, s.pesoPct);
    }
    return m;
  });

  protected soles(valor: string | null | undefined): string {
    const n = Number(valor ?? 0);
    return n > 0 ? formatNumber(n, 'en-US', '1.2-2') : '—';
  }

  protected peso(item: string): string {
    const p = this.pesos().get(item);
    return p === undefined ? '—' : `${formatNumber(p, 'en-US', '1.0-1')} %`;
  }

  protected cantidadMetasManuales(s: ObraSubpartida): number {
    return s.metas_manuales.filter((m) => m !== null).length;
  }
}
