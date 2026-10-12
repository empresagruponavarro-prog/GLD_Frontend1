import { ObraIncidencia, ObraPlano, ObraSemana } from './obra.interface';

/** Hito de la Curva S mostrado bajo la barra de avance del header. */
export interface HitoCurvaS {
  id: number;
  etiqueta: string;
  fase: string;
  completado: boolean;
  actual: boolean;
}

/** Ordena semanas por número (no muta el arreglo original). */
export function ordenarSemanas(semanas: readonly ObraSemana[]): ObraSemana[] {
  return [...semanas].sort((a, b) => a.numero_semana - b.numero_semana);
}

export function hitosCurvaS(semanas: readonly ObraSemana[], semanaActiva: number): HitoCurvaS[] {
  return ordenarSemanas(semanas).map((s) => ({
    id: s.id,
    etiqueta: s.etiqueta_semana,
    fase: s.fase_principal,
    completado: s.estado === 'Completado',
    actual: s.numero_semana === semanaActiva,
  }));
}

/** Porcentaje acotado 0..100 para usar en anchos de barra. */
export function clampPct(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Siguiente número de semana y fecha sugerida (día siguiente al fin de la última). */
export function sugerenciaNuevaSemana(semanas: readonly ObraSemana[], fechaInicioObra?: string) {
  const ordenadas = ordenarSemanas(semanas);
  const ultima = ordenadas[ordenadas.length - 1];
  const numero = (ultima?.numero_semana ?? 0) + 1;
  const inicio = ultima?.fecha_fin ? sumarDias(ultima.fecha_fin, 1) : (fechaInicioObra ?? '');
  const fin = inicio ? sumarDias(inicio, 6) : '';
  return { numero, inicio, fin, metaAnterior: ultima?.porcentaje_meta ?? 0 };
}

/** Suma días a una fecha 'YYYY-MM-DD' (UTC, sin desfases de zona horaria). */
export function sumarDias(fechaIso: string, dias: number): string {
  const t = Date.parse(`${fechaIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t)) return '';
  return new Date(t + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Filtra planos por texto libre (código, nombre, disciplina, emisor) y disciplina exacta. */
export function filtrarPlanos(planos: readonly ObraPlano[], texto: string, disciplina: string): ObraPlano[] {
  const q = texto.trim().toLowerCase();
  return planos.filter((p) => {
    if (disciplina && p.disciplina !== disciplina) return false;
    if (!q) return true;
    return [p.codigo_plano, p.nombre_plano, p.disciplina, p.emitido_por ?? '', p.version]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
}

/** Ordena incidencias: no resueltas primero, luego por prioridad y fecha más reciente. */
export function ordenarIncidencias(incidencias: readonly ObraIncidencia[]): ObraIncidencia[] {
  const peso: Record<string, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };
  return [...incidencias].sort((a, b) => {
    const ra = a.estado === 'RESUELTA' ? 1 : 0;
    const rb = b.estado === 'RESUELTA' ? 1 : 0;
    if (ra !== rb) return ra - rb;
    const pa = peso[a.prioridad] ?? 9;
    const pb = peso[b.prioridad] ?? 9;
    if (pa !== pb) return pa - pb;
    return (b.fecha_reporte ?? '').localeCompare(a.fecha_reporte ?? '');
  });
}

// ─── Clases visuales (Tailwind tokens ya usados en el cockpit) ───────────────
export function estadoSemanaClass(estado: string): string {
  switch (estado) {
    case 'Completado':
      return 'bg-primary-fixed text-on-primary-fixed-variant';
    case 'En Plazo':
      return 'bg-primary/15 text-primary';
    case 'Retrasado':
      return 'bg-error-container text-on-error-container';
    default:
      return 'bg-surface-container text-on-surface-variant';
  }
}

export function estadoPlanoClass(estado: string): string {
  switch (estado) {
    case 'Aprobado Obra':
    case 'Para Construcción':
      return 'bg-primary-fixed text-on-primary-fixed-variant';
    case 'En Revisión':
      return 'bg-secondary-container text-on-secondary-container';
    case 'Observado':
      return 'bg-error-container text-on-error-container';
    default:
      return 'bg-surface-container text-on-surface-variant';
  }
}

export function estadoDocumentoClass(estado: string): string {
  switch (estado) {
    case 'Validado':
      return 'bg-primary-fixed text-on-primary-fixed-variant';
    case 'Pendiente':
      return 'bg-secondary-container text-on-secondary-container';
    case 'Observado':
    case 'Vencido':
      return 'bg-error-container text-on-error-container';
    default:
      return 'bg-surface-container text-on-surface-variant';
  }
}

export function prioridadClass(prioridad: string): string {
  switch (prioridad) {
    case 'CRITICA':
    case 'ALTA':
      return 'bg-error-container text-on-error-container';
    case 'MEDIA':
      return 'bg-secondary-container text-on-secondary-container';
    default:
      return 'bg-surface-container text-on-surface-variant';
  }
}

export function iconoCategoriaDocumento(categoria: string): string {
  switch (categoria) {
    case 'Acta':
      return 'verified_user';
    case 'Permiso':
      return 'description';
    case 'Seguridad':
      return 'shield';
    case 'Calidad':
      return 'fact_check';
    case 'Contrato':
      return 'gavel';
    default:
      return 'draft';
  }
}

/** Convierte cadenas vacías en undefined para no enviar campos vacíos al backend. */
export function sinVacios<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  ) as T;
}
