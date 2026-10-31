import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import {
  claseSeveridad,
  etiquetaEstadoObra,
  fechaCorta,
  pctMostrado,
  resumenReprogramaciones,
  textoDesviacion,
} from '../../obra-control.calc';
import { ControlObra, ETIQUETAS_MOTIVO, ObraPartida, ObraReprogramacion, ObraSubpartida } from '../../obra-control.interface';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';
import { ObraService } from '../../obra.service';
import { EstadoObraDialogComponent } from '../../dialogs/estado-obra-dialog/estado-obra-dialog';
import { ImportarExcelDialogComponent } from '../../dialogs/importar-excel-dialog/importar-excel-dialog';
import { ImportarPresupuestoDialogComponent } from '../../dialogs/importar-presupuesto-dialog/importar-presupuesto-dialog';
import { MetasDialogComponent } from '../../dialogs/metas-dialog/metas-dialog';
import { PartidaDialogComponent } from '../../dialogs/partida-dialog/partida-dialog';
import { ReprogramacionDialogComponent } from '../../dialogs/reprogramacion-dialog/reprogramacion-dialog';
import { SubpartidaDialogComponent } from '../../dialogs/subpartida-dialog/subpartida-dialog';
import { AvanceSemanalComponent } from './avance-semanal/avance-semanal';
import { CurvaSControlComponent, FiltroCurvaS } from './curva-s-control/curva-s-control';
import { EstructuraPartidasComponent } from './estructura-partidas/estructura-partidas';
import { SituacionChipComponent } from './situacion-chip/situacion-chip';

export type SeccionControl = 'resumen' | 'estructura' | 'avance' | 'reprogramaciones' | 'curva';

/**
 * Pestaña «Control de avance» del cockpit: resumen, estructura, avance semanal, reprogramaciones y
 * Curva S de una obra, con el cambio de estado. Todo se edita sin salir del cockpit (RF-OP-05..12, 20).
 */
@Component({
  selector: 'app-control-tab',
  standalone: true,
  imports: [
    SituacionChipComponent,
    EstructuraPartidasComponent,
    AvanceSemanalComponent,
    CurvaSControlComponent,
    EstadoObraDialogComponent,
    ImportarExcelDialogComponent,
    ImportarPresupuestoDialogComponent,
    MetasDialogComponent,
    PartidaDialogComponent,
    ReprogramacionDialogComponent,
    SubpartidaDialogComponent,
  ],
  templateUrl: './control-tab.html',
  styleUrl: '../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlTabComponent {
  readonly #service = inject(ObraService);

  readonly idCentroCosto = input.required<number>();
  readonly control = input<ControlObra | null>(null);
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);
  /** Fechas de la obra (`YYYY-MM-DD`): nacen en el alta de subpartidas y fijan la semana 1. */
  readonly inicioObra = input('');
  readonly finObra = input('');

  /** Algo cambió (estructura, avance, reprogramación, estado): el cockpit debe recargar el resumen. */
  readonly cambio = output<void>();

  protected readonly secciones: { clave: SeccionControl; etiqueta: string }[] = [
    { clave: 'resumen', etiqueta: 'Resumen' },
    { clave: 'estructura', etiqueta: 'Estructura' },
    { clave: 'avance', etiqueta: 'Avance semanal' },
    { clave: 'reprogramaciones', etiqueta: 'Reprogramaciones' },
    { clave: 'curva', etiqueta: 'Curva S' },
  ];
  protected readonly seccion = signal<SeccionControl>('resumen');
  protected readonly version = signal(0);
  protected readonly filtroCurva = signal<FiltroCurvaS>('todo');
  protected readonly error = signal('');

  protected readonly fecha = fechaCorta;
  protected readonly pct = pctMostrado;
  protected readonly desviacion = textoDesviacion;
  protected readonly etiquetaEstado = etiquetaEstadoObra;
  protected readonly severidad = claseSeveridad;
  protected readonly motivos = ETIQUETAS_MOTIVO;

  readonly #params = computed(() => ({ id: this.idCentroCosto(), v: this.version() }));
  protected readonly partidasRes = rxResource({ params: this.#params, stream: ({ params }) => this.#service.getPartidas(params.id) });
  protected readonly avanceRes = rxResource({ params: this.#params, stream: ({ params }) => this.#service.getAvance(params.id) });
  protected readonly reprogRes = rxResource({ params: this.#params, stream: ({ params }) => this.#service.getReprogramaciones(params.id) });
  protected readonly eventosRes = rxResource({ params: this.#params, stream: ({ params }) => this.#service.getEventos(params.id, 20) });
  protected readonly curvaRes = rxResource({
    params: () => ({ ...this.#params(), filtro: this.filtroCurva() }),
    stream: ({ params }) => this.#service.getCurvaS(params.id, params.filtro),
  });

  protected readonly partidas = computed<ObraPartida[]>(() => (this.partidasRes.hasValue() ? this.partidasRes.value() : []));
  protected readonly reprogramaciones = computed<ObraReprogramacion[]>(() => (this.reprogRes.hasValue() ? this.reprogRes.value() : []));
  protected readonly eventos = computed(() => (this.eventosRes.hasValue() ? this.eventosRes.value() : []));
  protected readonly resultado = computed(() => this.control()?.resultado ?? null);
  protected readonly resumenRep = computed(() => resumenReprogramaciones(this.reprogramaciones(), this.resultado()?.plazos.finOriginal));
  protected readonly hayAdicionales = computed(() => this.resultado()?.adicionales != null || this.partidas().some((p) => p.tipo === 'ADICIONAL'));
  protected readonly estadoActual = computed(() => this.control()?.estado_obra ?? null);
  /** Sugerencia del siguiente ítem libre (`01`, `02`…). */
  protected readonly itemPartidaSugerido = computed(() => String(this.partidas().length + 1).padStart(2, '0'));

  // ── Diálogos ──
  protected readonly dlgEstado = signal(false);
  protected readonly dlgImportar = signal(false);
  protected readonly dlgExcel = signal(false);
  protected readonly dlgPartida = signal(false);
  protected readonly partidaSel = signal<ObraPartida | null>(null);
  protected readonly dlgSubpartida = signal(false);
  protected readonly subpartidaPadre = signal<ObraPartida | null>(null);
  protected readonly subpartidaSel = signal<ObraSubpartida | null>(null);
  protected readonly itemSubSugerido = computed(() => {
    const p = this.subpartidaPadre();
    return p ? `${p.item}.${String(p.subpartidas.length + 1).padStart(2, '0')}` : '';
  });
  protected readonly dlgMetas = signal(false);
  protected readonly metasSel = signal<ObraSubpartida | null>(null);
  protected readonly dlgRep = signal(false);
  protected readonly repSel = signal<ObraReprogramacion | null>(null);

  protected ir(s: SeccionControl): void {
    this.seccion.set(s);
  }

  /** Recarga todo lo de la pestaña y avisa al cockpit. */
  protected refrescar(): void {
    this.error.set('');
    this.version.update((v) => v + 1);
    this.cambio.emit();
  }

  protected cerrarDialogos(): void {
    this.dlgEstado.set(false);
    this.dlgImportar.set(false);
    this.dlgExcel.set(false);
    this.dlgPartida.set(false);
    this.dlgSubpartida.set(false);
    this.dlgMetas.set(false);
    this.dlgRep.set(false);
  }

  protected guardado(): void {
    this.cerrarDialogos();
    this.refrescar();
  }

  // ── Estructura ──
  protected nuevaPartida(): void {
    this.partidaSel.set(null);
    this.dlgPartida.set(true);
  }
  protected editarPartida(p: ObraPartida): void {
    this.partidaSel.set(p);
    this.dlgPartida.set(true);
  }
  protected nuevaSubpartida(p: ObraPartida): void {
    this.subpartidaPadre.set(p);
    this.subpartidaSel.set(null);
    this.dlgSubpartida.set(true);
  }
  protected editarSubpartida(e: { partida: ObraPartida; subpartida: ObraSubpartida }): void {
    this.subpartidaPadre.set(e.partida);
    this.subpartidaSel.set(e.subpartida);
    this.dlgSubpartida.set(true);
  }
  protected editarMetas(s: ObraSubpartida): void {
    this.metasSel.set(s);
    this.dlgMetas.set(true);
  }

  protected eliminarPartida(p: ObraPartida): void {
    if (!this.permisos().eliminar) return;
    if (!confirm(`¿Eliminar la partida ${p.item} · ${p.nombre} y sus subpartidas? Solo es posible si no tienen avance.`)) return;
    this.#service.deletePartida(this.idCentroCosto(), p.id).subscribe({
      next: () => this.refrescar(),
      error: (err: unknown) => this.error.set(errorMessage(err)),
    });
  }
  protected eliminarSubpartida(s: ObraSubpartida): void {
    if (!this.permisos().eliminar) return;
    if (!confirm(`¿Eliminar la subpartida ${s.item} · ${s.nombre}?`)) return;
    this.#service.deleteSubpartida(this.idCentroCosto(), s.id).subscribe({
      next: () => this.refrescar(),
      error: (err: unknown) => this.error.set(errorMessage(err)),
    });
  }

  // ── Reprogramaciones ──
  protected nuevaReprogramacion(): void {
    this.repSel.set(null);
    this.dlgRep.set(true);
  }
  protected editarReprogramacion(r: ObraReprogramacion): void {
    this.repSel.set(r);
    this.dlgRep.set(true);
  }
  protected eliminarReprogramacion(r: ObraReprogramacion): void {
    if (!this.permisos().eliminar) return;
    if (!confirm(`¿Eliminar la reprogramación de ${r.dias} día(s) desde el ${fechaCorta(r.desde)}?`)) return;
    this.#service.deleteReprogramacion(this.idCentroCosto(), r.id).subscribe({
      next: () => this.refrescar(),
      error: (err: unknown) => this.error.set(errorMessage(err)),
    });
  }
}
