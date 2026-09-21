import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { CategoriaSelect } from './interfaces/categorias.interface';

@Service()
export class CategoriasService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/maestros/categoria`;

  getSelect(): Observable<CategoriaSelect[]> {
    return this.http.get<CategoriaSelect[]>(`${this.apiUrl}/select`);
  }
}
