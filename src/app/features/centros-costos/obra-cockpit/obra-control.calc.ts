import {
  ClaveSituacion,
  CurvaS,
  EstadoObra,
  ETIQUETAS_ESTADO_OBRA,
  ObraReprogramacion,
  SEMANAS_AVANCE,
  SEMANAS_META,
  TRANSICIONES_ESTADO_OBRA,
} from './obra-control.interface';

/** Cálculos puros del control de avance (sin Angular): se prueban con `obra-control.calc.spec.ts`. */

// ─── Presentación ────────────────────────────────────────────────────────────

/** Clases (tokens Tailwind del cockpit) del chip de una situación. */
export function claseSituacion(clave: ClaveSituacion): string {
  switch (clave) {
    case 'good':
      return 'bg-primary-fixed text-on-primary-fixed-variant';
    case 'warn':
      return 'bg-secondary-container text-on-secondary-container';
    case 'crit':
      return 'bg-error-container text-on-error-container';
    case 'rp':
      return 'bg-violet-100 text-violet-800';
    default:
      return 'bg-surface-container text-on-surface-variant';
  }
}

/** Ícono (Material Symbols) de una situación. */
export function iconoSituacion(clave: ClaveSituacion): string {
  return { good: 'check_circle', warn: 'warning', crit: 'error', rp: 'pause_circle', neutral: 'schedule' }[clave];
}

export function claseSeveridad(sev: 'info' | 'good' | 'warn' | 'crit'): string {
  return { good: 'text-primary', warn: 'text-secondary', crit: 'text-error', info: 'text-on-surface-variant' }[sev];
}

export function etiquetaEstadoObra(estado: EstadoObra | null | undefined): string {
  return estado ? ETIQUETAS_ESTADO_OBRA[estado] : 'Sin control';
}

/** Estados a los que se puede pasar desde el actual (`null` = la obra aún no entra al control). */
export function transicionesDe(estado: EstadoObra | null): readonly EstadoObra[] {
  return TRANSICIONES_ESTADO_OBRA[estado ?? 'NINGUNO'];
}

/** Porcentaje mostrado: truncado hacia abajo, como el Excel (99,6 % se muestra 99 %). */
export function pctMostrado(n: number | null | undefined): number {
  return n == null ? 0 : Math.floor(Number(n.toFixed(6)));
}

/** «+3 pp», «−5 pp» o «0 pp». */
export function textoDesviacion(pp: number): string {
  const r = Math.round(pp);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)} pp`;
}

/** `YYYY-MM-DD` → `dd/MM/yyyy` (sin pasar por `Date`, para no correr un día por la zona horaria). */
export function fechaCorta(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export function diaMes(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}` : '—';
}

// ─── Avance semanal (RV-07, RV-09, RV-10) ────────────────────────────────────

export const TOPE_SUMA_AVANCE = 100.5;

/** Suma del avance de una subpartida sin contar la semana indicada (1-based). */
export function sumaOtrasSemanas(avance: readonly (number | null)[], semana: number): number {
  return avance.reduce<number>((a, v, i) => a + (i + 1 !== semana && v !== null ? v : 0), 0);
}

/**
 * Valida lo escrito en una celda de avance (lo avanzado SOLO esa semana). Devuelve el mensaje de
 * error o `null` si es válido. `texto` vacío = borrar el dato (válido).
 */
export function validarAvance(texto: string, otras: number): string | null {
  const t = texto.trim().replace(',', '.');
  if (t === '') return null;
  if (t.includes('%')) return 'Escriba 50, no 50%';
  const v = Number(t);
  if (!Number.isFinite(v)) return 'Debe ser un número';
  if (v < 0 || v > 100) return 'De 0 a 100';
  if (v > 0 && v < 1) return 'Menor a 1: escriba 50, no 0,5';
  if (otras + v > TOPE_SUMA_AVANCE) return `Con las otras semanas sumaría ${Math.round((otras + v) * 10) / 10} % (máx. 100)`;
  return null;
}

/** Valor numérico de una celda ya validada (`null` si está vacía). */
export function valorAvance(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  return t === '' ? null : Math.round(Number(t) * 10) / 10;
}

export interface CambioAvance {
  idSubpartida: number;
  semana: number;
  avance: number | null;
}

/** Agrupa los cambios por semana (el API guarda una semana por llamada). Las semanas salen en orden. */
export function agruparPorSemana(cambios: readonly CambioAvance[]): { semana: number; lineas: { idSubpartida: number; avance: number | null }[] }[] {
  const porSemana = new Map<number, { idSubpartida: number; avance: number | null }[]>();
  for (const c of cambios) porSemana.set(c.semana, [...(porSemana.get(c.semana) ?? []), { idSubpartida: c.idSubpartida, avance: c.avance }]);
  return [...porSemana].sort((a, b) => a[0] - b[0]).map(([semana, lineas]) => ({ semana, lineas }));
}

/** Clave de una celda de la grilla. */
export const claveCelda = (idSubpartida: number, semana: number): string => `${idSubpartida}:${semana}`;

// ─── Calendario y reparto automático de metas (RC-01, RC-02, RC-04) ──────────

const MS_DIA = 86_400_000;
const aDia = (iso: string): number => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / MS_DIA;
/** 0 = domingo … 6 = sábado. */
const diaSemana = (d: number): number => (((d + 4) % 7) + 7) % 7;

/** Días laborables (lunes a sábado) entre dos días, ambos inclusive. */
function laborables(a: number, b: number): number {
  let n = 0;
  for (let d = a; d <= b; d++) if (diaSemana(d) !== 0) n++;
  return n;
}

/** Lunes de la semana de una fecha `YYYY-MM-DD` (las semanas van de lunes a domingo). */
export function lunesDeIso(iso: string): string {
  const d = aDia(iso);
  return new Date((d - ((diaSemana(d) + 6) % 7)) * MS_DIA).toISOString().slice(0, 10);
}

/**
 * Meta automática de cada semana (1-10) de una subpartida: días laborables que tiene en esa semana
 * ÷ sus días laborables totales, redondeada a 0,1. Es la misma regla del motor del backend (RC-04).
 */
export function metasAutomaticas(inicio: string, fin: string, inicioSemana1: string): number[] {
  const ini = aDia(inicio);
  const fi = aDia(fin);
  const w1 = aDia(inicioSemana1);
  const total = laborables(ini, fi);
  const acumulado = (k: number): number => {
    if (k <= 0) return 0;
    const domingo = w1 + 7 * k - 1;
    if (domingo < ini) return 0;
    if (!total) return domingo >= fi ? 100 : 0;
    return Math.round((laborables(ini, Math.min(domingo, fi)) / total) * 1000) / 10;
  };
  return Array.from({ length: SEMANAS_META }, (_v, i) => Math.round((acumulado(i + 1) - acumulado(i)) * 10) / 10);
}

// ─── Metas (RV-12) ───────────────────────────────────────────────────────────

export function sumaMetas(metas: readonly (number | null | undefined)[]): number {
  return Math.round(metas.reduce<number>((a, v) => a + (v ?? 0), 0) * 10) / 10;
}

// ─── Reprogramaciones ────────────────────────────────────────────────────────

export interface ResumenReprogramaciones {
  dias: number;
  externos: number;
  internos: number;
  /** «+7 días · fin vigente 02/11/2026» o «Sin reprogramación». */
  texto: string;
}

export function resumenReprogramaciones(lista: readonly ObraReprogramacion[], finOriginal: string | null | undefined): ResumenReprogramaciones {
  const dias = lista.reduce((a, r) => a + r.dias, 0);
  const internos = lista.filter((r) => r.es_atraso).reduce((a, r) => a + r.dias, 0);
  if (dias === 0) return { dias: 0, externos: 0, internos: 0, texto: 'Sin reprogramación' };
  const fin = finOriginal ? sumarDiasIso(finOriginal, dias) : null;
  return {
    dias,
    externos: dias - internos,
    internos,
    texto: `+${dias} día${dias === 1 ? '' : 's'}${fin ? ` · fin vigente ${fechaCorta(fin)}` : ''}${internos > 0 ? ` · ${internos} d por causa interna (cuentan como atraso)` : ''}`,
  };
}

/** Suma días a una fecha `YYYY-MM-DD` (UTC, sin desfases de zona horaria). */
export function sumarDiasIso(iso: string, dias: number): string {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? '' : new Date(t + dias * 86_400_000).toISOString().slice(0, 10);
}

// ─── Curva S ─────────────────────────────────────────────────────────────────

export interface GeometriaCurvaS {
  ancho: number;
  alto: number;
  izq: number;
  der: number;
  arriba: number;
  abajo: number;
  /** Líneas guía horizontales (0, 25, 50, 75, 100 %) con su posición. */
  guias: { valor: number; y: number }[];
  pactado: string;
  pactadoOriginal: string;
  /** Vacío si no hay ningún punto de real. */
  real: string;
  /** Posición x del final de cada semana (índice 0 = semana 1). */
  xs: number[];
  /** Posición x del corte (domingo de la última semana cerrada); `null` si ninguna semana cerró. */
  xCorte: number | null;
  /** Bandas (semana entera en pausa por reprogramación). */
  pausas: { x: number; ancho: number; semana: number }[];
  /** Banda de la semana en curso. */
  xCurso: { x: number; ancho: number } | null;
  /** Hay pactado reprogramado distinto del original (alguna pausa externa). */
  hayOriginalDistinto: boolean;
}

export function geometriaCurvaS(curva: CurvaS, ancho = 640, alto = 260): GeometriaCurvaS {
  const izq = 40;
  const der = 16;
  const arriba = 14;
  const abajo = 30;
  const n = Math.max(1, curva.semanas.length);
  const W = ancho - izq - der;
  const H = alto - arriba - abajo;
  const x = (i: number) => izq + (i / n) * W; // i = 0..n (0 = inicio de la semana 1)
  const y = (v: number) => arriba + H * (1 - Math.min(100, Math.max(0, v)) / 100);
  const traza = (valores: (number | null)[], conOrigen: boolean): string => {
    const partes: string[] = [];
    if (conOrigen) partes.push(`M${x(0).toFixed(1)},${y(0).toFixed(1)}`);
    valores.forEach((v, i) => {
      if (v === null) return;
      partes.push(`${partes.length === 0 ? 'M' : 'L'}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`);
    });
    return partes.join(' ');
  };
  const semanas = curva.semanas;
  const hayReal = semanas.some((s) => s.real !== null);
  const enCurso = semanas.findIndex((s) => s.enCurso);
  return {
    ancho,
    alto,
    izq,
    der,
    arriba,
    abajo,
    guias: [0, 25, 50, 75, 100].map((valor) => ({ valor, y: y(valor) })),
    pactado: traza(semanas.map((s) => s.pactado), true),
    pactadoOriginal: traza(semanas.map((s) => s.pactadoOriginal), true),
    real: hayReal ? traza(semanas.map((s) => s.real), true) : '',
    xs: semanas.map((_s, i) => x(i + 1)),
    xCorte: curva.semanaCorte > 0 ? x(curva.semanaCorte) : null,
    pausas: semanas.flatMap((s, i) => (s.semanaEnPausa ? [{ x: x(i), ancho: x(i + 1) - x(i), semana: s.semana }] : [])),
    xCurso: enCurso >= 0 ? { x: x(enCurso), ancho: x(enCurso + 1) - x(enCurso) } : null,
    hayOriginalDistinto: semanas.some((s) => Math.abs(s.pactado - s.pactadoOriginal) > 0.05),
  };
}

export interface FraseCurvaS {
  texto: string;
  /** Desviación en pp al corte. */
  desviacion: number;
}

/**
 * Frase diagnóstica bajo la Curva S. Usa la MISMA tolerancia que la situación (0,5 pp, decisión D3),
 * no los 5 pp del Dashboard original, para no decir «va al día» de una obra marcada Retrasada.
 */
export function fraseCurvaS(curva: CurvaS): FraseCurvaS | null {
  if (curva.semanaCorte === 0) return { texto: 'Aún no hay semanas cerradas ni reportadas.', desviacion: 0 };
  const p = curva.semanas[curva.semanaCorte - 1];
  const real = p.real ?? 0;
  const dev = real - p.pactado;
  const r = pctMostrado(real);
  const pa = pctMostrado(p.pactado);
  if (pa >= 100 && r < 100) return { texto: `Plazo vencido sin terminar: ${r}% real frente a ${pa}% pactado a la semana ${curva.semanaCorte}.`, desviacion: dev };
  if (dev >= -0.5) return { texto: `Va al día: ${r}% real frente a ${pa}% pactado a la semana ${curva.semanaCorte}.`, desviacion: dev };
  return { texto: `Va ${Math.abs(Math.round(dev))} pp por debajo de lo pactado a la semana ${curva.semanaCorte}: ${r}% real frente a ${pa}%.`, desviacion: dev };
}

export const MAX_SEMANAS_GRILLA = SEMANAS_AVANCE;
