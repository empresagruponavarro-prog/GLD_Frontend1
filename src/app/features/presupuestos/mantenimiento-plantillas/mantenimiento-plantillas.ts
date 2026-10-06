import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { Observable, of, switchMap, map } from 'rxjs';
import { PresupuestosService, Plantilla, PlantillaCompleta, PlantillaFaseDto, PlantillaCategoriaDto, FaseMaestra, FaseCategoriaMaestra } from '../presupuestos.service';

@Component({
  selector: 'app-mantenimiento-plantillas',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './mantenimiento-plantillas.html'
})
export class MantenimientoPlantillasComponent implements OnInit {
  private service = inject(PresupuestosService);

  plantillas = signal<Plantilla[]>([]);
  selectedPlantilla = signal<PlantillaCompleta | null>(null);
  
  fasesMaestras = signal<FaseMaestra[]>([]);
  
  searchQuery = signal<string>('');
  statusFilter = signal<string>('Estado: Todas');

  filteredPlantillas = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    
    return this.plantillas().filter(p => {
      // Filtrar por texto
      const matchesText = !query || 
                          p.Nombre.toLowerCase().includes(query) || 
                          p.IdPlantilla.toLowerCase().includes(query) || 
                          (p.Descripcion && p.Descripcion.toLowerCase().includes(query));
      
      // Filtrar por estado
      let matchesStatus = true;
      if (status === 'Activas') matchesStatus = p.Activo === true;
      if (status === 'Inactivas') matchesStatus = p.Activo === false;
      
      return matchesText && matchesStatus;
    });
  });

  resetFilters() {
    this.searchQuery.set('');
    this.statusFilter.set('Estado: Todas');
  }

  categoriasMaestras = signal<FaseCategoriaMaestra[]>([]);

  showFaseModal = signal(false);
  showCategoriaModal = signal(false);
  targetFaseForCat = signal<PlantillaFaseDto | null>(null);

  selectedFaseMaestra = signal<string>('');
  selectedCategoriaMaestra = signal<string>('');


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

  // ==========================================
  // POP-UP "NUEVA PLANTILLA"
  // ==========================================
  showNuevaPlantillaModal = signal(false);
  creandoPlantilla = signal(false);
  nuevaForm = {
    Nombre: '',
    Descripcion: '',
    Activo: true,
    origen: 'vacia' as 'vacia' | 'copiar',
    IdPlantillaOrigen: '',
  };
  nuevaError = signal('');

  nuevaPlantilla() {
    this.nuevaForm = { Nombre: '', Descripcion: '', Activo: true, origen: 'vacia', IdPlantillaOrigen: '' };
    this.nuevaError.set('');
    this.showNuevaPlantillaModal.set(true);
  }

  cerrarNuevaPlantilla() {
    if (this.creandoPlantilla()) return;
    this.showNuevaPlantillaModal.set(false);
  }

  get nombreDuplicado(): boolean {
    const n = this.nuevaForm.Nombre.trim().toLowerCase();
    return !!n && this.plantillas().some(p => (p.Nombre || '').trim().toLowerCase() === n);
  }

  get puedeCrearPlantilla(): boolean {
    const f = this.nuevaForm;
    if (!f.Nombre.trim() || this.nombreDuplicado || this.creandoPlantilla()) return false;
    if (f.origen === 'copiar' && !f.IdPlantillaOrigen) return false;
    return true;
  }

  confirmarNuevaPlantilla() {
    if (!this.puedeCrearPlantilla) return;
    const f = this.nuevaForm;
    this.creandoPlantilla.set(true);
    this.nuevaError.set('');

    this.service.createPlantilla({ Nombre: f.Nombre.trim(), Descripcion: f.Descripcion.trim() }).pipe(
      // Copiar estructura (fases + categorías + costos referenciales) desde otra plantilla
      switchMap((creada: Plantilla) => {
        if (f.origen !== 'copiar' || !f.IdPlantillaOrigen) return of(creada);
        return this.service.getPlantillaCompleta(f.IdPlantillaOrigen).pipe(
          switchMap(origen => {
            const fases = (origen.fases || []).map((fa, i) => ({
              IdpptoFase: fa.IdpptoFase,
              Orden: i,
              categorias: (fa.categorias || []).map(c => ({
                IdpptoFaseCategoria: c.IdpptoFaseCategoria,
                CostoReferencial: Number(c.CostoReferencial) || 0,
              })),
            }));
            if (!fases.length) return of(creada);
            return this.service.updatePlantillaFases(creada.IdPlantilla, fases as any).pipe(map(() => creada));
          }),
        );
      }),
      // Estado inicial (el backend la crea activa por defecto)
      switchMap((creada: Plantilla): Observable<Plantilla> =>
        f.Activo ? of(creada) : this.service.updatePlantilla(creada.IdPlantilla, { Activo: false }).pipe(map(() => creada)),
      ),
    ).subscribe({
      next: (creada) => {
        this.creandoPlantilla.set(false);
        this.showNuevaPlantillaModal.set(false);
        this.loadPlantillas();
        this.selectPlantilla(creada);
      },
      error: (err) => {
        this.creandoPlantilla.set(false);
        this.nuevaError.set('Error creando plantilla: ' + (err.error?.message || err.message));
      },
    });
  }

  guardarCambios() {
    const p = this.selectedPlantilla();
    if (!p) return;

    // Limpiar el payload para enviar solo lo que el DTO del backend permite (UpsertPlantillaFaseDto)
    const payloadFases = p.fases.map((f: any) => ({
      IdPlantillaFase: f.IdPlantillaFase ? f.IdPlantillaFase : undefined,
      IdpptoFase: f.IdpptoFase,
      Orden: f.Orden,
      categorias: (f.categorias || []).map((c: any) => ({
        IdPlantillaFase: c.IdPlantillaFase ? c.IdPlantillaFase : undefined,
        IdpptoFaseCategoria: c.IdpptoFaseCategoria,
        CostoReferencial: Number(c.CostoReferencial) || 0
      }))
    }));

    this.service.updatePlantilla(p.IdPlantilla, { Nombre: p.Nombre, Descripcion: p.Descripcion, Activo: p.Activo }).subscribe({
      next: () => {
        this.service.updatePlantillaFases(p.IdPlantilla, payloadFases as any).subscribe({
          next: () => {
            alert('Cambios guardados correctamente');
            this.loadPlantillas();
          },
          error: (err) => { console.error(err); alert('Error guardando fases: ' + (err.error?.message || err.message)); }
        });
      },
      error: () => alert('Error actualizando datos de plantilla')
    });
  }

  addFase() {
    this.selectedFaseMaestra.set('');
    this.showFaseModal.set(true);
  }

  confirmAddFase() {
    const p = this.selectedPlantilla();
    const idFase = this.selectedFaseMaestra();
    if (!p || !idFase) return;

    const faseName = this.fasesMaestras().find(f => f.IdpptoFase === idFase)?.FaseProyecto || 'Fase Desconocida';

    p.fases = [...p.fases, {
      id: 0,
      IdPlantillaFase: undefined as any,
      IdpptoFase: idFase,
      NombreFase: faseName,
      Orden: p.fases.length,
      categorias: []
    }];
    this.selectedPlantilla.set(JSON.parse(JSON.stringify(p)));
    this.showFaseModal.set(false);
  }

  cancelAddFase() {
    this.showFaseModal.set(false);
  }

  addCategoria(fase: PlantillaFaseDto) {
    this.targetFaseForCat.set(fase);
    this.selectedCategoriaMaestra.set('');
    this.showCategoriaModal.set(true);
  }

  confirmAddCategoria() {
    const fase = this.targetFaseForCat();
    const idCat = this.selectedCategoriaMaestra();
    if (!fase || !idCat) return;

    const catName = this.categoriasMaestras().find(c => c.IdpptoFaseCategoria === idCat)?.Descripcion || 'Cat Desconocida';
    
    fase.categorias.push({
      id: 0,
      IdPlantillaFase: fase.IdPlantillaFase ? fase.IdPlantillaFase : undefined as any,
      IdpptoFaseCategoria: idCat,
      NombreCategoria: catName,
      CostoReferencial: 0
    });
    this.selectedPlantilla.set(JSON.parse(JSON.stringify(this.selectedPlantilla())));
    this.showCategoriaModal.set(false);
  }

  cancelAddCategoria() {
    this.showCategoriaModal.set(false);
    this.targetFaseForCat.set(null);
  }

  removeFase(fase: PlantillaFaseDto) {
    const p = this.selectedPlantilla();
    if (!p) return;
    p.fases = p.fases.filter(f => f !== fase);
    this.selectedPlantilla.set(JSON.parse(JSON.stringify(p)));
  }

    getTotalCategorias(p: PlantillaCompleta): number {
    return p.fases?.reduce((acc, f) => acc + (f.categorias?.length || 0), 0) || 0;
  }

  getSubtotalFase(f: PlantillaFaseDto): number {
    return f.categorias?.reduce((acc, c) => acc + (Number(c.CostoReferencial) || 0), 0) || 0;
  }

  
  dropFase(event: CdkDragDrop<PlantillaFaseDto[]>) {
    const p = this.selectedPlantilla();
    if (p && p.fases) {
      moveItemInArray(p.fases, event.previousIndex, event.currentIndex);
      // Reassign order
      p.fases.forEach((f, index) => f.Orden = index);
      this.selectedPlantilla.set(JSON.parse(JSON.stringify(p)));
    }
  }

  dropCategoria(fase: PlantillaFaseDto, event: CdkDragDrop<PlantillaCategoriaDto[]>) {
    if (fase && fase.categorias) {
      moveItemInArray(fase.categorias, event.previousIndex, event.currentIndex);
      this.selectedPlantilla.set(JSON.parse(JSON.stringify(this.selectedPlantilla())));
    }
  }

  removeCategoria(fase: PlantillaFaseDto, cat: PlantillaCategoriaDto) {
    fase.categorias = fase.categorias.filter(c => c !== cat);
    this.selectedPlantilla.set(JSON.parse(JSON.stringify(this.selectedPlantilla())));
  }
}
