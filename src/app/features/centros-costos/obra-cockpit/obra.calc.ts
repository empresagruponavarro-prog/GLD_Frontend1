import { ObraDocumento, ObraIncidencia, ObraPlano, ObraSemana } from './obra.interface';

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
  const copia = { ...obj };
  for (const [clave, valor] of Object.entries(copia)) {
    if (valor === '' || valor === null || valor === undefined) Reflect.deleteProperty(copia, clave);
  }
  return copia;
}

/** Minúsculas sin tildes para comparar texto de forma tolerante. */
/** Tamaño legible de un archivo: "812 KB", "3.8 MB". Vacío si no se conoce. */
export function formatearBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Ícono (Material Symbols), colores de fondo/texto y extensión en mayúsculas para un nombre de archivo. */
export function iconoArchivo(nombre: string | null | undefined): { icono: string; clase: string; extension: string } {
  const punto = (nombre ?? '').lastIndexOf('.');
  const ext = punto >= 0 ? (nombre ?? '').slice(punto + 1).toLowerCase() : '';
  const extension = ext.toUpperCase();
  switch (ext) {
    case 'pdf':
      return { icono: 'picture_as_pdf', clase: 'bg-red-50 text-red-600 border-red-100', extension };
    case 'doc':
    case 'docx':
      return { icono: 'description', clase: 'bg-blue-50 text-blue-600 border-blue-100', extension };
    case 'xls':
    case 'xlsx':
      return { icono: 'table_chart', clase: 'bg-emerald-50 text-emerald-600 border-emerald-100', extension };
    case 'ppt':
    case 'pptx':
      return { icono: 'slideshow', clase: 'bg-orange-50 text-orange-600 border-orange-100', extension };
    case 'jpg':
    case 'jpeg':
    case 'png':
      return { icono: 'image', clase: 'bg-violet-50 text-violet-600 border-violet-100', extension };
    case 'zip':
      return { icono: 'folder_zip', clase: 'bg-amber-50 text-amber-600 border-amber-100', extension };
    default:
      return { icono: 'draft', clase: 'bg-slate-50 text-slate-500 border-slate-200', extension };
  }
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de Lima, igual que el backend. */
export function hoyLimaIso(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(ahora);
}

export function normalizarTexto(valor: string | null | undefined): string {
  return (valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export interface FiltroDocumentos {
  texto?: string;
  categoria?: string;
  estado?: string;
}

/** Filtra documentos por texto (título, subtítulo, N° registro; sin mayúsculas ni tildes), categoría y estado exactos. */
export function filtrarDocumentos(docs: readonly ObraDocumento[], filtro: FiltroDocumentos): ObraDocumento[] {
  const q = normalizarTexto(filtro.texto);
  return docs.filter((d) => {
    if (filtro.categoria && d.categoria !== filtro.categoria) return false;
    if (filtro.estado && d.estado !== filtro.estado) return false;
    if (!q) return true;
    return normalizarTexto([d.titulo, d.subtitulo ?? '', d.nro_registro ?? ''].join(' ')).includes(q);
  });
}

/** Nombre legible de un archivo guardado: quita carpeta y prefijo uuid8_; para URL http(s) devuelve el host. */
export function nombreArchivoDocumento(archivoUrl: string | null | undefined): string {
  if (!archivoUrl) return '';
  if (/^https?:\/\//i.test(archivoUrl)) {
    try {
      return new URL(archivoUrl).host || 'Enlace externo';
    } catch {
      return 'Enlace externo';
    }
  }
  return (archivoUrl.split('/').pop() ?? '').replace(/^[0-9a-f]{8}_/i, '');
}
