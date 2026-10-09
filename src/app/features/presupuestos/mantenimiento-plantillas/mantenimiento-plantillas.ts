import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { Observable, of, switchMap, map } from 'rxjs';
import { CategoriasService } from '../../maestros-generales/categorias/categorias.service';
import { PresupuestosService, Plantilla, PlantillaCompleta, PlantillaFaseDto, PlantillaCategoriaDto, FaseMaestra, FaseCategoriaMaestra } from '../presupuestos.service';

@Component({
  selector: 'app-mantenimiento-plantillas',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './mantenimiento-plantillas.html'
})
export class MantenimientoPlantillasComponent implements OnInit {
  private service = inject(PresupuestosService);
  private categoriasService = inject(CategoriasService);

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
  categoriasDisponiblesModal = signal<any[]>([]);
  categoriasReal = signal<any[]>([]);
  selectedCategoriaReal = signal<number | string>('');
  modalCategoriaModo = signal<'new' | 'edit'>('new');
  modalCategoriaData = { id: 0, idx: -1 };
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
    this.categoriasService.getSelect().subscribe((c: any) => this.categoriasReal.set(c));
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

    abrirModalCategoria(modo: 'new' | 'edit', fase: PlantillaFaseDto, cat?: any) {
    this.targetFaseForCat.set(fase);
    this.modalCategoriaModo.set(modo);
    
    if (modo === 'edit' && cat) {
      this.selectedCategoriaMaestra.set(cat.IdpptoFaseCategoria || '');
      this.selectedCategoriaReal.set(cat.id_categoria || '');
      const idx = fase.categorias.findIndex((c: any) => c === cat);
      this.modalCategoriaData = { id: cat.id, idx };
    } else {
      this.selectedCategoriaMaestra.set('');
      this.selectedCategoriaReal.set('');
      this.modalCategoriaData = { id: 0, idx: -1 };
    }

    this.categoriasDisponiblesModal.set([]);
    this.service.getCategoriasDeFase(fase.IdpptoFase).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (res.data || []);
        this.categoriasDisponiblesModal.set(list.filter((c: any) => c.IdpptoFase === fase.IdpptoFase));
      },
      error: () => this.categoriasDisponiblesModal.set([])
    });
    this.showCategoriaModal.set(true);
  }

  addCategoria(fase: PlantillaFaseDto) {
    this.abrirModalCategoria('new', fase);
  }

  confirmAddCategoria() {
    const fase = this.targetFaseForCat();
    const idCat = this.selectedCategoriaMaestra();
    if (!fase || !idCat) return;

    const catName = this.categoriasDisponiblesModal().find((c: any) => c.IdpptoFaseCategoria === idCat)?.Descripcion || 'Cat Desconocida';
    const realId = this.selectedCategoriaReal() ? Number(this.selectedCategoriaReal()) : undefined;
    const realDesc = this.categoriasReal().find((c: any) => c.id === realId)?.nombre || '';
    
    if (this.modalCategoriaModo() === 'edit' && this.modalCategoriaData.idx >= 0) {
      fase.categorias[this.modalCategoriaData.idx].IdpptoFaseCategoria = idCat;
      fase.categorias[this.modalCategoriaData.idx].NombreCategoria = catName;
      fase.categorias[this.modalCategoriaData.idx].id_categoria = realId;
      fase.categorias[this.modalCategoriaData.idx].categoria = realId ? { id: realId, descripcion: realDesc } : undefined;
    } else {
      fase.categorias.push({
        id: 0,
        IdPlantillaFase: fase.IdPlantillaFase ? fase.IdPlantillaFase : undefined as any,
        IdpptoFaseCategoria: idCat,
        NombreCategoria: catName,
        CostoReferencial: 0,
        id_categoria: realId,
        categoria: realId ? { id: realId, descripcion: realDesc } : undefined
      });
    }
    
    this.selectedPlantilla.set(JSON.parse(JSON.stringify(this.selectedPlantilla())));
    this.showCategoriaModal.set(false);
  }

  cancelAddCategoria() {
    this.showCategoriaModal.set(false);
    this.targetFaseForCat.set(null);
  }

    actualizarCategoriaReal(cat: any, event: Event) {
    const select = event.target as HTMLSelectElement;
    const realId = select.value && select.value !== 'undefined' ? Number(select.value) : undefined;
    cat.id_categoria = realId;
    if (realId) {
      const realDesc = this.categoriasReal().find((c: any) => c.id === realId)?.nombre || '';
      cat.categoria = { id: realId, descripcion: realDesc };
    } else {
      cat.categoria = undefined;
    }
    this.selectedPlantilla.set(JSON.parse(JSON.stringify(this.selectedPlantilla())));
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
