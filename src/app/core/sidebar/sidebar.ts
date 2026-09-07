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

  toggleMaestros() {
    this.isMaestrosOpen = !this.isMaestrosOpen;
  }
}
