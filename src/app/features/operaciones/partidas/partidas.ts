import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SituacionChipComponent } from '../../centros-costos/obra-cockpit/components/control-tab/situacion-chip/situacion-chip';
import { fechaCorta, pctMostrado, textoDesviacion } from '../../centros-costos/obra-cockpit/obra-control.calc';
import { Situacion } from '../../centros-costos/obra-cockpit/obra-control.interface';
import { marcadoDeEvento } from '@shared/utils/eventos';
import { estadoDe, ordenarObras } from '../operaciones.calc';
import { OperacionesStore } from '../operaciones.store';
import { BarraAvanceComponent } from '../ui/barra-avance/barra-avance';

/** Fila plana del árbol obra › partida › subpartida. */
export interface FilaArbol {
  id: string;
  nivel: 0 | 1 | 2;
  etiqueta: string;
  detalle?: string;
  inicio: string;
  fin: string;
  finOriginal?: string | null;
  real: number;
  programado: number;
  desviacion: number;
  situacion: Situacion;
  semana?: string;
  idCentroCosto: number;
  expandible: boolean;
}

/** Partidas y subpartidas: árbol con «Solo con retraso», Expandir/Contraer y orden por desviación (RF-OP-39). */
@Component({
  selector: 'app-partidas',
  standalone: true,
  imports: [RouterLink, SituacionChipComponent, BarraAvanceComponent],
  templateUrl: './partidas.html',
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartidasComponent {
  protected readonly store = inject(OperacionesStore);
  protected readonly fecha = fechaCorta;
  protected readonly pct = pctMostrado;
  protected readonly desviacion = textoDesviacion;
  protected readonly marcadoDe = marcadoDeEvento;

  protected readonly soloRetraso = signal(false);
  /** Ids expandidos (`o12`, `p12:03`). */
  protected readonly expandidos = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.store.pedirArboles();
  }

  /** Obras con árbol, de la más atrasada a la más adelantada. */
  protected readonly obras = computed(() => {
    const conArbol = ordenarObras(this.store.obras().filter((o) => estadoDe(o) === 'EN_EJECUCION' || estadoDe(o) === 'POST_VENTA'));
    const retraso = (c: string) => c === 'crit';
    return this.soloRetraso()
      ? conArbol.filter((o) => retraso(o.resultado.situacion.clave) || (this.store.arboles().get(o.id_centro_costo)?.partidas.some((p) => retraso(p.situacion.clave) || p.subpartidas.some((s) => retraso(s.situacion.clave))) ?? false))
      : conArbol;
  });

  protected readonly filas = computed<FilaArbol[]>(() => {
    const abiertos = this.expandidos();
    const soloRetraso = this.soloRetraso();
    const out: FilaArbol[] = [];
    const ordenadas = [...this.obras()].sort((a, b) => a.resultado.desviacion - b.resultado.desviacion);
    for (const o of ordenadas) {
      const arbol = this.store.arboles().get(o.id_centro_costo);
      const r = o.resultado;
      const idO = `o${o.id_centro_costo}`;
      out.push({
        id: idO,
        nivel: 0,
        etiqueta: o.nombre,
        detalle: o.codigo_obra ?? undefined,
        inicio: o.inicio,
        fin: r.plazos.finVigente,
        finOriginal: r.plazos.finOriginal !== r.plazos.finVigente ? r.plazos.finOriginal : null,
        real: r.real,
        programado: r.programado,
        desviacion: r.desviacion,
        situacion: r.situacion,
        semana: r.semana.texto,
        idCentroCosto: o.id_centro_costo,
        expandible: !!arbol?.partidas.length,
      });
      if (!abiertos.has(idO) || !arbol) continue;
      const partidas = [...arbol.partidas].sort((a, b) => a.desviacion - b.desviacion);
      for (const p of partidas) {
        const subs = soloRetraso ? p.subpartidas.filter((s) => s.situacion.clave === 'crit') : p.subpartidas;
        if (soloRetraso && p.situacion.clave !== 'crit' && subs.length === 0) continue;
        const idP = `p${o.id_centro_costo}:${p.item}`;
        out.push({ id: idP, nivel: 1, etiqueta: `${p.item} ${p.nombre}`, inicio: p.inicio, fin: p.fin, real: p.real, programado: p.programado, desviacion: p.desviacion, situacion: p.situacion, idCentroCosto: o.id_centro_costo, expandible: p.subpartidas.length > 0 });
        if (!abiertos.has(idP)) continue;
        for (const s of [...subs].sort((a, b) => a.desviacion - b.desviacion)) {
          out.push({ id: `s${o.id_centro_costo}:${p.item}:${s.item}`, nivel: 2, etiqueta: `${s.item} ${s.nombre}`, detalle: s.tipo === 'ADICIONAL' ? 'Adicional' : undefined, inicio: s.inicio, fin: s.fin, real: s.real, programado: s.programado, desviacion: s.desviacion, situacion: s.situacion, semana: s.estadoCronograma.texto, idCentroCosto: o.id_centro_costo, expandible: false });
        }
      }
    }
    return out;
  });

  protected alternar(id: string): void {
    this.expandidos.update((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  }

  protected expandirTodo(): void {
    const ids = new Set<string>();
    for (const o of this.obras()) {
      const arbol = this.store.arboles().get(o.id_centro_costo);
      if (!arbol) continue;
      ids.add(`o${o.id_centro_costo}`);
      for (const p of arbol.partidas) ids.add(`p${o.id_centro_costo}:${p.item}`);
    }
    this.expandidos.set(ids);
  }

  protected contraerTodo(): void {
    this.expandidos.set(new Set());
  }
}
