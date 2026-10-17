import { Observable, firstValueFrom } from 'rxjs';
import type { Paginated } from '../models';

/** Celda exportable: texto, número o vacío. */
export type CeldaExport = string | number | null | undefined;

/** Tabla lista para exportar: lo que la pantalla muestra (cabeceras y filas ya filtradas). */
export interface DatosExportacion {
  /** Nombre base del archivo, sin extensión ni fecha. */
  readonly nombre: string;
  /** Nombre de la hoja de Excel (máx. 31 caracteres). */
  readonly hoja?: string;
  readonly columnas: readonly string[];
  readonly filas: readonly (readonly CeldaExport[])[];
}

export type FormatoExportacion = 'csv' | 'xlsx';

const MIME: Record<FormatoExportacion, string> = {
  csv: 'text/csv;charset=utf-8;',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function textoCsv(valor: CeldaExport): string {
  if (valor === null || valor === undefined) return '""';
  if (typeof valor === 'number') return String(valor);
  // Evita que Excel interprete el texto como fórmula (=, +, -, @).
  const seguro = /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replace(/"/g, '""')}"`;
}

/** CSV con BOM UTF-8 (Excel respeta tildes y ñ) y saltos de línea CRLF. */
export function generarCsv(datos: DatosExportacion): string {
  const lineas = [datos.columnas.map(textoCsv), ...datos.filas.map((fila) => fila.map(textoCsv))];
  return '\uFEFF' + lineas.map((l) => l.join(',')).join('\r\n');
}

/** Libro de Excel con cabecera resaltada, fila congelada, filtro automático y anchos ajustados. */
export async function generarXlsx(datos: DatosExportacion): Promise<Blob> {
  const { Workbook } = await import('exceljs');
  const libro = new Workbook();
  const hoja = libro.addWorksheet((datos.hoja ?? datos.nombre).replace(/[/\\?*:[\]]/g, ' ').slice(0, 31));
  hoja.columns = datos.columnas.map((titulo, i) => {
    const mayor = datos.filas.reduce((max, fila) => Math.max(max, String(fila[i] ?? '').length), titulo.length);
    return { header: titulo, key: `c${i}`, width: Math.min(Math.max(mayor + 2, 10), 60) };
  });
  hoja.addRows(datos.filas.map((fila) => fila.map((c) => c ?? '')));
  const cabecera = hoja.getRow(1);
  cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  if (datos.columnas.length > 0) {
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: datos.columnas.length } };
  }
  const buffer = await libro.xlsx.writeBuffer();
  return new Blob([buffer], { type: MIME.xlsx });
}

/** Genera y descarga el archivo `<nombre>_<fecha>.<formato>`. */
export async function exportarDatos(datos: DatosExportacion, formato: FormatoExportacion): Promise<void> {
  const blob = formato === 'xlsx' ? await generarXlsx(datos) : new Blob([generarCsv(datos)], { type: MIME.csv });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${datos.nombre}_${new Date().toISOString().substring(0, 10)}.${formato}`;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Tamaño de página máximo que acepta el backend (`PaginationQueryDto`). */
const PAGINA_MAXIMA = 100;

/** Recorre todas las páginas de un listado paginado (con los filtros que `cargar` ya aplica) y junta las filas. */
export async function traerTodasLasPaginas<T>(
  cargar: (page: number, pageSize: number) => Observable<Paginated<T>>,
): Promise<T[]> {
  const filas: T[] = [];
  let pagina = 1;
  let totalPaginas: number;
  do {
    const respuesta = await firstValueFrom(cargar(pagina, PAGINA_MAXIMA));
    filas.push(...respuesta.data);
    totalPaginas = respuesta.totalPages;
    pagina++;
  } while (pagina <= totalPaginas);
  return filas;
}
