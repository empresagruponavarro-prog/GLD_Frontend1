import {
  CatalogosPortafolio,
  EstadoObra,
  FiltrosGlobales,
  ObraResumen,
  PersonaObra,
  REFERENCIA_COORDINADOR,
  REFERENCIA_JEFE,
} from './operaciones.interface';

/** Cálculos puros del Dashboard de Operaciones (sin Angular): se prueban con `operaciones.calc.spec.ts`. */

const MS_DIA = 86_400_000;
const aDia = (iso: string): number => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / MS_DIA;

/** Días entre dos fechas `YYYY-MM-DD` (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round(aDia(b) - aDia(a));
}

/** Minúsculas, sin tildes y con espacios simples. */
export const normalizar = (s: string | null | undefined): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// ─── Estado y filtros (RC-21) ────────────────────────────────────────────────

export const estadoDe = (o: ObraResumen): EstadoObra => o.resultado.estadoEfectivo;

/** Vigente = no culminada ni cancelada. */
export const esVigente = (o: ObraResumen): boolean => o.estado_obra !== 'CULMINADO' && o.estado_obra !== 'CANCELADA';

export const anioDe = (o: ObraResumen): number => Number(o.inicio.slice(0, 4));

export function filtrarObras(obras: readonly ObraResumen[], f: FiltrosGlobales): ObraResumen[] {
  const q = normalizar(f.q);
  const dep = normalizar(f.departamento);
  return obras.filter(
    (o) =>
      (f.anio === null || anioDe(o) === f.anio || (f.vigentesAnteriores && esVigente(o) && anioDe(o) < f.anio)) &&
      (f.cliente === null || o.cliente?.id === f.cliente) &&
      (f.jefe === null || o.equipo.jefe_proyecto?.id === f.jefe) &&
      (f.coordinador === null || o.equipo.coordinador?.id === f.coordinador) &&
      (!dep || normalizar(o.departamento) === dep) &&
      (f.estado === null || estadoDe(o) === f.estado) &&
      (!q || normalizar(o.nombre).includes(q) || normalizar(o.codigo_obra).includes(q)),
  );
}

export function hayFiltros(f: FiltrosGlobales): boolean {
  return f.anio !== null || f.cliente !== null || f.jefe !== null || f.coordinador !== null || f.departamento !== null || f.estado !== null || f.q.trim() !== '';
}

const ORDEN_ESTADO: Record<EstadoObra, number> = { EN_EJECUCION: 0, PROXIMO: 1, SUSPENDIDA: 1.5, POST_VENTA: 2, CULMINADO: 3, CANCELADA: 4 };

/** Orden de la bitácora: ejecución, próximos, suspendidas, post venta, culminadas; por inicio dentro de cada una. */
export function ordenarObras(obras: readonly ObraResumen[]): ObraResumen[] {
  return [...obras].sort((a, b) => ORDEN_ESTADO[estadoDe(a)] - ORDEN_ESTADO[estadoDe(b)] || a.inicio.localeCompare(b.inicio) || a.id_centro_costo - b.id_centro_costo);
}

function unicos(items: readonly (PersonaObra | null | undefined)[]): PersonaObra[] {
  const m = new Map<number, string>();
  for (const i of items) if (i) m.set(i.id, i.nombre);
  return [...m].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function catalogosDe(obras: readonly ObraResumen[]): CatalogosPortafolio {
  return {
    clientes: unicos(obras.map((o) => o.cliente)),
    jefes: unicos(obras.map((o) => o.equipo.jefe_proyecto)),
    coordinadores: unicos(obras.map((o) => o.equipo.coordinador)),
    departamentos: [...new Set(obras.map((o) => o.departamento).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, 'es')),
    anios: [...new Set(obras.map(anioDe))].sort((a, b) => b - a),
  };
}

// ─── KPI (RF-OP-28) ──────────────────────────────────────────────────────────

export interface KpisPortafolio {
  vigentes: number;
  /** Vigentes por año de inicio, del más reciente al más antiguo. */
  vigentesPorAnio: { anio: number; cantidad: number }[];
  clientes: number;
  coordinadoresActivos: number;
  jefesActivos: number;
  enEjecucion: number;
  postVenta: number;
  proximos: number;
  /** En ejecución con el fin vigente dentro de los próximos 7 días. */
  proximasAVencer: number;
}

export function kpisDe(obras: readonly ObraResumen[]): KpisPortafolio {
  const vigentes = obras.filter(esVigente);
  const por = (e: EstadoObra) => vigentes.filter((o) => estadoDe(o) === e).length;
  const activas = vigentes.filter((o) => estadoDe(o) !== 'SUSPENDIDA');
  const porAnio = new Map<number, number>();
  for (const o of vigentes) porAnio.set(anioDe(o), (porAnio.get(anioDe(o)) ?? 0) + 1);
  return {
    vigentes: vigentes.length,
    vigentesPorAnio: [...porAnio].map(([anio, cantidad]) => ({ anio, cantidad })).sort((a, b) => b.anio - a.anio),
    clientes: new Set(vigentes.map((o) => o.cliente?.id).filter((x): x is number => x != null)).size,
    coordinadoresActivos: new Set(activas.map((o) => o.equipo.coordinador?.id).filter((x): x is number => x != null)).size,
    jefesActivos: new Set(activas.map((o) => o.equipo.jefe_proyecto?.id).filter((x): x is number => x != null)).size,
    enEjecucion: por('EN_EJECUCION'),
    postVenta: por('POST_VENTA'),
    proximos: por('PROXIMO'),
    proximasAVencer: vigentes.filter((o) => estadoDe(o) === 'EN_EJECUCION' && o.resultado.plazos.proximoAVencer).length,
  };
}

// ─── Distribuciones y carga por persona (RF-OP-29, 42, 43) ───────────────────

export interface Porcion {
  clave: string;
  etiqueta: string;
  valor: number;
}

/** Cuenta obras por una clave; las más numerosas primero. */
export function distribuir(obras: readonly ObraResumen[], clave: (o: ObraResumen) => { id: string; etiqueta: string } | null): Porcion[] {
  const m = new Map<string, Porcion>();
  for (const o of obras) {
    const c = clave(o);
    if (!c) continue;
    const p = m.get(c.id) ?? { clave: c.id, etiqueta: c.etiqueta, valor: 0 };
    p.valor++;
    m.set(c.id, p);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

export type RolCarga = 'jefe' | 'coordinador';

export interface CargaPersona {
  persona: PersonaObra;
  ejecucion: number;
  proximos: number;
  postVenta: number;
  total: number;
  /** En ejecución con situación Retrasada. */
  conRetraso: number;
  referencia: number;
  /** Referencia − total (negativa = sobrecarga). */
  holgura: number;
  semaforo: 'good' | 'warn' | 'crit';
  /** Coordinadores o jefes con los que trabaja. */
  companeros: string[];
  obras: ObraResumen[];
}

export const referenciaDe = (rol: RolCarga): number => (rol === 'jefe' ? REFERENCIA_JEFE : REFERENCIA_COORDINADOR);

/** Carga activa por persona: obras en ejecución + próximas + post venta frente a la referencia (RC-20). */
export function cargaPorPersona(obras: readonly ObraResumen[], rol: RolCarga): CargaPersona[] {
  const referencia = referenciaDe(rol);
  const grupos = new Map<number, CargaPersona>();
  for (const o of obras.filter(esVigente)) {
    const persona = rol === 'jefe' ? o.equipo.jefe_proyecto : o.equipo.coordinador;
    if (!persona) continue;
    const g = grupos.get(persona.id) ?? { persona, ejecucion: 0, proximos: 0, postVenta: 0, total: 0, conRetraso: 0, referencia, holgura: referencia, semaforo: 'good', companeros: [], obras: [] };
    const e = estadoDe(o);
    if (e === 'EN_EJECUCION') {
      g.ejecucion++;
      if (o.resultado.situacion.clave === 'crit') g.conRetraso++;
    } else if (e === 'PROXIMO') g.proximos++;
    else if (e === 'POST_VENTA') g.postVenta++;
    else continue; // suspendidas: no cuentan como carga
    g.obras.push(o);
    const otro = rol === 'jefe' ? o.equipo.coordinador : o.equipo.jefe_proyecto;
    if (otro && !g.companeros.includes(otro.nombre)) g.companeros.push(otro.nombre);
    grupos.set(persona.id, g);
  }
  return [...grupos.values()]
    .map((g) => {
      const total = g.ejecucion + g.proximos + g.postVenta;
      const holgura = referencia - total;
      return { ...g, total, holgura, semaforo: (total > referencia ? 'crit' : total >= referencia * 0.8 ? 'warn' : 'good') as CargaPersona['semaforo'] };
    })
    .sort((a, b) => b.total - a.total || a.persona.nombre.localeCompare(b.persona.nombre, 'es'));
}

/** Semáforo de carga del conjunto: cuántas personas están sobre la referencia, cerca o con holgura. */
export function semaforoDeCarga(cargas: readonly CargaPersona[]): { sobrecarga: number; cerca: number; holgura: number } {
  return {
    sobrecarga: cargas.filter((c) => c.semaforo === 'crit').length,
    cerca: cargas.filter((c) => c.semaforo === 'warn').length,
    holgura: cargas.filter((c) => c.semaforo === 'good').length,
  };
}

// ─── Indicadores (RF-OP-32..35) ──────────────────────────────────────────────

/** Requieren atención (RC-24): en ejecución Retrasadas o En riesgo, o con el plazo vencido. */
export function requierenAtencion(obras: readonly ObraResumen[]): ObraResumen[] {
  return obras
    .filter((o) => estadoDe(o) === 'EN_EJECUCION' && (o.resultado.situacion.clave === 'crit' || o.resultado.situacion.clave === 'warn' || o.resultado.plazos.diasFueraDePlazo > 0))
    .sort((a, b) => a.resultado.desviacion - b.resultado.desviacion);
}

export interface PorAnio {
  anio: number;
  vigentes: number;
  culminadas: number;
  total: number;
}

export function porAnioDeInicio(obras: readonly ObraResumen[]): PorAnio[] {
  const m = new Map<number, PorAnio>();
  for (const o of obras) {
    if (o.estado_obra === 'CANCELADA') continue;
    const a = m.get(anioDe(o)) ?? { anio: anioDe(o), vigentes: 0, culminadas: 0, total: 0 };
    if (esVigente(o)) a.vigentes++;
    else a.culminadas++;
    a.total++;
    m.set(a.anio, a);
  }
  return [...m.values()].sort((a, b) => b.anio - a.anio);
}

export interface ResumenPostVenta {
  cantidad: number;
  promedioDias: number;
  maximoDias: number;
}

export function resumenPostVenta(obras: readonly ObraResumen[]): ResumenPostVenta {
  const dias = obras.filter((o) => estadoDe(o) === 'POST_VENTA' && o.resultado.postVenta).map((o) => o.resultado.postVenta!.dias);
  return {
    cantidad: dias.length,
    promedioDias: dias.length ? Math.round(dias.reduce((a, d) => a + d, 0) / dias.length) : 0,
    maximoDias: dias.length ? Math.max(...dias) : 0,
  };
}

/** Siguiente inicio entre las obras próximas. */
export function proximoInicio(obras: readonly ObraResumen[]): ObraResumen | null {
  return obras.filter((o) => estadoDe(o) === 'PROXIMO').sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null;
}

export interface MesInicio {
  mes: number;
  etiqueta: string;
  cantidad: number;
  obras: string[];
  actual: boolean;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Obras iniciadas por mes de un año, con el mes actual resaltado (RF-OP-33). */
export function iniciadasPorMes(obras: readonly ObraResumen[], anio: number, hoy: string): MesInicio[] {
  const mesActual = Number(hoy.slice(0, 4)) === anio ? Number(hoy.slice(5, 7)) : 0;
  return MESES.map((etiqueta, i) => {
    const delMes = obras.filter((o) => anioDe(o) === anio && Number(o.inicio.slice(5, 7)) === i + 1);
    return { mes: i + 1, etiqueta, cantidad: delMes.length, obras: delMes.map((o) => o.nombre), actual: mesActual === i + 1 };
  });
}

// ─── Por cliente, departamento y culminados (RF-OP-36..38) ───────────────────

export interface ClienteResumen {
  cliente: PersonaObra;
  ejecucion: number;
  proximos: number;
  postVenta: number;
  culminadas: number;
  total: number;
  obras: ObraResumen[];
}

export function porCliente(obras: readonly ObraResumen[]): ClienteResumen[] {
  const m = new Map<number, ClienteResumen>();
  for (const o of obras) {
    if (!o.cliente || o.estado_obra === 'CANCELADA') continue;
    const c = m.get(o.cliente.id) ?? { cliente: o.cliente, ejecucion: 0, proximos: 0, postVenta: 0, culminadas: 0, total: 0, obras: [] };
    const e = estadoDe(o);
    if (e === 'EN_EJECUCION') c.ejecucion++;
    else if (e === 'PROXIMO') c.proximos++;
    else if (e === 'POST_VENTA') c.postVenta++;
    else if (e === 'CULMINADO') c.culminadas++;
    c.total++;
    c.obras.push(o);
    m.set(o.cliente.id, c);
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.cliente.nombre.localeCompare(b.cliente.nombre, 'es'));
}

export interface DepartamentoResumen {
  departamento: string;
  cantidad: number;
  /** Tramo de color 0-5 (0 · 1 · 2–3 · 4–6 · 7–12 · 13+). */
  tramo: number;
}

export const tramoDeConteo = (n: number): number => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : n <= 12 ? 4 : 5);
export const ETIQUETAS_TRAMO = ['0', '1', '2–3', '4–6', '7–12', '13+'] as const;

export function porDepartamento(obras: readonly ObraResumen[]): DepartamentoResumen[] {
  const m = new Map<string, number>();
  for (const o of obras.filter(esVigente)) {
    const d = o.departamento?.trim();
    if (d) m.set(d, (m.get(d) ?? 0) + 1);
  }
  return [...m]
    .map(([departamento, cantidad]) => ({ departamento, cantidad, tramo: tramoDeConteo(cantidad) }))
    .sort((a, b) => b.cantidad - a.cantidad || a.departamento.localeCompare(b.departamento, 'es'));
}

export interface ObraCulminada {
  obra: ObraResumen;
  /** Días de entrega respecto al fin vigente (+ = tarde); `null` si no hay entrega registrada. */
  desfase: number | null;
  aTiempo: boolean | null;
}

/** Entrega frente al fin vigente (RC-19): la entrega real es el inicio de la post venta. */
export function culminadas(obras: readonly ObraResumen[]): { filas: ObraCulminada[]; pctATiempo: number | null } {
  const filas = obras
    .filter((o) => o.estado_obra === 'CULMINADO')
    .map<ObraCulminada>((obra) => {
      const entrega = obra.resultado.postVenta?.inicio ?? null;
      const desfase = entrega ? diasEntre(obra.resultado.plazos.finVigente, entrega) : null;
      return { obra, desfase, aTiempo: desfase === null ? null : desfase <= 0 };
    })
    .sort((a, b) => b.obra.inicio.localeCompare(a.obra.inicio));
  const medibles = filas.filter((f) => f.aTiempo !== null);
  return { filas, pctATiempo: medibles.length ? Math.round((medibles.filter((f) => f.aTiempo).length / medibles.length) * 100) : null };
}

// ─── Gantt (RF-OP-41) ────────────────────────────────────────────────────────

export interface EscalaTiempo {
  desde: string;
  hasta: string;
  dias: number;
  /** Posición (0-100) de una fecha en la escala. */
  pos: (iso: string) => number;
  /** Ancho (0-100) entre dos fechas. */
  ancho: (a: string, b: string) => number;
}

/** Escala común para pintar barras de tiempo; `margen` días de aire a cada lado. */
export function escalaDe(fechas: readonly string[], margen = 7): EscalaTiempo {
  const dias = fechas.map(aDia);
  const min = dias.length ? Math.min(...dias) - margen : 0;
  const max = dias.length ? Math.max(...dias) + margen : 1;
  const total = Math.max(1, max - min);
  const aIso = (d: number) => new Date(d * MS_DIA).toISOString().slice(0, 10);
  const pos = (iso: string) => Math.min(100, Math.max(0, ((aDia(iso) - min) / total) * 100));
  return { desde: aIso(min), hasta: aIso(max), dias: total, pos, ancho: (a, b) => Math.max(0.4, pos(b) - pos(a)) };
}

/** Primer día de cada mes dentro de la escala, para las marcas del eje. */
export function marcasDeMes(e: EscalaTiempo): { iso: string; etiqueta: string; pos: number }[] {
  const out: { iso: string; etiqueta: string; pos: number }[] = [];
  let y = Number(e.desde.slice(0, 4));
  let m = Number(e.desde.slice(5, 7)) + 1;
  for (;;) {
    if (m > 12) {
      m = 1;
      y++;
    }
    const iso = `${y}-${String(m).padStart(2, '0')}-01`;
    if (iso > e.hasta) break;
    out.push({ iso, etiqueta: `${MESES[m - 1]} ${String(y).slice(2)}`, pos: e.pos(iso) });
    m++;
  }
  return out;
}

// ─── Páginas del modo pantalla (RF-OP-30) ────────────────────────────────────

export function paginar<T>(items: readonly T[], tamano: number, pagina: number): { items: T[]; pagina: number; paginas: number } {
  const paginas = Math.max(1, Math.ceil(items.length / Math.max(1, tamano)));
  const p = ((pagina % paginas) + paginas) % paginas;
  return { items: items.slice(p * tamano, p * tamano + tamano), pagina: p, paginas };
}

// ─── Avisos sin leer (misma regla que el servidor) ───────────────────────────

/** Sin marca de lectura, solo cuentan los avisos de los últimos días. */
export const DIAS_SIN_MARCA = 14;

/** ¿El aviso está sin leer? Posterior a la marca (o a los últimos 14 días) y de un tipo elegido. */
export function esSinLeer(e: { tipo: string; created_at: string }, vistoHasta: string | null, tipos: readonly string[] | null, ahora: Date = new Date()): boolean {
  const desde = vistoHasta ?? new Date(ahora.getTime() - DIAS_SIN_MARCA * MS_DIA).toISOString();
  return e.created_at > desde && (tipos === null || tipos.includes(e.tipo));
}

/** «hace 5 min», «hace 3 h», «hace 2 d»: antigüedad de un instante ISO. */
export function hace(instante: string, ahora: Date = new Date()): string {
  const min = Math.floor((ahora.getTime() - Date.parse(instante)) / 60_000);
  if (!Number.isFinite(min) || min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.floor(min / 60)} h`;
  return `hace ${Math.floor(min / 1440)} d`;
}
