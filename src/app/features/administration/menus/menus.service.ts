import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MenuRoot, SubMenu } from './menus.interface';

export * from './menus.interface';

@Injectable({
  providedIn: 'root',
})
export class MenusService {
  private apiUrl = 'http://localhost:3000/administration/menus';

  constructor(private http: HttpClient) {}

  getTree(): Observable<MenuRoot[]> {
    return this.http.get<MenuRoot[]>(`${this.apiUrl}/tree`);
  }

  createRootMenu(data: { MenuId: string; MenuNombre: string; Imagen?: string }): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  updateRootMenu(id: string, data: { MenuNombre: string; Imagen?: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}`, data);
  }

  deleteRootMenu(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  createSubMenu(data: SubMenu): Observable<any> {
    return this.http.post(`${this.apiUrl}/submenu`, data);
  }

  updateSubMenu(menuId: string, oldNombre: string, data: SubMenu): Observable<any> {
    return this.http.patch(
      `${this.apiUrl}/submenu/${menuId}?oldNombre=${encodeURIComponent(oldNombre)}`,
      data
    );
  }

  deleteSubMenu(menuId: string, subNombre: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/submenu/${menuId}?subNombre=${encodeURIComponent(subNombre)}`
    );
  }
}
