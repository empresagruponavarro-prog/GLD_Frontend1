import { Observable, catchError, concat, concatMap, defer, map, of, toArray } from 'rxjs';

/** Subconjunto de PresupuestosService que usa la orquestación (facilita simularlo en tests). */
export interface FasesCategoriasWriter {
  createFaseAsignada(data: any): Observable<any>;
  createCategoriaAsignada(data: any): Observable<any>;
}

export interface FaseCategoriaAGuardar {
  idFase: string;
  nombre: string;
  idCategoria: string;
  subtotal: number;
}

export interface FaseFallida {
  nombre: string;
  motivo: string;
}

export function mensajeDeError(error: any): string {
  return error?.error?.message || error?.message || 'Error desconocido';
}

/**
 * Crea, en orden, cada fase y luego su categoría (fase 1 → categoría 1 → fase 2 → ...).
 * Un fallo en una fase o en su categoría no detiene las siguientes; se devuelve la lista
 * de fases fallidas (vacía si todo se escribió). Emite una sola vez, al terminar las 2N escrituras.
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
  const escrituras = items.map((item, index) => {
    const faseData = {
      ...contextoBase,
      IdpptoFase: item.idFase,
      IdPresupuestoDetalle: `DF-${stamp}-${index}`,
      CostoDirecto: item.subtotal,
    };
    return defer(() => api.createFaseAsignada(faseData)).pipe(
      concatMap(() =>
        api.createCategoriaAsignada({
          ...faseData,
          IdPresupuestoDetalleCategoria: `DFC-${stamp}-${index}`,
          IdpptoFaseCategoria: item.idCategoria,
          SubTotalCategoria: item.subtotal,
        }),
      ),
      map((): FaseFallida | null => null),
      catchError((error) => of<FaseFallida | null>({ nombre: item.nombre || item.idFase, motivo: mensajeDeError(error) })),
    );
  });

  return concat(...escrituras).pipe(
    toArray(),
    map((resultados) => resultados.filter((r): r is FaseFallida => r !== null)),
  );
}

export function describirFasesFallidas(fallidas: FaseFallida[]): string {
  return fallidas.map((f) => `• ${f.nombre}: ${f.motivo}`).join('\n');
}
