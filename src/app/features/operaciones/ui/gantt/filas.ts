import { pctMostrado } from '../../../centros-costos/obra-cockpit/obra-control.calc';
import { PartidaResultado, SubpartidaResultado } from '../../../centros-costos/obra-cockpit/obra-control.interface';
import { estadoDe } from '../../operaciones.calc';
import { ArbolObra, ObraResumen } from '../../operaciones.interface';
import { FilaGantt } from './gantt';

/** Fila de una obra: fin vigente, fin original, fuera de plazo, post venta y corte. */
export function filaDeObra(o: ObraResumen, hoy: string): FilaGantt {
  const r = o.resultado;
  const estado = estadoDe(o);
  return {
    id: `o${o.id_centro_costo}`,
    etiqueta: o.nombre,
    detalle: [o.codigo_obra, o.equipo.jefe_proyecto?.nombre].filter(Boolean).join(' · ') || undefined,
    nivel: 0,
    inicio: o.inicio,
    fin: r.plazos.finVigente,
    finOriginal: r.plazos.finOriginal,
    clave: r.situacion.clave,
    postVentaHasta: estado === 'POST_VENTA' && r.postVenta ? (r.postVenta.cierre ?? hoy) : null,
    vencida: estado === 'EN_EJECUCION' && r.plazos.diasFueraDePlazo > 0,
    corte: r.corte,
    nota: `${pctMostrado(r.real)}% · ${r.situacion.texto}`,
  };
}

export const filasDeObras = (obras: readonly ObraResumen[], hoy: string): FilaGantt[] => obras.map((o) => filaDeObra(o, hoy));

function filaDeSub(idObra: number, p: PartidaResultado, s: SubpartidaResultado): FilaGantt {
  return {
    id: `s${idObra}:${p.item}:${s.item}`,
    etiqueta: `${s.item} ${s.nombre}`,
    nivel: 1,
    inicio: s.inicio,
    fin: s.fin,
    clave: s.situacion.clave,
    nota: `${pctMostrado(s.real)}% real · ${pctMostrado(s.programado)}% prog.`,
  };
}

/**
 * Filas de la obra y, si está expandida, de sus partidas (con pausas tomadas de las semanas de la
 * Curva S que quedaron enteras en pausa) y subpartidas.
 */
export function filasConPartidas(o: ObraResumen, arbol: ArbolObra | undefined, expandidas: ReadonlySet<string>, hoy: string): FilaGantt[] {
  const base = filaDeObra(o, hoy);
  const pausas = arbol?.curvaS?.semanas.filter((s) => s.semanaEnPausa).map((s) => ({ desde: s.desde, hasta: s.hasta })) ?? [];
  const expandida = expandidas.has(base.id);
  const fila: FilaGantt = { ...base, pausas, expandible: !!arbol?.partidas.length, expandida };
  if (!expandida || !arbol) return [fila];
  const hijas = arbol.partidas.flatMap((p) => {
    const idP = `p${o.id_centro_costo}:${p.item}`;
    const filaP: FilaGantt = {
      id: idP,
      etiqueta: `${p.item} ${p.nombre}`,
      nivel: 1,
      inicio: p.inicio,
      fin: p.fin,
      clave: p.situacion.clave,
      nota: `${pctMostrado(p.real)}% real · ${pctMostrado(p.programado)}% prog.`,
      expandible: p.subpartidas.length > 0,
      expandida: expandidas.has(idP),
    };
    return expandidas.has(idP) ? [filaP, ...p.subpartidas.map((s) => filaDeSub(o.id_centro_costo, p, s))] : [filaP];
  });
  return [fila, ...hijas];
}
