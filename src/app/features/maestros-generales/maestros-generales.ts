import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface SubModuleCard {
  title: string;
  description: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-maestros-generales',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './maestros-generales.html'
})
export class MaestrosGeneralesComponent {
  subModules: SubModuleCard[] = [
    { title: 'Empresas', description: 'Registro y administración de datos de empresas', icon: 'fa-solid fa-building', route: '/admin/empresas' },
  ];
}
