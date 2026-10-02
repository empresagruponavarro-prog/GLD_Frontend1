import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PresupuestosService, Plantilla, PlantillaCompleta, PlantillaFaseDto, PlantillaCategoriaDto, FaseMaestra, FaseCategoriaMaestra } from '../presupuestos.service';

@Component({
  selector: 'app-mantenimiento-plantillas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mantenimiento-plantillas.html'
})
export class MantenimientoPlantillasComponent implements OnInit {
  private service = inject(PresupuestosService);

  plantillas = signal<Plantilla[]>([]);
  selectedPlantilla = signal<PlantillaCompleta | null>(null);
  
  fasesMaestras = signal<FaseMaestra[]>([]);
  categoriasMaestras = signal<FaseCategoriaMaestra[]>([]);

  ngOnInit() {
    this.loadPlantillas();
    this.loadCatalogos();
  }

  loadPlantillas() {
    this.service.getPlantillasTodas().subscribe({
      next: (res) => this.plantillas.set(res),
      error: (err) => alert('Error cargando plantillas')
    });
  }

  loadCatalogos() {
    this.service.getFasesMaestras().subscribe(res => {
      const raw = res as FaseMaestra[] | { data: FaseMaestra[] };
      const f: FaseMaestra[] = Array.isArray(raw) ? raw : (raw as { data: FaseMaestra[] }).data ?? [];
      this.fasesMaestras.set(f);
    });
    this.service.getCategoriasFasesMaestras().subscribe(res => {
      const raw = res as FaseCategoriaMaestra[] | { data: FaseCategoriaMaestra[] };
      const c: FaseCategoriaMaestra[] = Array.isArray(raw) ? raw : (raw as { data: FaseCategoriaMaestra[] }).data ?? [];
      this.categoriasMaestras.set(c);
    });
  }

  selectPlantilla(p: Plantilla) {
    this.service.getPlantillaCompleta(p.IdPlantilla).subscribe({
      next: (res) => this.selectedPlantilla.set(res),
      error: (err) => alert('Error cargando detalle de plantilla')
    });
  }

  nuevaPlantilla() {
    const nombre = prompt('Nombre de la nueva plantilla:');
    if (!nombre) return;
    
    this.service.createPlantilla({ Nombre: nombre, Descripcion: '' }).subscribe({
      next: (res: Plantilla) => {
        this.loadPlantillas();
        this.selectPlantilla(res);
      },
      error: (err) => alert('Error creando plantilla')
    });
  }

  guardarCambios() {
    const p = this.selectedPlantilla();
    if (!p) return;

    this.service.updatePlantilla(p.IdPlantilla, { Nombre: p.Nombre, Descripcion: p.Descripcion, Activo: p.Activo }).subscribe({
      next: () => {
        this.service.updatePlantillaFases(p.IdPlantilla, p.fases).subscribe({
          next: () => {
            alert('Cambios guardados correctamente');
            this.loadPlantillas();
          },
          error: () => alert('Error guardando fases')
        });
      },
      error: () => alert('Error actualizando datos de plantilla')
    });
  }

  addFase() {
    const p = this.selectedPlantilla();
    if (!p) return;
    
    const idFase = prompt('Ingrese ID de Fase (Ej: 11dcff08 para Obra Gruesa, o copia el ID de la tabla de fases maestras):\n' + this.fasesMaestras().slice(0,10).map(f => f.IdpptoFase + ' - ' + f.FaseProyecto).join('\n') + '...');
    if (!idFase) return;

    const faseName = this.fasesMaestras().find(f => f.IdpptoFase === idFase)?.FaseProyecto || 'Fase Desconocida';

    p.fases.push({
      id: 0,
      IdPlantillaFase: '',
      IdpptoFase: idFase,
      NombreFase: faseName,
      Orden: p.fases.length,
      categorias: []
    });
    this.selectedPlantilla.set({...p});
  }

  addCategoria(fase: PlantillaFaseDto) {
    const idCat = prompt('Ingrese ID de Categoría para la fase ' + fase.NombreFase + ':\n' + this.categoriasMaestras().filter(c => c.IdpptoFase === fase.IdpptoFase).map(c => c.IdpptoFaseCategoria + ' - ' + c.Descripcion).join('\n'));
    if (!idCat) return;

    const catName = this.categoriasMaestras().find(c => c.IdpptoFaseCategoria === idCat)?.Descripcion || 'Cat Desconocida';
    
    fase.categorias.push({
      id: 0,
      IdPlantillaFase: fase.IdPlantillaFase,
      IdpptoFaseCategoria: idCat,
      NombreCategoria: catName,
      CostoReferencial: 0
    });
  }

  removeFase(fase: PlantillaFaseDto) {
    const p = this.selectedPlantilla();
    if (!p) return;
    p.fases = p.fases.filter(f => f !== fase);
    this.selectedPlantilla.set({...p});
  }

  removeCategoria(fase: PlantillaFaseDto, cat: PlantillaCategoriaDto) {
    fase.categorias = fase.categorias.filter(c => c !== cat);
  }
}
