import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html'
})
export class SidebarComponent {
  /** Las entradas de administración (Usuarios, Roles, Empresas) solo se muestran al rol Administrador. */
  readonly esAdministrador = inject(AuthService).esAdministrador;

  isMaestrosOpen = true;
  isDocumentosOpen = true;
  isAlmacenOpen = true;
  isTesoreriaOpen = true;

  toggleMaestros() {
    this.isMaestrosOpen = !this.isMaestrosOpen;
  }

  toggleAlmacen() {
    this.isAlmacenOpen = !this.isAlmacenOpen;
  }

  toggleTesoreria() {
    this.isTesoreriaOpen = !this.isTesoreriaOpen;
  }

  toggleDocumentos() {
    this.isDocumentosOpen = !this.isDocumentosOpen;
  }
}
