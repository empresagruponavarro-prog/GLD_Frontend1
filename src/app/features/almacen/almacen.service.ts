import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  Almacen,
  AlmacenPayload,
  Consulta,
  Documento,
  DocumentoPayload,
  DocumentoQuery,
  FamiliaOption,
  KardexQuery,
  KardexRow,
  Naturaleza,
  Paginated,
  Prestamo,
  PrestamoPayload,
  PrestamoQuery,
  ProductoSelectOption,
  RecepcionOrdenCompra,
  RecepcionPayload,
  RecepcionPendiente,
  RetornoPayload,
  SelectOption,
  StockQuery,
  StockRow,
} from './almacen.models';

/** Ruta REST por tipo de documento. */
export type RutaDocumento = 'ingresos' | 'salidas' | 'transferencias' | 'inventario-inicial';

export const RUTA_POR_NATURALEZA: Record<Naturaleza, RutaDocumento> = {
  INGRESO: 'ingresos',
  SALIDA: 'salidas',
  TRANSFERENCIA: 'transferencias',
};

function toParams(query: object): HttpParams {
  let params = new HttpParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  });
  return params;
}

@Service()
export class AlmacenService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/almacen`;
  private readonly maestros = `${environment.apiUrl}/maestros`;

  // ---- Almacenes
  getAlmacenes(query: { page?: number; pageSize?: number; nombre?: string; estado?: boolean } = {}): Observable<Paginated<Almacen>> {
    return this.http.get<Paginated<Almacen>>(`${this.api}/almacenes`, { params: toParams(query) });
  }
  getAlmacenesSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${this.api}/almacenes/select`);
  }
  createAlmacen(data: AlmacenPayload): Observable<Almacen> {
    return this.http.post<Almacen>(`${this.api}/almacenes`, data);
  }
  updateAlmacen(id: number, data: AlmacenPayload): Observable<Almacen> {
    return this.http.patch<Almacen>(`${this.api}/almacenes/${id}`, data);
  }
  deleteAlmacen(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/almacenes/${id}`);
  }

  // ---- Documentos (ingresos / salidas / transferencias / inventario inicial)
  getDocumentos(ruta: RutaDocumento, query: DocumentoQuery = {}): Observable<Paginated<Documento>> {
    return this.http.get<Paginated<Documento>>(`${this.api}/${ruta}`, { params: toParams(query) });
  }
  getDocumento(ruta: RutaDocumento, id: number): Observable<Documento> {
    return this.http.get<Documento>(`${this.api}/${ruta}/${id}`);
  }
  createDocumento(ruta: RutaDocumento, data: DocumentoPayload): Observable<Documento> {
    return this.http.post<Documento>(`${this.api}/${ruta}`, data);
  }
  anularDocumento(ruta: RutaDocumento, id: number): Observable<Documento> {
    return this.http.post<Documento>(`${this.api}/${ruta}/${id}/anular`, {});
  }

  // ---- Recepción de compras (OC -> ingreso COMPRA)
  getRecepcionesPendientes(search?: string): Observable<RecepcionPendiente[]> {
    return this.http.get<RecepcionPendiente[]>(`${this.api}/recepciones/pendientes`, { params: toParams({ search }) });
  }
  getOrdenCompraParaRecepcion(id: number): Observable<RecepcionOrdenCompra> {
    return this.http.get<RecepcionOrdenCompra>(`${this.api}/recepciones/orden-compra/${id}`);
  }
  recibirOrdenCompra(data: RecepcionPayload): Observable<Documento> {
    return this.http.post<Documento>(`${this.api}/recepciones`, data);
  }

  // ---- Préstamos
  getPrestamos(query: PrestamoQuery = {}): Observable<Paginated<Prestamo>> {
    return this.http.get<Paginated<Prestamo>>(`${this.api}/prestamos`, { params: toParams(query) });
  }
  getPrestamo(id: number): Observable<Prestamo> {
    return this.http.get<Prestamo>(`${this.api}/prestamos/${id}`);
  }
  createPrestamo(data: PrestamoPayload): Observable<Prestamo> {
    return this.http.post<Prestamo>(`${this.api}/prestamos`, data);
  }
  registrarRetorno(id: number, data: RetornoPayload): Observable<Prestamo> {
    return this.http.post<Prestamo>(`${this.api}/prestamos/${id}/retornos`, data);
  }
  anularPrestamo(id: number): Observable<Prestamo> {
    return this.http.post<Prestamo>(`${this.api}/prestamos/${id}/anular`, {});
  }

  // ---- Stock, kardex, consulta
  getStock(query: StockQuery = {}): Observable<Paginated<StockRow>> {
    return this.http.get<Paginated<StockRow>>(`${this.api}/stock`, { params: toParams(query) });
  }
  getCompraSugerida(query: StockQuery = {}): Observable<Paginated<StockRow>> {
    return this.http.get<Paginated<StockRow>>(`${this.api}/stock/compra-sugerida`, { params: toParams(query) });
  }
  marcarOperativo(idProducto: number, idAlmacen: number, cantidad: string): Observable<void> {
    return this.http.patch<void>(`${this.api}/stock/${idProducto}/${idAlmacen}/operativo`, { cantidad });
  }
  getKardex(query: KardexQuery = {}): Observable<Paginated<KardexRow>> {
    return this.http.get<Paginated<KardexRow>>(`${this.api}/kardex`, { params: toParams(query) });
  }
  consultar(q: string): Observable<Consulta> {
    return this.http.get<Consulta>(`${this.api}/consulta`, { params: toParams({ q }) });
  }

  // ---- Selectores auxiliares
  getProductosSelect(): Observable<ProductoSelectOption[]> {
    return this.http.get<ProductoSelectOption[]>(`${this.maestros}/producto/select`, { params: toParams({ tipo_producto: 'PRODUCTO' }) });
  }
  getProveedoresSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${this.maestros}/anexo/select`, { params: toParams({ tipoAnexo: 'Proveedor' }) });
  }
  getTrabajadoresSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${this.maestros}/anexo/select`, { params: toParams({ tipoAnexo: 'Trabajador' }) });
  }
  getFamiliasSelect(): Observable<FamiliaOption[]> {
    return this.http.get<FamiliaOption[]>(`${this.maestros}/familia-almacen/select`);
  }
  getCentrosCostosSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/centros-costos/select`);
  }
}
