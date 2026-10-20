import { Component, ElementRef, Injector, OnInit, afterNextRender, signal, inject, computed, viewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { Observable, of, switchMap, map } from 'rxjs';
import { CategoriasService } from '../../maestros-generales/categorias/categorias.service';
import { CategoriaSelect } from '../../maestros-generales/categorias/interfaces/categorias.interface';
import { PresupuestosService, Plantilla, PlantillaCompleta, PlantillaFaseDto, PlantillaCategoriaDto, FaseMaestra, FaseCategoriaMaestra } from '../presupuestos.service';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { valorDeEvento } from '@shared/utils/eventos';
import { ExportarBotonesComponent } from '../../../shared/components/exportar-botones/exportar-botones';
import type { DatosExportacion } from '../../../shared/utils/exportar';
import {
  PartidaItemsDialogComponent,
  type PartidaInfo,
  type GuardadoEvent,
} from './dialogs/partida-items-dialog/partida-items-dialog';

/** Formulario del pop-up "Nueva plantilla". */
interface NuevaPlantillaForm {
  Nombre: string;
  Descripcion: string;
  Activo: boolean;
  origen: 'vacia' | 'copiar';
  IdPlantillaOrigen: string;
}

/** Formulario del pop-up "Editar información de plantilla". */
interface EditarPlantillaForm {
  IdPlantilla: string;
  Nombre: string;
  Descripcion: string;
  Activo: boolean;
}

@Component({
  selector: 'app-mantenimiento-plantillas',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, ExportarBotonesComponent, PartidaItemsDialogComponent],
  templateUrl: './mantenimiento-plantillas.html'
})
export class MantenimientoPlantillasComponent implements OnInit {
  private service = inject(PresupuestosService);
  private categoriasService = inject(CategoriasService);
  private injector = inject(Injector);

  /**
   * Permisos del módulo `presupuestos.plantillas` (plan 05, etapa D3; anexo §7.3):
   * "Nueva plantilla" (POST) → crear; el editor en línea (PUT `/plantillas/:id` y `/:id/fases`) → editar.
   * Nota: copiar de otra plantilla o crearla inactiva hace además un PUT (editar); sin `editar`
   * esas opciones del alta quedan deshabilitadas para no dejar la plantilla a medio crear.
   */
  protected readonly permisos = permisosDePantalla('presupuestos.plantillas');

  /** Editor en solo lectura (sin `editar`): campos deshabilitados, sin guardar/agregar/quitar ni arrastrar. */
  readonly soloLectura = computed(() => !this.permisos.editar());

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

  /** Plantillas que cumplen búsqueda y estado activos, listas para exportar. */
  readonly datosExportacion = computed<DatosExportacion>(() => ({
    nombre: 'Plantillas',
    columnas: ['Código', 'Nombre', 'Descripción', 'Estado', 'Fases', 'Categorías', 'Fecha Creación'],
    filas: this.filteredPlantillas().map((p) => [
      p.IdPlantilla,
      p.Nombre,
      p.Descripcion,
      p.Activo ? 'Activa' : 'Inactiva',
      p.totalFases,
      p.totalCategorias,
      p.FechaCreacion,
    ]),
  }));

  resetFilters() {
    this.searchQuery.set('');
    this.statusFilter.set('Estado: Todas');
  }

  categoriasMaestras = signal<FaseCategoriaMaestra[]>([]);

  showFaseModal = signal(false);
  showCategoriaModal = signal(false);
  categoriasDisponiblesModal = signal<FaseCategoriaMaestra[]>([]);
  categoriasReal = signal<CategoriaSelect[]>([]);
  selectedCategoriaReal = signal<number | string>('');
  modalCategoriaModo = signal<'new' | 'edit'>('new');
  modalCategoriaData = { id: 0, idx: -1 };
  targetFaseForCat = signal<PlantillaFaseDto | null>(null);

  selectedFaseMaestra = signal<string>('');
  selectedCategoriaMaestra = signal<string>('');

  // Modal de gestión de ítems por partida
  showItemsModal = signal(false);
  partidaSeleccionadaParaItems = signal<PartidaInfo | null>(null);


  ngOnInit() {
    this.loadPlantillas();
    this.loadCatalogos();
  }

  loadPlantillas() {
    this.service.getPlantillasTodas().subscribe({
      next: (res) => this.plantillas.set(res),
      error: () => alert('Error cargando plantillas')
    });
  }

  loadCatalogos() {
    this.categoriasService.getSelect().subscribe((c: CategoriaSelect[]) => this.categoriasReal.set(c));
    this.service.getFasesMaestras().subscribe(res => {
      const f: FaseMaestra[] = Array.isArray(res) ? res : res.data ?? [];
      this.fasesMaestras.set(f);
    });
    this.service.getCategoriasFasesMaestras().subscribe(res => {
      const c: FaseCategoriaMaestra[] = Array.isArray(res) ? res : res.data ?? [];
      this.categoriasMaestras.set(c);
    });
  }

  selectPlantilla(p: Plantilla) {
    this.service.getPlantillaCompleta(p.IdPlantilla).subscribe({
      next: (res) => this.selectedPlantilla.set(res),
      error: () => alert('Error cargando detalle de plantilla')
    });
  }

  // ==========================================
  // MENÚ DE TRES PUNTITOS Y ACCIONES DE PLANTILLA
  // ==========================================
  menuAbiertoId = signal<string | null>(null);

  @HostListener('document:click')
  onDocumentClick() {
    this.menuAbiertoId.set(null);
  }

  toggleMenuPlantilla(event: MouseEvent, id: string) {
    event.stopPropagation();
    if (this.menuAbiertoId() === id) {
      this.menuAbiertoId.set(null);
    } else {
      this.menuAbiertoId.set(id);
    }
  }

  // Modal Editar Información de Plantilla
  showEditarInfoModal = signal(false);
  guardandoInfo = signal(false);
  errorEditarInfo = signal('');
  editarInfoForm: EditarPlantillaForm = {
    IdPlantilla: '',
    Nombre: '',
    Descripcion: '',
    Activo: true,
  };

  abrirEditarInfo(p: Plantilla, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.menuAbiertoId.set(null);
    this.errorEditarInfo.set('');
    this.editarInfoForm = {
      IdPlantilla: p.IdPlantilla,
      Nombre: p.Nombre,
      Descripcion: p.Descripcion || '',
      Activo: p.Activo,
    };
    this.showEditarInfoModal.set(true);
  }

  cerrarEditarInfo() {
    if (this.guardandoInfo()) return;
    this.showEditarInfoModal.set(false);
  }

  guardarEditarInfo() {
    if (!this.editarInfoForm.Nombre.trim()) {
      this.errorEditarInfo.set('El nombre de la plantilla es obligatorio.');
      return;
    }
    this.guardandoInfo.set(true);
    this.errorEditarInfo.set('');

    const dto = {
      Nombre: this.editarInfoForm.Nombre.trim(),
      Descripcion: this.editarInfoForm.Descripcion.trim(),
      Activo: this.editarInfoForm.Activo,
    };

    this.service.updatePlantilla(this.editarInfoForm.IdPlantilla, dto).subscribe({
      next: (res) => {
        this.guardandoInfo.set(false);
        this.showEditarInfoModal.set(false);
        const sel = this.selectedPlantilla();
        if (sel && sel.IdPlantilla === this.editarInfoForm.IdPlantilla) {
          sel.Nombre = res.Nombre;
          sel.Descripcion = res.Descripcion;
          sel.Activo = res.Activo;
          this.selectedPlantilla.set({ ...sel });
        }
        this.loadPlantillas();
      },
      error: (err) => {
        this.guardandoInfo.set(false);
        this.errorEditarInfo.set(err?.error?.message || 'Error al actualizar la plantilla.');
      }
    });
  }

  toggleActivarPlantilla(p: Plantilla, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.menuAbiertoId.set(null);
    const nuevoEstado = !p.Activo;
    this.service.updatePlantilla(p.IdPlantilla, { Activo: nuevoEstado }).subscribe({
      next: (res) => {
        const sel = this.selectedPlantilla();
        if (sel && sel.IdPlantilla === p.IdPlantilla) {
          sel.Activo = res.Activo;
          this.selectedPlantilla.set({ ...sel });
        }
        this.loadPlantillas();
      },
      error: () => alert('Error al cambiar el estado de la plantilla.')
    });
  }

  eliminarPlantilla(p: Plantilla, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.menuAbiertoId.set(null);
    const seguro = confirm(`¿Estás seguro de que deseas eliminar la plantilla "${p.Nombre}"?\nEsta acción no se puede deshacer.`);
    if (!seguro) return;

    this.service.deletePlantilla(p.IdPlantilla).subscribe({
      next: () => {
        if (this.selectedPlantilla()?.IdPlantilla === p.IdPlantilla) {
          this.selectedPlantilla.set(null);
        }
        this.loadPlantillas();
      },
      error: (err) => {
        alert(err?.error?.message || 'No se pudo eliminar la plantilla. Puede que esté asociada a presupuestos existentes.');
      }
    });
  }

  // ==========================================
  // FUSIONAR PLANTILLAS
  // ==========================================
  showFusionarModal = signal(false);
  fusionando = signal(false);
  errorFusionar = signal('');
  plantillaDestinoFusion = signal<Plantilla | null>(null);
  fusionOrigenId = '';
  fusionEliminarOrigen = true;

  otrasPlantillas = computed(() => {
    const d = this.plantillaDestinoFusion();
    return this.plantillas().filter(p => p.IdPlantilla !== d?.IdPlantilla);
  });

  abrirFusionar(p: Plantilla, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.menuAbiertoId.set(null);
    this.plantillaDestinoFusion.set(p);
    this.fusionOrigenId = '';
    this.fusionEliminarOrigen = true;
    this.errorFusionar.set('');
    this.showFusionarModal.set(true);
  }

  cerrarFusionar() {
    if (this.fusionando()) return;
    this.showFusionarModal.set(false);
  }

  confirmarFusionar() {
    const destino = this.plantillaDestinoFusion();
    if (!destino || !this.fusionOrigenId) return;
    this.fusionando.set(true);
    this.errorFusionar.set('');
    this.service.fusionarPlantilla(destino.IdPlantilla, {
      IdPlantillaOrigen: this.fusionOrigenId,
      EliminarOrigen: this.fusionEliminarOrigen,
    }).subscribe({
      next: () => {
        this.fusionando.set(false);
        this.showFusionarModal.set(false);
        this.loadPlantillas();
        this.selectPlantilla(destino);
      },
      error: (err) => {
        this.fusionando.set(false);
        this.errorFusionar.set(err?.error?.message || 'No se pudo fusionar las plantillas.');
      }
    });
  }

  // ==========================================
  // POP-UP "NUEVA PLANTILLA"
  // ==========================================
  showNuevaPlantillaModal = signal(false);
  creandoPlantilla = signal(false);
  nuevaForm: NuevaPlantillaForm = {
    Nombre: '',
    Descripcion: '',
    Activo: true,
    origen: 'vacia',
    IdPlantillaOrigen: '',
  };
  nuevaError = signal('');
  private nuevaNombreInput = viewChild<ElementRef<HTMLInputElement>>('nuevaNombreInput');

  nuevaPlantilla() {
    if (!this.permisos.crear()) return;
    this.nuevaForm = { Nombre: '', Descripcion: '', Activo: true, origen: 'vacia', IdPlantillaOrigen: '' };
    this.nuevaError.set('');
    this.showNuevaPlantillaModal.set(true);
    // Foco en "Nombre" al abrir el pop-up (sustituye al atributo autofocus).
    afterNextRender(() => this.nuevaNombreInput()?.nativeElement.focus(), { injector: this.injector });
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
    if (!this.puedeCrearPlantilla || !this.permisos.crear()) return;
    const f = this.nuevaForm;
    this.creandoPlantilla.set(true);
    this.nuevaError.set('');

    this.service.createPlantilla({ Nombre: f.Nombre.trim(), Descripcion: f.Descripcion.trim() }).pipe(
      // Copiar estructura (fases + categorías + costos referenciales) desde otra plantilla
      switchMap((creada: Plantilla) => {
        if (f.origen !== 'copiar' || !f.IdPlantillaOrigen) return of(creada);
        return this.service.getPlantillaCompleta(f.IdPlantillaOrigen).pipe(
          switchMap(origen => {
            const fases: PlantillaFaseDto[] = (origen.fases || []).map((fa, i) => ({
              id: 0,
              IdPlantillaFase: fa.IdPlantillaFase || '',
              IdpptoFase: fa.IdpptoFase,
              NombreFase: fa.NombreFase,
              Orden: i,
              categorias: (fa.categorias || []).map(c => ({
                id: 0,
                IdPlantillaFase: c.IdPlantillaFase || '',
                IdpptoFaseCategoria: c.IdpptoFaseCategoria,
                NombreCategoria: c.NombreCategoria,
                CostoReferencial: Number(c.CostoReferencial) || 0,
                id_categoria: c.id_categoria,
                categoria: c.categoria,
              })),
            }));
            if (!fases.length) return of(creada);
            return this.service.updatePlantillaFases(creada.IdPlantilla, fases).pipe(map(() => creada));
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
    if (this.soloLectura()) return;
    const p = this.selectedPlantilla();
    if (!p) return;

    // Limpiar el payload para enviar solo lo que el DTO del backend permite (UpsertPlantillaFaseDto)
    const payloadFases: PlantillaFaseDto[] = p.fases.map((f: PlantillaFaseDto) => ({
      id: f.id,
      IdPlantillaFase: f.IdPlantillaFase || '',
      IdpptoFase: f.IdpptoFase,
      NombreFase: f.NombreFase,
      Orden: f.Orden,
      categorias: (f.categorias || []).map((c: PlantillaCategoriaDto) => ({
        id: c.id,
        IdPlantillaFase: c.IdPlantillaFase || '',
        IdpptoFaseCategoria: c.IdpptoFaseCategoria,
        NombreCategoria: c.NombreCategoria,
        CostoReferencial: Number(c.CostoReferencial) || 0,
        id_categoria: c.id_categoria,
        categoria: c.categoria,
      }))
    }));

    this.service.updatePlantilla(p.IdPlantilla, { Nombre: p.Nombre, Descripcion: p.Descripcion, Activo: p.Activo }).subscribe({
      next: () => {
        this.service.updatePlantillaFases(p.IdPlantilla, payloadFases).subscribe({
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
    if (this.soloLectura()) return;
    this.selectedFaseMaestra.set('');
    this.showFaseModal.set(true);
  }

  confirmAddFase() {
    if (this.soloLectura()) return;
    const p = this.selectedPlantilla();
    const idFase = this.selectedFaseMaestra();
    if (!p || !idFase) return;

    const faseName = this.fasesMaestras().find(f => f.IdpptoFase === idFase)?.FaseProyecto || 'Fase Desconocida';

    p.fases = [...p.fases, {
      id: 0,
      IdPlantillaFase: '',
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

  abrirModalCategoria(modo: 'new' | 'edit', fase: PlantillaFaseDto, cat?: PlantillaCategoriaDto) {
    if (this.soloLectura()) return;
    this.targetFaseForCat.set(fase);
    this.modalCategoriaModo.set(modo);
    
    if (modo === 'edit' && cat) {
      this.selectedCategoriaMaestra.set(cat.IdpptoFaseCategoria || '');
      this.selectedCategoriaReal.set(cat.id_categoria || '');
      const idx = fase.categorias.findIndex((c: PlantillaCategoriaDto) => c === cat);
      this.modalCategoriaData = { id: cat.id, idx };
    } else {
      this.selectedCategoriaMaestra.set('');
      this.selectedCategoriaReal.set('');
      this.modalCategoriaData = { id: 0, idx: -1 };
    }

    this.categoriasDisponiblesModal.set([]);
    this.service.getCategoriasDeFase(fase.IdpptoFase).subscribe({
      next: (res: FaseCategoriaMaestra[] | { data?: FaseCategoriaMaestra[] }) => {
        const list: FaseCategoriaMaestra[] = Array.isArray(res) ? res : (res.data || []);
        this.categoriasDisponiblesModal.set(list.filter((c: FaseCategoriaMaestra) => c.IdpptoFase === fase.IdpptoFase));
      },
      error: () => this.categoriasDisponiblesModal.set([])
    });
    this.showCategoriaModal.set(true);
  }

  addCategoria(fase: PlantillaFaseDto) {
    this.abrirModalCategoria('new', fase);
  }

  confirmAddCategoria() {
    if (this.soloLectura()) return;
    const fase = this.targetFaseForCat();
    const idCat = this.selectedCategoriaMaestra();
    if (!fase || !idCat) return;

    const catName = this.categoriasDisponiblesModal().find((c: FaseCategoriaMaestra) => c.IdpptoFaseCategoria === idCat)?.Descripcion || 'Cat Desconocida';
    const realId = this.selectedCategoriaReal() ? Number(this.selectedCategoriaReal()) : undefined;
    const realDesc = this.categoriasReal().find((c: CategoriaSelect) => c.id === realId)?.nombre || '';
    
    if (this.modalCategoriaModo() === 'edit' && this.modalCategoriaData.idx >= 0) {
      fase.categorias[this.modalCategoriaData.idx].IdpptoFaseCategoria = idCat;
      fase.categorias[this.modalCategoriaData.idx].NombreCategoria = catName;
      fase.categorias[this.modalCategoriaData.idx].id_categoria = realId;
      fase.categorias[this.modalCategoriaData.idx].categoria = realId ? { id: realId, descripcion: realDesc } : undefined;
    } else {
      fase.categorias.push({
        id: 0,
        IdPlantillaFase: fase.IdPlantillaFase ? fase.IdPlantillaFase : '',
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

  actualizarCategoriaReal(cat: PlantillaCategoriaDto, event: Event) {
    if (this.soloLectura()) return;
    const valor = valorDeEvento(event);
    const realId = valor && valor !== 'undefined' ? Number(valor) : undefined;
    cat.id_categoria = realId;
    if (realId) {
      const realDesc = this.categoriasReal().find((c: CategoriaSelect) => c.id === realId)?.nombre || '';
      cat.categoria = { id: realId, descripcion: realDesc };
    } else {
      cat.categoria = undefined;
    }
    this.selectedPlantilla.set(JSON.parse(JSON.stringify(this.selectedPlantilla())));
  }

  removeFase(fase: PlantillaFaseDto) {
    if (this.soloLectura()) return;
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
    if (this.soloLectura()) return;
    const p = this.selectedPlantilla();
    if (p && p.fases) {
      moveItemInArray(p.fases, event.previousIndex, event.currentIndex);
      // Reassign order
      p.fases.forEach((f, index) => f.Orden = index);
      this.selectedPlantilla.set(JSON.parse(JSON.stringify(p)));
    }
  }

  dropCategoria(fase: PlantillaFaseDto, event: CdkDragDrop<PlantillaCategoriaDto[]>) {
    if (this.soloLectura()) return;
    if (fase && fase.categorias) {
      moveItemInArray(fase.categorias, event.previousIndex, event.currentIndex);
      this.selectedPlantilla.set(JSON.parse(JSON.stringify(this.selectedPlantilla())));
    }
  }

  removeCategoria(fase: PlantillaFaseDto, cat: PlantillaCategoriaDto) {
    if (this.soloLectura()) return;
    fase.categorias = fase.categorias.filter(c => c !== cat);
    this.selectedPlantilla.set(JSON.parse(JSON.stringify(this.selectedPlantilla())));
  }

  // ==========================================
  // MODAL DE ÍTEMS DE PARTIDA
  // ==========================================
  abrirModalItems(fase: PlantillaFaseDto, cat: PlantillaCategoriaDto) {
    if (!cat.id) {
      alert('Esta partida aún no ha sido guardada en la base de datos. Por favor pulsa "Guardar Cambios" antes de configurar sus ítems.');
      return;
    }
    this.partidaSeleccionadaParaItems.set({
      id: cat.id,
      IdpptoFaseCategoria: cat.IdpptoFaseCategoria,
      NombreCategoria: cat.NombreCategoria,
      NombreFase: fase.NombreFase,
    });
    this.showItemsModal.set(true);
  }

  cerrarModalItems() {
    this.showItemsModal.set(false);
    this.partidaSeleccionadaParaItems.set(null);
  }

  onItemsGuardados(evt: GuardadoEvent) {
    const p = this.selectedPlantilla();
    if (!p) return;
    for (const f of p.fases || []) {
      const cat = (f.categorias || []).find(c => c.id === evt.idPartida);
      if (cat) {
        cat.CostoReferencial = evt.costoTotal;
        cat.VentaReferencial = evt.ventaTotal;
        cat.totalItems = evt.totalItems;
        break;
      }
    }
    this.selectedPlantilla.set(JSON.parse(JSON.stringify(p)));
  }
}
