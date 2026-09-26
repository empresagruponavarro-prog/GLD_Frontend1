import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  Producto,
  ProductoPaginated,
  ProductoQuery,
  ProductoSelect,
  SelectOption,
  TipoProducto,
} from './interfaces/productos.interface';

@Service()
export class ProductosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/maestros/producto`;

  getSelect(tipoProducto?: TipoProducto): Observable<ProductoSelect[]> {
    let params = new HttpParams();
    if (tipoProducto) {
      params = params.set('tipo_producto', tipoProducto);
    }
    return this.http.get<ProductoSelect[]>(`${this.apiUrl}/select`, { params });
  }

  getAll(query: ProductoQuery = {}): Observable<ProductoPaginated> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<ProductoPaginated>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Producto> {
    return this.http.get<Producto>(`${this.apiUrl}/${id}`);
  }

  create(data: Partial<Producto>): Observable<Producto> {
    return this.http.post<Producto>(this.apiUrl, data);
  }

  update(id: number, data: Partial<Producto>): Observable<Producto> {
    return this.http.patch<Producto>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getCategoriasSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/maestros/categoria/select`);
  }

  getUnidadesMedidaSelect(): Observable<SelectOption[]> {
    return this.http.get<SelectOption[]>(`${environment.apiUrl}/maestros/unidad-medida/select`);
  }
}
