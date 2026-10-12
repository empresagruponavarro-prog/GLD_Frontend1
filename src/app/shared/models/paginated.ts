/** Respuesta paginada estándar del backend (`toPaginated` en GLD_Backend). */
export interface Paginated<T> {
  readonly data: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}
