import { Component } from '@angular/core';
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
  imports: [RouterModule],
  templateUrl: './maestros-generales.html'
})
export class MaestrosGeneralesComponent {
  subModules: SubModuleCard[] = [
    { title: 'Empresas', description: 'Registro y administración de datos de empresas', icon: 'fa-solid fa-building', route: '/admin/empresas' },
    { title: 'Anexos', description: 'Maestro de anexos', icon: 'fa-solid fa-paperclip', route: '/anexos' },
    { title: 'Catálogo de Bienes y Servicios', description: 'Maestro de bienes y servicios', icon: 'fa-solid fa-box', route: '/productos' },
    { title: 'Áreas de la empresa', description: 'Costos, Procura, Sistemas… (requerimientos y documentos de origen)', icon: 'fa-solid fa-sitemap', route: '/maestros-generales/areas' },
    { title: 'Especialidades', description: 'Maestro de especialidades', icon: 'fa-solid fa-user-doctor', route: '/maestros-generales/especialidades' },
    { title: 'Tipo Documento de Identidad', description: 'Maestro de tipos de documento', icon: 'fa-solid fa-id-card', route: '/maestros-generales/tipo-doc-identidad' },
    { title: 'Unidades de Medida', description: 'KG, M2, CIENTO… y sus equivalencias', icon: 'fa-solid fa-ruler-combined', route: '/maestros-generales/unidades-medida' },
    { title: 'Ubicaciones Físicas y Locales', description: 'Sedes de empresa, locales de obra, niveles, ambientes y asignación', icon: 'fa-solid fa-map-location-dot', route: '/maestros-generales/locales' },
  ];
}
