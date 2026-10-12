import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html'
})
export class SidebarComponent {
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
