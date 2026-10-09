import { Observable, catchError, concat, concatMap, defer, map, of, toArray } from 'rxjs';

/** Subconjunto de PresupuestosService que usa la orquestación (facilita simularlo en tests). */
export interface FasesCategoriasWriter {
  createFaseAsignada(data: any): Observable<any>;
  createCategoriaAsignada(data: any): Observable<any>;
}

export interface FaseCategoriaAGuardar {
  idFase: string;
  nombre: string;
  /** Vacio = fase sin categoria (solo se crea la fase). */
  idCategoria: string;
  categoria?: string;
  subtotal: number;
  id_categoria?: number;
  categoriaRealDescripcion?: string;
}

export interface FaseFallida {
  nombre: string;
  motivo: string;
}

/**
 * Fila del paso "Fases y costos" del wizard (una fila = fase + categoria).
 * - `idCategoriaDetalle`: id numerico de la categoria ya guardada (ppto_DetalleFasesCate).
 * - `idFaseDetalle`: id numerico de la fase ya guardada (ppto_DetalleFases).
 * Si no tiene ninguno de los dos, la fila aun no existe en el servidor.
 */
export interface FilaFormFase {
  idFase: string;
  nombre: string;
  idCategoria: string;
  categoria: string;
  subtotal: number;
  idFaseDetalle?: number;
  /** IdPresupuestoDetalle de la fase guardada (para colgarle categorias nuevas). */
  codigoFaseDetalle?: string;
  idCategoriaDetalle?: number;
  id_categoria?: number;
  categoriaRealDescripcion?: string;
}

export type ModoPlantilla = 'agregar' | 'reemplazar';

export function mensajeDeError(error: any): string {
  return error?.error?.message || error?.message || 'Error desconocido';
}

/** Agrupa las filas por fase conservando el orden de aparición. */
function agruparPorFase(items: FaseCategoriaAGuardar[]): FaseCategoriaAGuardar[][] {
  const grupos = new Map<string, FaseCategoriaAGuardar[]>();
  for (const item of items) {
    const grupo = grupos.get(item.idFase);
    if (grupo) grupo.push(item);
    else grupos.set(item.idFase, [item]);
  }
  return [...grupos.values()];
}

/**
 * Crea, en orden, cada fase (una sola vez por `idFase`) y luego sus categorías:
 * fase 1 → categorías de la fase 1 → fase 2 → ...
 *
 * - El costo directo de la fase es la suma de sus filas.
 * - Las filas sin `idCategoria` solo aportan la fase (no se crea una categoría vacía).
 * - Las categorías repetidas dentro de una misma fase se escriben una sola vez.
 * - Un fallo no detiene las siguientes fases; se devuelve la lista de fallos (vacía si todo
 *   se escribio). Emite una sola vez, al terminar todas las escrituras.
 *
 * Los IDs generados en el cliente comparten un mismo sello de tiempo más el índice, de modo
 * que son únicos dentro de la operación (hasta que exista el endpoint transaccional, DATA-11).
 */
export function crearFasesConCategorias(
  api: FasesCategoriasWriter,
  contextoBase: Record<string, unknown>,
  items: FaseCategoriaAGuardar[],
  stamp: number = Date.now(),
): Observable<FaseFallida[]> {
  const escrituras = agruparPorFase(items).map((grupo, i) => {
    const primera = grupo[0];
    const nombreFase = primera.nombre || primera.idFase;
    const idDetalle = `DF-${stamp}-${i}`;
    const faseData = {
      ...contextoBase,
      IdpptoFase: primera.idFase,
      IdPresupuestoDetalle: idDetalle,
      CostoDirecto: grupo.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0),
    };

    const vistas = new Set<string>();
    const categorias = grupo.filter((it) => {
      if (!it.idCategoria || vistas.has(it.idCategoria)) return false;
      vistas.add(it.idCategoria);
      return true;
    });

    const crearCategorias = categorias.map((cat, j) =>
      defer(() =>
        api.createCategoriaAsignada({
          ...contextoBase,
          IdpptoFase: primera.idFase,
          IdPresupuestoDetalle: idDetalle,
          IdPresupuestoDetalleCategoria: `DFC-${stamp}-${i}-${j}`,
          IdpptoFaseCategoria: cat.idCategoria,
          CostoDirecto: Number(cat.subtotal) || 0, id_categoria: cat.id_categoria,
          SubTotalCategoria: Number(cat.subtotal) || 0,
        }),
      ).pipe(
        map((): FaseFallida | null => null),
        catchError((error) =>
          of<FaseFallida | null>({
            nombre: `${nombreFase} / ${cat.categoria || cat.idCategoria}`,
            motivo: mensajeDeError(error),
          }),
        ),
      ),
    );

    return defer(() => api.createFaseAsignada(faseData)).pipe(
      concatMap(() => (crearCategorias.length ? concat(...crearCategorias) : of(null))),
      catchError((error) => of<FaseFallida | null>({ nombre: nombreFase, motivo: mensajeDeError(error) })),
    );
  });

  return concat(...escrituras).pipe(
    toArray(),
    map((resultados) => resultados.filter((r): r is FaseFallida => r !== null)),
  );
}

export function describirFasesFallidas(fallidas: FaseFallida[]): string {
  return fallidas.map((f) => `${f.nombre}: ${f.motivo}`).join('\n');
}

// Plantillas 

interface PlantillaParaFilas {
  fases: {
    IdpptoFase: string;
    NombreFase?: string;
    categorias?: { IdpptoFaseCategoria: string; NombreCategoria?: string; CostoReferencial?: number }[];
  }[];
}

/** Convierte una plantilla en filas del wizard (una por categoria; una sin categoria si la fase no tiene). */
export function plantillaAFilas(plantilla: PlantillaParaFilas): FilaFormFase[] {
  const filas: FilaFormFase[] = [];
  for (const fase of plantilla.fases ?? []) {
    const nombre = fase.NombreFase || fase.IdpptoFase;
    const categorias = (fase.categorias ?? []).filter((c) => !!c.IdpptoFaseCategoria);
    if (categorias.length === 0) {
      filas.push({ idFase: fase.IdpptoFase, nombre, idCategoria: '', categoria: '(Sin categoria)', subtotal: 0 });
      continue;
    }
    for (const cat of categorias) {
      filas.push({
        idFase: fase.IdpptoFase,
        nombre,
        idCategoria: cat.IdpptoFaseCategoria,
        categoria: cat.NombreCategoria || cat.IdpptoFaseCategoria,
        subtotal: Number(cat.CostoReferencial) || 0,
      });
    }
  }
  return filas;
}

const claveFila = (f: Pick<FilaFormFase, 'idFase' | 'idCategoria'>) => `${f.idFase}|${f.idCategoria}`;

/**
 * Combina las filas actuales con las de una plantilla sin duplicar.
 * - `reemplazar`: descarta las actuales.
 * - `agregar`: conserva las actuales y solo anade las filas (fase+categoria) que faltan.
 *   Si una fase ya tiene categorias, no se anade su fila "sin categoria".
 */
export function fusionarFilasPlantilla(
  actuales: FilaFormFase[],
  nuevas: FilaFormFase[],
  modo: ModoPlantilla,
): { filas: FilaFormFase[]; agregadas: number; omitidas: number } {
  const base = modo === 'reemplazar' ? [] : actuales;
  const claves = new Set(base.map(claveFila));
  const fasesPresentes = new Set(base.map((f) => f.idFase));
  const resultado = [...base];
  let agregadas = 0;
  let omitidas = 0;

  for (const fila of nuevas) {
    const duplicada = claves.has(claveFila(fila)) || (!fila.idCategoria && fasesPresentes.has(fila.idFase));
    if (duplicada) {
      omitidas++;
      continue;
    }
    resultado.push(fila);
    claves.add(claveFila(fila));
    fasesPresentes.add(fila.idFase);
    agregadas++;
  }
  return { filas: resultado, agregadas, omitidas };
}

/** Convierte la respuesta de `getPresupuestoCompleto` en filas del wizard. */
export function completoAFilas(completo: { fases?: any[] } | null | undefined): FilaFormFase[] {
  const filas: FilaFormFase[] = [];
  for (const f of completo?.fases ?? []) {
    const nombre = f.NombreFase || f.FaseProyecto || f.IdpptoFase;
    const categorias: any[] = Array.isArray(f.categorias) ? f.categorias : [];
    if (categorias.length === 0) {
      filas.push({
        idFase: f.IdpptoFase,
        nombre,
        idCategoria: '',
        categoria: '(Sin categoría)',
        subtotal: Number(f.CostoDirecto ?? 0),
        idFaseDetalle: f.id,
        codigoFaseDetalle: f.IdPresupuestoDetalle,
      });
      continue;
    }
    for (const c of categorias) {
      filas.push({
        idFase: f.IdpptoFase,
        nombre,
        idCategoria: c.IdpptoFaseCategoria || '',
        categoria: c.Descripcion || c.CategoriaInsumo || c.IdpptoFaseCategoria || '(Sin categoría)',
        subtotal: Number(c.CostoDirecto ?? c.SubTotalCategoria ?? 0),
        idFaseDetalle: f.id,
        codigoFaseDetalle: f.IdPresupuestoDetalle,
        idCategoriaDetalle: c.id, id_categoria: c.id_categoria, categoriaRealDescripcion: c.categoriaRealDescripcion || (c.categoria && c.categoria.descripcion) || '',
      });
    }
  }
  return filas;
}

