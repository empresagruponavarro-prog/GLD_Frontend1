import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { ProductoSelect, TipoProducto } from './interfaces/productos.interface';

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
}
