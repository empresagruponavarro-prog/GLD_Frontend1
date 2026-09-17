import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Router } from '@angular/router';
import { EmpresasService } from '../administration/empresas/empresas.service';
import { Empresa } from '../administration/empresas/interfaces';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestoPrincipal, PaginatedResponse, DetalleFase, PresupuestoCompleto, FaseMaestra, FaseCategoriaMaestra } from './interfaces';
import { CentrosCostosService } from '../centros-costos/centros-costos.service';
import { CentroCosto, CatalogosFiltros } from '../centros-costos/interfaces/centros-costos.interface';

@Component({
  selector: 'app-presupuestos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './presupuestos.html',
  styleUrls: ['./presupuestos.css']
  
})
export class PresupuestosComponent implements OnInit {
  private presupuestosService = inject(PresupuestosService);
  private centrosCostosService = inject(CentrosCostosService);
  private empresasService = inject(EmpresasService);
  private router = inject(Router);

  // Estado general
  loading = signal<boolean>(false);
  search = signal<string>('');
  searchInput = '';

  // Filtros — propiedades planas para compatibilidad con [(ngModel)]
  catalogos = signal<CatalogosFiltros | null>(null);
  empresas = signal<Empresa[]>([]);
  filterSearch = '';
  filterEmpresa = '';
  filterPeriodo = '';
  filterCliente = '';
  filterEstado = '';
  filterCategoria = 'Todos';
  statusPillFilter = signal<string>('');
  vistaActual = signal<'financiera' | 'operativa'>('financiera');

  setStatusPill(st: string) {
    if (this.statusPillFilter() === st) {
      this.statusPillFilter.set('');
    } else {
      this.statusPillFilter.set(st);
    }
  }

  setVista(v: 'financiera' | 'operativa') {
    this.vistaActual.set(v);
  }



  get countAbiertos(): number {
    return this.centrosCostos().filter(c => {
      const st = (c.PresupuestoEstado || c.Estado || '').toUpperCase();
      return st.includes('ABIERTO') || st.includes('APROBADO');
    }).length;
  }

  get countEnCierre(): number {
    return this.centrosCostos().filter(c => (c.PresupuestoEstado || c.Estado || '').toUpperCase().includes('CIERRE')).length;
  }

  get countCerrados(): number {
    return this.centrosCostos().filter(c => (c.PresupuestoEstado || c.Estado || '').toUpperCase().includes('CERRADO')).length;
  }

  get totalPortafolioActivo(): number {
    return this.centrosCostos().reduce((acc, c) => acc + (Number(c.PresupuestoMonto) || 0), 0);
  }

  
  isPptoSelected(ppto: PresupuestoPrincipal): boolean {
    const pptoId = String(ppto.IdPresupuesto ?? ppto.id ?? '');
    return this.selectedPresupuestoId() === pptoId;
  }

  onSelectPresupuesto(ppto: PresupuestoPrincipal) {
    const pptoId = String(ppto.IdPresupuesto ?? ppto.id ?? '');
    this.selectedPresupuestoId.set(pptoId);
    this.presupuestoActivo.set(null);
    this.selectedFase.set(null);
    this.cargarDetallePresupuesto(pptoId);
  }

  isBaseContractual(ppto: PresupuestoPrincipal): boolean {
    const tipo = (ppto.TipoPpto || (ppto as any).Tipo || '').toUpperCase();
    if (tipo.includes('ADICIONAL')) return false;
    return true;
  }

  openEditPresupuesto(ppto: any) {
    this.editModal(ppto);
  } // 'Todos' | 'Materiales' | 'Mano de Obra' | 'Equipos & Subc.'
  showNuevaCategoria = signal(false);
  nuevaCategoriaDescripcion = '';

  // Estado del layout Maestro-Detalle Múltiple
  centrosCostos = signal<CentroCosto[]>([]);

  // Getters en vez de computed() — se recalculan con el change detection normal de Angular
  get centrosCostosFiltrados(): CentroCosto[] {
    let list = this.centrosCostos();
    const s = (this.filterSearch || '').toLowerCase().trim();
    const emp = this.filterEmpresa;
    const per = this.filterPeriodo;
    const cli = this.filterCliente;
    const est = this.filterEstado;
    const pill = this.statusPillFilter();

    if (s) {
      list = list.filter(cc =>
        (cc.CodCentroCto && cc.CodCentroCto.toLowerCase().includes(s)) ||
        (cc.CentroCosto && cc.CentroCosto.toLowerCase().includes(s)) ||
        (cc.Cliente && cc.Cliente.toLowerCase().includes(s))
      );
    }
    if (emp) list = list.filter(cc => cc.CodEmpresa === emp || cc.Empresa === emp);
    if (per) list = list.filter(cc => String(cc.IdPeriodo) === String(per));
    if (cli) list = list.filter(cc => cc.CodCliente === cli || cc.Cliente === cli);
    if (est) list = list.filter(cc => (cc.PresupuestoEstado || cc.Estado) === est);
    if (pill) {
      list = list.filter(cc => {
        const st = (cc.PresupuestoEstado || cc.Estado || '').toUpperCase();
        if (pill === 'Abierto') return st.includes('ABIERTO') || st.includes('APROBADO');
        if (pill === 'En Cierre') return st.includes('CIERRE');
        if (pill === 'Cerrado') return st.includes('CERRADO');
        return true;
      });
    }

    return list;
  }

  selectedCC = signal<CentroCosto | null>(null);

  presupuestoActivo = signal<PresupuestoCompleto | null>(null);
  selectedFase = signal<DetalleFase | null>(null);

  get categoriasDeFase(): string[] {
    const f = this.selectedFase();
    if (!f || !f.categorias) return [];
    const set = new Set<string>();
    for (const c of f.categorias) {
      if (c.CategoriaInsumo) set.add(c.CategoriaInsumo);
    }
    return Array.from(set);
  }

  get categoriasFiltradas() {
    const f = this.selectedFase();
    if (!f || !f.categorias) return [];
    const cat = this.filterCategoria;
    if (!cat || cat === 'Todos') return f.categorias;
    const lower = cat.toLowerCase();
    return f.categorias.filter((c: any) => (c.CategoriaInsumo || '').toLowerCase().includes(lower));
  }

  getPesoFase(fase: DetalleFase): string {
    const totalCd = Number(this.presupuestoActivo()?.CostoDirecto) || 0;
    const faseCd = Number(fase.CostoDirecto) || 0;
    if (totalCd <= 0 || faseCd <= 0) return '0.0%';
    return ((faseCd / totalCd) * 100).toFixed(1) + '%';
  }

  getPesoCategoria(cat: any): string {
    const faseCd = Number(this.selectedFase()?.CostoDirecto) || 0;
    const catCd = Number(cat.CostoDirecto ?? cat.SubTotalCategoria) || 0;
    if (faseCd <= 0 || catCd <= 0) return '0.0%';
    return ((catCd / faseCd) * 100).toFixed(1) + '%';
  }

  getFaseCode(fase: DetalleFase | null): string {
    if (!fase) return '01';
    const idx = (this.presupuestoActivo()?.fases || []).findIndex(f => f.id === fase.id);
    const num = idx >= 0 ? idx + 1 : 1;
    return num < 10 ? '0' + num : String(num);
  }

  // ==========================================
  // NUEVO FORMULARIO ESTRUCTURADO (5 PASOS)
  // ==========================================
  showForm = signal<boolean>(false);
  formStep = signal<number>(1);

  // Modelo de Fases dinámicas para Paso 2
  formFases = signal<{ id?: number; idFase: string; nombre: string; idCategoria: string; categoria: string; subtotal: number }[]>([]);
  fasesMaestras = signal<FaseMaestra[]>([]);
  categoriasFaseMaestra = signal<FaseCategoriaMaestra[]>([]);

  // Quick Add para Fases
  newFaseId = '';
  newFaseCategoriaId = '';
  newFaseSubtotal: number | null = null;
  faseFormMode: 'new-fase' | 'new-categoria' | 'edit-fase' | 'edit-categoria' = 'new-fase';
  editingFaseAsignada: DetalleFase | null = null;
  editingCategoriaAsignada: any | null = null;

  // Modales directos y rápidos para Fase y Categoría (Dashboard)
  modalFaseOpen = signal<boolean>(false);
  modalFaseModo = signal<'new' | 'edit'>('new');
  modalFaseData = {
    id: null as number | null,
    IdpptoFase: '',
    CostoDirecto: null as number | null,
  };

  modalCategoriaOpen = signal<boolean>(false);
  modalCategoriaModo = signal<'new' | 'edit'>('new');
  modalCategoriaData = {
    id: null as number | null,
    faseNombre: '',
    IdpptoFase: '',
    IdpptoFaseCategoria: '',
    CostoDirecto: null as number | null,
  };
  categoriasDisponiblesModal = signal<FaseCategoriaMaestra[]>([]);

  // Parámetros Financieros para Paso 3
  pctGG = signal<number>(0.00);
  pctUtilidad = signal<number>(0.00);
  viaticos = signal<number>(0.00);
  descuento = signal<number>(0.00);

  // Archivos para Paso 4
  filePresupuestoName = signal<string | null>(null);
  filePresupuestoInfo = signal<string | null>(null);
  fileOCName = signal<string | null>(null);
  fileOCInfo = signal<string | null>(null);

  // Especialista y Control para Paso 5
  especialista = signal<string>('George Tavara');
  comentarios = signal<string>('');

  // Getters Financieros Reactivos
  get formCostoDirecto(): number {
    return this.formFases().reduce((acc, f) => acc + (Number(f.subtotal) || 0), 0);
  }

  get formMontoGG(): number {
    return this.formCostoDirecto * (this.pctGG() / 100);
  }

  get formMontoUtilidad(): number {
    return this.formCostoDirecto * (this.pctUtilidad() / 100);
  }

  get formSubtotal(): number {
    return (this.formCostoDirecto + this.formMontoGG + this.formMontoUtilidad + this.viaticos()) - this.descuento();
  }

  get formIGV(): number {
    return this.formSubtotal * 0.18;
  }

  get formTotalGeneral(): number {
    return this.formSubtotal + this.formIGV;
  }

  get formGGPlusUtilidad(): number {
    return this.formMontoGG + this.formMontoUtilidad;
  }

  // Guías y títulos de pasos
  stepTitles: { [key: number]: string } = {
    1: 'Etapa 1 de 5: Completando Datos Generales del Proyecto.',
    2: 'Etapa 2 de 5: Desglose de Fases y Costo Directo APU.',
    3: 'Etapa 3 de 5: Liquidación Financiera, Márgenes e Impuestos.',
    4: 'Etapa 4 de 5: Expediente Técnico, Archivos y Revisiones.',
    5: 'Etapa 5 de 5: Control, Comentarios y Aprobación Final.'
  };

  get stepIndicatorText(): string {
    return this.stepTitles[this.formStep()] || '';
  }

  get stepProgressBarWidth(): string {
    return `${(this.formStep() / 5) * 100}%`;
  }

  switchStep(step: number) {
    if (step >= 1 && step <= 5) {
      this.formStep.set(step);
    }
  }

  nextStep() {
    if (this.formStep() < 5) {
      this.formStep.set(this.formStep() + 1);
    }
  }

  prevStep() {
    if (this.formStep() > 1) {
      this.formStep.set(this.formStep() - 1);
    }
  }

  adjustNumeric(field: 'gg' | 'utilidad' | 'viaticos' | 'descuento', delta: number) {
    if (field === 'gg') {
      const v = Math.max(0, Number((this.pctGG() + delta).toFixed(2)));
      this.pctGG.set(v);
    } else if (field === 'utilidad') {
      const v = Math.max(0, Number((this.pctUtilidad() + delta).toFixed(2)));
      this.pctUtilidad.set(v);
    } else if (field === 'viaticos') {
      const v = Math.max(0, Number((this.viaticos() + delta).toFixed(2)));
      this.viaticos.set(v);
    } else if (field === 'descuento') {
      const v = Math.max(0, Number((this.descuento() + delta).toFixed(2)));
      this.descuento.set(v);
    }
  }

  addFormFase() {
    const fase = this.fasesMaestras().find((item) => item.IdpptoFase === this.newFaseId);
    const categoria = this.categoriasFaseMaestra().find((item) => item.IdpptoFaseCategoria === this.newFaseCategoriaId);
    if (!fase || !categoria) {
      alert('Seleccione una fase y su categoría.');
      return;
    }
    const monto = Number(this.newFaseSubtotal) || 0;
    this.formFases.update(items => [
      ...items,
      {
        idFase: fase.IdpptoFase,
        nombre: fase.FaseProyecto || fase.IdpptoFase,
        idCategoria: categoria.IdpptoFaseCategoria,
        categoria: categoria.Descripcion || categoria.IdpptoFaseCategoria,
        subtotal: monto
      }
    ]);
    this.newFaseId = '';
    this.newFaseCategoriaId = '';
    this.categoriasFaseMaestra.set([]);
    this.newFaseSubtotal = null;
  }

  get faseActivaCodigo(): string | null {
    return this.selectedFase()?.IdpptoFase || null;
  }

  abrirNuevaCategoria() {
    const fase = this.selectedFase();
    if (!fase) {
      alert('Seleccione primero una fase en la tabla.');
      return;
    }
    this.abrirModalCategoria('new');
  }

  abrirNuevaFase() {
    this.abrirModalFase('new');
  }

  editarFase(fase: DetalleFase, event: Event) {
    event.stopPropagation();
    this.abrirModalFase('edit', fase);
  }

  editarCategoria(categoria: any, event: Event) {
    event.stopPropagation();
    this.abrirModalCategoria('edit', categoria);
  }

  abrirModalFase(modo: 'new' | 'edit', fase?: DetalleFase) {
    const ppto = this.presupuestoActivo();
    if (!ppto) {
      alert('Seleccione primero un presupuesto.');
      return;
    }
    if (this.selectedCC()) {
      this.cargarFasesPorCentroCosto(this.selectedCC());
    } else if (ppto.id_centro_costo) {
      this.presupuestosService.getFasesMaestras({ id_centro_costo: ppto.id_centro_costo }).subscribe({
        next: (res) => this.fasesMaestras.set(Array.isArray(res) ? res : res.data || []),
      });
    }
    this.modalFaseModo.set(modo);
    this.modalFaseData = {
      id: fase?.id ?? null,
      IdpptoFase: fase?.IdpptoFase || '',
      CostoDirecto: fase?.CostoDirecto != null ? Number(fase.CostoDirecto) : null,
    };
    this.modalFaseOpen.set(true);
  }

  cerrarModalFase() {
    this.modalFaseOpen.set(false);
  }

  guardarModalFase() {
    const ppto = this.presupuestoActivo();
    if (!ppto) return;
    if (!this.modalFaseData.IdpptoFase) {
      alert('Seleccione una fase maestra.');
      return;
    }

    const monto = Number(this.modalFaseData.CostoDirecto) || 0;
    const payload = {
      IdPresupuesto: String(ppto.IdPresupuesto),
      IdpptoFase: this.modalFaseData.IdpptoFase,
      id_empresa: ppto.id_empresa,
      CodCentroCto: ppto.CodCentroCto,
      id_centro_costo: ppto.id_centro_costo,
      CostoDirecto: monto,
    };

    if (this.modalFaseModo() === 'edit' && this.modalFaseData.id) {
      this.presupuestosService.updateFaseAsignada(this.modalFaseData.id, payload).subscribe({
        next: () => {
          this.cerrarModalFase();
          this.recargarPresupuestoActivo();
        },
        error: (err) => alert('Error al actualizar fase: ' + (err.error?.message || err.message)),
      });
    } else {
      const idDetalle = `DF-${Date.now()}`;
      this.presupuestosService.createFaseAsignada({
        ...payload,
        IdPresupuestoDetalle: idDetalle,
      }).subscribe({
        next: () => {
          this.cerrarModalFase();
          this.recargarPresupuestoActivo();
        },
        error: (err) => alert('Error al crear fase: ' + (err.error?.message || err.message)),
      });
    }
  }

  abrirModalCategoria(modo: 'new' | 'edit', cat?: any) {
    const ppto = this.presupuestoActivo();
    const fase = this.selectedFase();
    if (!ppto || !fase) {
      alert('Seleccione primero una fase en la tabla.');
      return;
    }

    this.modalCategoriaModo.set(modo);
    this.modalCategoriaData = {
      id: cat?.id ?? null,
      faseNombre: fase.NombreFase || fase.IdpptoFase,
      IdpptoFase: fase.IdpptoFase,
      IdpptoFaseCategoria: cat?.IdpptoFaseCategoria || '',
      CostoDirecto: Number(cat?.CostoDirecto ?? cat?.SubTotalCategoria ?? 0) || null,
    };

    this.categoriasDisponiblesModal.set([]);
    this.presupuestosService.getCategoriasDeFase(fase.IdpptoFase).subscribe({
      next: (cats: any) => {
        let list = Array.isArray(cats) ? cats : (cats.data || []);
        if (cat?.IdpptoFaseCategoria && !list.some(c => c.IdpptoFaseCategoria === cat.IdpptoFaseCategoria)) {
          list = [{
            IdpptoFaseCategoria: cat.IdpptoFaseCategoria,
            Descripcion: cat.CategoriaInsumo || cat.Descripcion || cat.IdpptoFaseCategoria,
            id: cat.id,
          }, ...list];
        }
        this.categoriasDisponiblesModal.set(list);
      },
      error: () => {
        if (cat?.IdpptoFaseCategoria) {
          this.categoriasDisponiblesModal.set([{
            IdpptoFaseCategoria: cat.IdpptoFaseCategoria,
            Descripcion: cat.CategoriaInsumo || cat.Descripcion || cat.IdpptoFaseCategoria,
            id: cat.id,
          }]);
        }
      }
    });

    this.modalCategoriaOpen.set(true);
  }

  cerrarModalCategoria() {
    this.modalCategoriaOpen.set(false);
  }

  guardarModalCategoria() {
    const ppto = this.presupuestoActivo();
    const fase = this.selectedFase();
    if (!ppto || !fase) return;
    if (!this.modalCategoriaData.IdpptoFaseCategoria) {
      alert('Seleccione una categoría.');
      return;
    }

    const monto = Number(this.modalCategoriaData.CostoDirecto) || 0;
    const payload = {
      IdPresupuesto: String(ppto.IdPresupuesto),
      IdpptoFase: fase.IdpptoFase,
      id_empresa: ppto.id_empresa,
      CodCentroCto: ppto.CodCentroCto,
      id_centro_costo: ppto.id_centro_costo,
      CostoDirecto: monto,
      IdpptoFaseCategoria: this.modalCategoriaData.IdpptoFaseCategoria,
    };

    if (this.modalCategoriaModo() === 'edit' && this.modalCategoriaData.id) {
      this.presupuestosService.updateCategoriaAsignada(this.modalCategoriaData.id, payload).subscribe({
        next: () => {
          this.cerrarModalCategoria();
          this.recargarPresupuestoActivo();
        },
        error: (err) => alert('Error al actualizar categoría: ' + (err.error?.message || err.message)),
      });
    } else {
      if (!fase.IdPresupuestoDetalle) {
        alert('La fase seleccionada no tiene IdPresupuestoDetalle válido.');
        return;
      }
      this.presupuestosService.createCategoriaAsignada({
        ...payload,
        IdPresupuestoDetalleCategoria: `DFC-${Date.now()}`,
        IdPresupuestoDetalle: fase.IdPresupuestoDetalle,
      }).subscribe({
        next: () => {
          this.cerrarModalCategoria();
          this.recargarPresupuestoActivo();
        },
        error: (err) => alert('Error al crear categoría: ' + (err.error?.message || err.message)),
      });
    }
  }

  private openFasesForm(
    mode: 'new-fase' | 'new-categoria' | 'edit-fase' | 'edit-categoria',
    fase?: DetalleFase,
    categoria?: any,
  ) {
    const presupuesto = this.presupuestoActivo();
    if (!presupuesto) {
      alert('Seleccione primero un presupuesto.');
      return;
    }

    this.editingId.set(presupuesto.id ? String(presupuesto.id) : null);
    this.formData = { ...presupuesto };
    this.faseFormMode = mode;
    this.editingFaseAsignada = mode === 'edit-fase' ? fase ?? null : null;
    this.editingCategoriaAsignada = mode === 'edit-categoria' ? categoria ?? null : null;
    this.formFases.set([]);
    this.newFaseId = fase?.IdpptoFase || '';
    this.newFaseCategoriaId = categoria?.IdpptoFaseCategoria || '';
    this.newFaseSubtotal = Number(categoria?.CostoDirecto ?? categoria?.SubTotalCategoria ?? fase?.CostoDirecto ?? 0);
    this.categoriasFaseMaestra.set([]);
    if (this.selectedCC()) {
      this.cargarFasesPorCentroCosto(this.selectedCC());
    } else if (presupuesto.id_centro_costo) {
      this.presupuestosService.getFasesMaestras({ id_centro_costo: presupuesto.id_centro_costo }).subscribe({
        next: (res) => this.fasesMaestras.set(Array.isArray(res) ? res : res.data || []),
      });
    }
    if (this.newFaseId) this.onFaseMaestraChange();
    this.formStep.set(2);
    this.showForm.set(true);
  }

  guardarFaseCategoria() {
    if (!this.editingFaseAsignada && !this.editingCategoriaAsignada && (!this.editingId() || !this.presupuestoActivo())) {
      this.addFormFase();
      return;
    }
    const presupuesto = this.presupuestoActivo();
    const faseMaestra = this.fasesMaestras().find((item) => item.IdpptoFase === this.newFaseId);
    const categoriaMaestra = this.categoriasFaseMaestra().find((item) => item.IdpptoFaseCategoria === this.newFaseCategoriaId);
    const requiereCategoria = this.faseFormMode !== 'edit-fase';
    if (!presupuesto || !faseMaestra || (requiereCategoria && !categoriaMaestra)) {
      alert(requiereCategoria ? 'Seleccione una fase y su categoría.' : 'Seleccione una fase.');
      return;
    }

    const monto = Number(this.newFaseSubtotal) || 0;
    const contexto = {
      IdPresupuesto: String(presupuesto.IdPresupuesto),
      IdpptoFase: faseMaestra.IdpptoFase,
      id_empresa: presupuesto.id_empresa,
      CodCentroCto: presupuesto.CodCentroCto,
      id_centro_costo: presupuesto.id_centro_costo,
      CostoDirecto: monto,
    };

    if (this.faseFormMode === 'edit-fase' && this.editingFaseAsignada) {
      this.presupuestosService.updateFaseAsignada(this.editingFaseAsignada.id, contexto).subscribe({
        next: () => this.finalizarEdicionFaseCategoria(),
        error: (error) => alert('Error al actualizar fase: ' + (error.error?.message || error.message)),
      });
      return;
    }

    if (this.faseFormMode === 'edit-categoria' && this.editingCategoriaAsignada) {
      this.presupuestosService.updateCategoriaAsignada(this.editingCategoriaAsignada.id, {
        ...contexto,
        IdpptoFaseCategoria: categoriaMaestra.IdpptoFaseCategoria,
      }).subscribe({
        next: () => this.finalizarEdicionFaseCategoria(),
        error: (error) => alert('Error al actualizar categoría: ' + (error.error?.message || error.message)),
      });
      return;
    }

    if (this.faseFormMode === 'new-categoria') {
      const faseAsignada = this.selectedFase();
      if (!faseAsignada?.IdPresupuestoDetalle) {
        alert('Seleccione una fase válida para agregar la categoría.');
        return;
      }
      this.presupuestosService.createCategoriaAsignada({
        ...contexto,
        IdPresupuestoDetalleCategoria: `DFC-${Date.now()}`,
        IdPresupuestoDetalle: faseAsignada.IdPresupuestoDetalle,
        IdpptoFaseCategoria: categoriaMaestra.IdpptoFaseCategoria,
      }).subscribe({
        next: () => this.finalizarEdicionFaseCategoria(),
        error: (error) => alert('Error al crear categoría: ' + (error.error?.message || error.message)),
      });
      return;
    }

    const idDetalle = `DF-${Date.now()}`;
    this.presupuestosService.createFaseAsignada({ ...contexto, IdPresupuestoDetalle: idDetalle }).subscribe({
      next: () => this.presupuestosService.createCategoriaAsignada({
        ...contexto,
        IdPresupuestoDetalleCategoria: `DFC-${Date.now()}`,
        IdPresupuestoDetalle: idDetalle,
        IdpptoFaseCategoria: categoriaMaestra.IdpptoFaseCategoria,
      }).subscribe({
        next: () => this.finalizarEdicionFaseCategoria(),
        error: (error) => alert('La fase fue creada, pero no se pudo crear su categoría: ' + (error.error?.message || error.message)),
      }),
      error: (error) => alert('Error al crear fase: ' + (error.error?.message || error.message)),
    });
  }

  eliminarFase(fase: DetalleFase, event?: Event) {
    event?.stopPropagation();
    if (!confirm(`¿Eliminar la fase "${fase.NombreFase || fase.IdpptoFase}" y sus categorías?`)) return;
    this.presupuestosService.deleteFaseAsignada(fase.id).subscribe({
      next: () => this.recargarPresupuestoActivo(),
      error: (error) => alert('Error al eliminar fase: ' + (error.error?.message || error.message)),
    });
  }

  eliminarCategoria(categoria: any, event?: Event) {
    event?.stopPropagation();
    if (!confirm(`¿Eliminar la categoría "${categoria.CategoriaInsumo || categoria.IdpptoFaseCategoria}"?`)) return;
    this.presupuestosService.deleteCategoriaAsignada(categoria.id).subscribe({
      next: () => this.recargarPresupuestoActivo(),
      error: (error) => alert('Error al eliminar categoría: ' + (error.error?.message || error.message)),
    });
  }

  private finalizarEdicionFaseCategoria() {
    this.faseFormMode = 'new-fase';
    this.editingFaseAsignada = null;
    this.editingCategoriaAsignada = null;
    this.closeForm();
    this.recargarPresupuestoActivo();
  }

  private recargarPresupuestoActivo() {
    const presupuesto = this.presupuestoActivo();
    if (presupuesto?.id) this.cargarDetallePresupuesto(String(presupuesto.id));
  }

  cerrarNuevaCategoria() {
    this.showNuevaCategoria.set(false);
    this.nuevaCategoriaDescripcion = '';
  }

  guardarNuevaCategoria() {
    const descripcion = this.nuevaCategoriaDescripcion.trim();
    const idFase = this.faseActivaCodigo;
    if (!idFase || !descripcion) {
      alert('Ingrese la descripción de la categoría.');
      return;
    }

    const codigo = `CAT-${Date.now()}`;
    this.presupuestosService.createCategoriaFaseMaestra({
      IdpptoFaseCategoria: codigo,
      IdpptoFase: idFase,
      Descripcion: descripcion,
    }).subscribe({
      next: () => {
        this.cerrarNuevaCategoria();
        this.loadFasesMaestras();
      },
      error: (error) => alert('Error al crear categoría: ' + (error.error?.message || error.message)),
    });
  }

    onFaseMaestraChange(preserveCategoriaId?: string) {
    if (!preserveCategoriaId) {
      this.newFaseCategoriaId = '';
    }
    this.categoriasFaseMaestra.set([]);
    if (!this.newFaseId) return;

    this.presupuestosService.getCategoriasDeFase(this.newFaseId).subscribe({
      next: (response: any) => {
        let list: any[] = Array.isArray(response) ? response : (response?.data || response?.value || []);
        if (preserveCategoriaId && !list.some((item) => String(item.IdpptoFaseCategoria) === String(preserveCategoriaId))) {
          if (this.editingCategoriaAsignada) {
            list = [{
              IdpptoFaseCategoria: this.editingCategoriaAsignada.IdpptoFaseCategoria,
              Descripcion: this.editingCategoriaAsignada.CategoriaInsumo || this.editingCategoriaAsignada.Descripcion || this.editingCategoriaAsignada.IdpptoFaseCategoria,
              id: this.editingCategoriaAsignada.id
            }, ...list];
          }
        }
        this.categoriasFaseMaestra.set(list);
        if (preserveCategoriaId) {
          this.newFaseCategoriaId = preserveCategoriaId;
        }
      },
      error: () => {
        if (preserveCategoriaId && this.editingCategoriaAsignada) {
          this.categoriasFaseMaestra.set([{
            IdpptoFaseCategoria: this.editingCategoriaAsignada.IdpptoFaseCategoria,
            Descripcion: this.editingCategoriaAsignada.CategoriaInsumo || this.editingCategoriaAsignada.Descripcion,
            id: this.editingCategoriaAsignada.id
          }]);
          this.newFaseCategoriaId = preserveCategoriaId;
        }
      }
    });
  }

  cancelarEdicionFase() {
    this.faseFormMode = 'new-fase';
    this.editingFaseAsignada = null;
    this.editingCategoriaAsignada = null;
    this.newFaseId = '';
    this.newFaseCategoriaId = '';
    this.newFaseSubtotal = null;
    this.categoriasFaseMaestra.set([]);
    this.closeForm();
  }

  removeFormFase(index: number) {
    this.formFases.update(items => items.filter((_, i) => i !== index));
  }

  openNewPresupuestoForm(centroCosto?: CentroCosto) {
    this.editingId.set(null);
    this.formData = this.emptyForm();
    this.formStep.set(1);

    this.formData.Estado = 'PENDIENTE';

    // Reset completo de todas las signals (formulario en blanco para crear)
    this.formFases.set([]);
    this.pctGG.set(0);
    this.pctUtilidad.set(0);
    this.viaticos.set(0);
    this.descuento.set(0);
    this.comentarios.set('');
    this.filePresupuestoName.set(null);
    this.filePresupuestoInfo.set(null);
    this.fileOCName.set(null);
    this.fileOCInfo.set(null);

    if (centroCosto) {
      this.onCentroCostoFormChange(centroCosto);
    } else {
      this.selectedCC.set(null);
    }

    this.showForm.set(true);
  }

  compareCentrosCostos = (c1: any, c2: any): boolean => {
    if (!c1 || !c2) return c1 === c2;
    const id1 = c1.id ?? c1.id_centro_costo;
    const id2 = c2.id ?? c2.id_centro_costo;
    if (id1 != null && id2 != null && Number(id1) === Number(id2)) return true;
    const cod1 = c1.CodCentroCto;
    const cod2 = c2.CodCentroCto;
    if (cod1 && cod2 && cod1 === cod2) return true;
    return false;
  };

  get centrosCostosFormulario(): CentroCosto[] {
    const empresaId = this.formData.id_empresa;
    let list = this.centrosCostos();
    if (empresaId != null) {
      list = list.filter((centroCosto) => Number(centroCosto.id_empresa) === Number(empresaId));
    }
    const current = this.selectedCC();
    if (current) {
      const currentId = current.id ?? current.id_centro_costo;
      const exists = list.some(cc =>
        (currentId != null && (cc.id ?? cc.id_centro_costo) === currentId) ||
        (current.CodCentroCto && cc.CodCentroCto === current.CodCentroCto)
      );
      if (!exists) {
        list = [current, ...list];
      }
    }
    return list;
  }

  onCentroCostoFormChange(centroCosto: CentroCosto | null) {
    this.selectedCC.set(centroCosto);
    this.cargarFasesPorCentroCosto(centroCosto);

    if (!centroCosto) {
      this.formData.id_centro_costo = undefined;
      this.formData.CodCentroCto = '';
      return;
    }

    this.formData = {
      ...this.formData,
      Proyecto: centroCosto.CentroCosto || '',
      CodCentroCto: centroCosto.CodCentroCto || '',
      id_centro_costo: centroCosto.id ?? centroCosto.id_centro_costo,
      Cliente: centroCosto.Cliente || centroCosto.CodCliente || '',
      Concepto: this.formData.Concepto || 'PPTO CONTRACTUAL',
      periodo: centroCosto.periodo != null
        ? String(centroCosto.periodo)
        : (centroCosto.IdPeriodo || ''),
      IdPeriodo: centroCosto.periodo != null
        ? String(centroCosto.periodo)
        : (centroCosto.IdPeriodo || ''),
      id_empresa: centroCosto.id_empresa,
      CodEmpresa: centroCosto.CodEmpresa || centroCosto.Empresa || '',
    };
  }

  onEmpresaFormularioChange() {
    this.onCentroCostoFormChange(null);
  }

  // ── File: Archivo de Presupuesto ──────────────────────────────
  onFilePresupuestoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.filePresupuestoName.set(file.name);
      const kb = (file.size / 1024).toFixed(1);
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const size = file.size > 1024 * 1024 ? mb + ' MB' : kb + ' KB';
      const date = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
      this.filePresupuestoInfo.set(size + ' · ' + date);
    }
  }

  onFilePresupuestoDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.filePresupuestoName.set(file.name);
      const kb = (file.size / 1024).toFixed(1);
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const size = file.size > 1024 * 1024 ? mb + ' MB' : kb + ' KB';
      const date = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
      this.filePresupuestoInfo.set(size + ' · ' + date);
    }
  }

  removeFilePresupuesto(event: Event): void {
    event.stopPropagation();
    this.filePresupuestoName.set(null);
    this.filePresupuestoInfo.set(null);
  }

  // ── File: Orden de Compra ──────────────────────────────────────
  onFileOCSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.fileOCName.set(file.name);
      const kb = (file.size / 1024).toFixed(1);
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const size = file.size > 1024 * 1024 ? mb + ' MB' : kb + ' KB';
      const date = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
      this.fileOCInfo.set(size + ' · ' + date);
    }
  }

  onFileOCDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.fileOCName.set(file.name);
      const kb = (file.size / 1024).toFixed(1);
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const size = file.size > 1024 * 1024 ? mb + ' MB' : kb + ' KB';
      const date = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
      this.fileOCInfo.set(size + ' · ' + date);
    }
  }

  removeFileOC(event: Event): void {
    event.stopPropagation();
    this.fileOCName.set(null);
    this.fileOCInfo.set(null);
  }

  closeForm() {
    this.showForm.set(false);
  }

  savePresupuestoCompleto() {
    if (this.editingId() && !String(this.formData.IdPresupuesto ?? '').trim()) {
      alert('El ID de Presupuesto es obligatorio.');
      this.formStep.set(1);
      return;
    }
    if (!this.formData.Proyecto?.trim()) {
      alert('El nombre del Proyecto / Obra es obligatorio.');
      this.formStep.set(1);
      return;
    }

    const payload: Partial<PresupuestoPrincipal> = {
      ...this.formData,
      CostoDirecto: this.formCostoDirecto,
      GGPorcentaje: this.pctGG(),
      GastosGenerales: this.formMontoGG,
      UtiliPorcentaje: this.pctUtilidad(),
      Utilidad: this.formMontoUtilidad,
      Viaticos: this.viaticos(),
      DsctoComercial: this.descuento(),
      SubTotalSinIGV: this.formSubtotal,
      IGV: this.formIGV,
      Total: this.formTotalGeneral,
      Comentarios: this.comentarios()
    };
    if (!this.editingId() && !String(payload.IdPresupuesto ?? '').trim()) {
      delete payload.IdPresupuesto;
    }

    this.loading.set(true);
    const id = this.editingId();
    if (id) {
      this.presupuestosService.updatePresupuesto(id, payload).subscribe({
        next: () => {
          this.loading.set(false);
          this.closeForm();
          alert(`✅ Presupuesto ${payload.IdPresupuesto} actualizado con éxito.`);
          this.loadCentrosCostos();
        },
        error: (err) => {
          this.loading.set(false);
          alert('Error al actualizar presupuesto: ' + (err.error?.message || err.message));
        }
      });
    } else {
      this.presupuestosService.createPresupuesto(payload).subscribe({
        next: (created: any) => {
          this.loading.set(false);
          this.closeForm();
          const pptoCode = created?.IdPresupuesto || payload.IdPresupuesto || '';

          const fasesAGuardar = [...this.formFases()];
          if (fasesAGuardar.length > 0) {
            fasesAGuardar.forEach((item, index) => {
              const idDetalle = `DF-${Date.now()}-${index}`;
              const faseData = {
                IdPresupuesto: pptoCode,
                IdpptoFase: item.idFase,
                IdPresupuestoDetalle: idDetalle,
                id_empresa: created.id_empresa ?? payload.id_empresa,
                CodCentroCto: created.CodCentroCto ?? payload.CodCentroCto,
                id_centro_costo: created.id_centro_costo ?? payload.id_centro_costo,
                CostoDirecto: item.subtotal
              };
              this.presupuestosService.createFaseAsignada(faseData).subscribe({
                next: () => {
                  this.presupuestosService.createCategoriaAsignada({
                    ...faseData,
                    IdPresupuestoDetalleCategoria: `DFC-${Date.now()}-${index}`,
                    IdpptoFaseCategoria: item.idCategoria,
                    SubTotalCategoria: item.subtotal
                  }).subscribe();
                }
              });
            });
          }

          alert(`Presupuesto ${pptoCode} guardado y emitido con éxito.`);
          this.loadCentrosCostos();
        },
        error: (err) => {
          this.loading.set(false);
          alert('Error al crear presupuesto: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  // Modal y formulario (legacy, se mantendrá para la funcionalidad anterior)
  showModal = signal<boolean>(false);
  editingId = signal<string | null>(null);
  formData: Partial<PresupuestoPrincipal> = this.emptyForm();

  presupuestosDelCC = signal<PresupuestoPrincipal[]>([]);
  selectedPresupuestoId = signal<string | null>(null);

  // Paginación (legacy)
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalRecords = signal<number>(0);

  constructor() {}

  ngOnInit() {
    this.loadCatalogos();
    this.loadEmpresas();
    this.loadFasesMaestras();
    this.loadCentrosCostos();

    const navigationState = this.router.getCurrentNavigation()?.extras.state ?? history.state;
    const fromCC = navigationState?.['fromCC'] as CentroCosto | undefined;
    if (fromCC) {
      this.openNewPresupuestoForm(fromCC);
    }
  }

  loadCatalogos() {
    this.centrosCostosService.getCatalogosFiltros().subscribe({
      next: (cat) => this.catalogos.set(cat),
      error: (e) => console.error('Error al cargar catálogos', e)
    });
  }

  loadEmpresas() {
    this.empresasService.getAll().subscribe({
      next: (empresas) => this.empresas.set(empresas),
      error: (error) => console.error('Error al cargar empresas', error),
    });
  }

    cargarFasesPorCentroCosto(cc: CentroCosto | null) {
    if (!cc) {
      this.fasesMaestras.set([]);
      this.categoriasFaseMaestra.set([]);
      return;
    }
    const ccId = cc.id ?? (cc as any).id_centro_costo;
    const ccpId = (cc as any).id_centro_costos_principal;
    this.presupuestosService.getFasesMaestras({
      id_centro_costo: ccId,
      id_centro_costos_principal: ccpId,
    }).subscribe({
      next: (response) => {
        const list = Array.isArray(response) ? response : (response?.data || []);
        this.fasesMaestras.set(list);
      },
      error: (error) => {
        console.error('Error al cargar fases maestras por centro de costo', error);
        this.fasesMaestras.set([]);
      },
    });
  }

  loadFasesMaestras() {
    if (this.selectedCC()) {
      this.cargarFasesPorCentroCosto(this.selectedCC());
    } else {
      this.presupuestosService.getFasesMaestras().subscribe({
        next: (response) => this.fasesMaestras.set(Array.isArray(response) ? response : response.data || []),
        error: (error) => console.error('Error al cargar fases maestras', error),
      });
    }
  }

  limpiarFiltros() {
    this.filterSearch = '';
    this.filterEmpresa = '';
    this.filterPeriodo = '';
    this.filterCliente = '';
    this.filterEstado = '';
    this.filterCategoria = 'Todos';
    this.statusPillFilter.set('');
  }

  emptyForm(): Partial<PresupuestoPrincipal> {
    return {
      IdPresupuesto: '',
      Proyecto: '',
      Cliente: '',
      Concepto: '',
      CodEmpresa: '',
      CodCentroCto: '',
      IdPeriodo: '',
      id_empresa: undefined,
      id_centro_costo: undefined,
      periodo: '',
      TipoPpto: 'OBRA',
      CostoDirecto: 0,
      GGPorcentaje: 0,
      UtiliPorcentaje: 0,
      Viaticos: 0,
      DsctoComercial: 0,
      Estado: 'PENDIENTE',
      Comentarios: ''
    };
  }

  // ==========================================
  // NUEVO FLUJO DE DATOS (Layout Dashboard)
  // ==========================================

  loadCentrosCostos() {
    this.loading.set(true);
    // Cargamos todos los centros de costos (hasta 1500) para mostrar la lista completa
    this.centrosCostosService.getAll(1, 1500).subscribe({
      next: (res) => {
        const list = res.data || [];
        this.centrosCostos.set(list);
        this.loading.set(false);
        if (this.selectedCC()) {
          const current = this.selectedCC()!;
          const currentId = current.id ?? current.id_centro_costo;
          const matched = list.find((c: any) =>
            (currentId != null && (c.id === currentId || c.id_centro_costo === currentId)) ||
            (current.CodCentroCto && c.CodCentroCto === current.CodCentroCto)
          );
          if (matched) {
            this.selectedCC.set(matched);
            if (this.showForm()) {
              this.onCentroCostoFormChange(matched);
            }
          }
        } else if (list.length > 0) {
          // Buscamos el primer presupuesto existente para auto-seleccionar un CC que tenga presupuesto y fases reales
          this.presupuestosService.getPresupuestos(1, 10).subscribe({
            next: (pRes) => {
              let pptos: PresupuestoPrincipal[] = [];
              if ('data' in pRes && pRes.data.length > 0) pptos = pRes.data;
              else if (Array.isArray(pRes) && pRes.length > 0) pptos = pRes;

              const pptoConCC = pptos.find(p => p.id_centro_costo != null);
              if (pptoConCC) {
                const targetCC = list.find(c => (c.id ?? c.id_centro_costo) === pptoConCC.id_centro_costo);
                if (targetCC) {
                  this.onSelectCC(targetCC);
                  return;
                }
              }
              const fallback = list.find(c => Number(c.PresupuestoMonto) > 0 || c.PresupuestoEstado === 'Aprobado') || list[0];
              this.onSelectCC(fallback);
            },
            error: () => {
              const fallback = list.find(c => Number(c.PresupuestoMonto) > 0 || c.PresupuestoEstado === 'Aprobado') || list[0];
              this.onSelectCC(fallback);
            }
          });
        }
      },
      error: (err) => {
        console.error('Error al cargar centros de costo:', err);
        this.loading.set(false);
      }
    });
  }

  onSelectCC(cc: CentroCosto) {
    this.selectedCC.set(cc);
    this.cargarFasesPorCentroCosto(cc);
    this.presupuestoActivo.set(null);
    this.selectedFase.set(null);
    this.presupuestosDelCC.set([]);
    this.selectedPresupuestoId.set(null);
    this.loading.set(true);

    const ccNumericId = cc.id ?? cc.id_centro_costo;
    // Buscar todos los presupuestos asignados a este Centro de Costos por su id_centro_costo
    this.presupuestosService.getPresupuestos(1, 100, '', undefined, ccNumericId).subscribe({
      next: (res) => {
        let pptos: PresupuestoPrincipal[] = [];
        if ('data' in res && res.data.length > 0) pptos = res.data;
        else if (Array.isArray(res) && res.length > 0) pptos = res;

        this.presupuestosDelCC.set(pptos);

        if (pptos.length > 0) {
          const pptoId = pptos[0].IdPresupuesto || pptos[0].id;
          this.selectedPresupuestoId.set(String(pptoId));
          this.cargarDetallePresupuesto(String(pptoId));
        } else {
          this.loading.set(false);
        }
      },
      error: (err) => {
        console.error('Error al buscar presupuesto por CC:', err);
        this.loading.set(false);
      }
    });
  }

  cargarDetallePresupuesto(id: string) {
    this.loading.set(true);
    this.presupuestosService.getPresupuestoCompleto(id).subscribe({
      next: (completo) => {
        this.presupuestoActivo.set(completo);
        if (completo.fases && completo.fases.length > 0) {
          this.selectedFase.set(completo.fases[0]);
        } else {
          this.selectedFase.set(null);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar detalle del presupuesto:', err);
        this.loading.set(false);
      }
    });
  }

  onSelectPresupuestoId(id: string) {
    this.selectedPresupuestoId.set(id);
    this.presupuestoActivo.set(null);
    this.selectedFase.set(null);
    this.cargarDetallePresupuesto(id);
  }

  // ==========================================
  // GETTERS PARA UI
  // ==========================================

  get totalCCs() {
    return this.centrosCostosFiltrados.length;
  }

  get totalPortafolio() {
    return this.centrosCostosFiltrados.reduce((acc, cc) => {
      const monto = Number(cc.PresupuestoMonto) || 0;
      return acc + monto;
    }, 0);
  }

  get conteoEstados() {
    const ccs = this.centrosCostosFiltrados;
    const abiertas = ccs.filter(c => {
      const e = (c.PresupuestoEstado || c.Estado || '').toUpperCase();
      return e === 'ABIERTO' || e === 'ACTIVO';
    }).length;
    const enCierre = ccs.filter(c => (c.PresupuestoEstado || c.Estado || '').toUpperCase() === 'EN CIERRE').length;
    const cerradas = ccs.filter(c => (c.PresupuestoEstado || c.Estado || '').toUpperCase() === 'CERRADO').length;
    return { abiertas, enCierre, cerradas };
  }

  get statsFase() {
    const p = this.presupuestoActivo();
    const f = this.selectedFase();
    if (!p) return null;

    const cdTotal = Number(p.CostoDirecto) || 0;
    const cdFase = f ? (Number(f.CostoDirecto) || 0) : cdTotal;
    const ggPorcentaje = Number(p.GGPorcentaje) || 0;
    const utilPorcentaje = Number(p.UtiliPorcentaje) || 0;
    
    // Si la BD trae los totales ya calculados, usarlos, si no, calcular:
    const gg = Number(p.GastosGenerales) || (cdTotal * ggPorcentaje / 100);
    const util = Number(p.Utilidad) || (cdTotal * utilPorcentaje / 100);
    const total = Number(p.Total) || (cdTotal + gg + util);
    
    return {
      cd: cdFase,
      cdTotal,
      ggPorcentaje,
      utilPorcentaje,
      gg,
      util,
      total
    };
  }

  get totalPartidas() {
    const f = this.selectedFase();
    return f?.categorias?.length || 0;
  }

  get totalNaturalezas() {
    const f = this.selectedFase();
    if (!f || !f.categorias) return 0;
    const nats = new Set(f.categorias.map(c => c.CategoriaInsumo || ''));
    return nats.size;
  }

  onSelectFase(fase: DetalleFase) {
    this.selectedFase.set(fase);
  }

  badgeClass(estado: string | undefined): string {
    const st = (estado || '').toUpperCase();
    if (st === 'ABIERTO' || st === 'ACTIVO') {
      return 'bg-[#529b7b]/20 text-[#1e4838] border-[#529b7b]/40';
    } else if (st === 'EN CIERRE') {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (st === 'CERRADO') {
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }

  // ==========================================
  // FUNCIONALIDAD LEGACY (Modal y Tabla Clásica)
  // ==========================================

  loadData() {
    this.loading.set(true);

    this.presupuestosService.getPresupuestos(
      this.currentPage(),
      this.pageSize(),
      this.search()
    ).subscribe({
      next: (res) => {
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar presupuestos:', err);
        this.loading.set(false);
      }
    });
  }

  onSearch() {
    this.search.set(this.searchInput);
    this.currentPage.set(1);
    this.loadData();
  }

  clearSearch() {
    this.searchInput = '';
    this.search.set('');
    this.currentPage.set(1);
    this.loadData();
  }

  goToPage(page: number) {
    this.currentPage.set(page);
    this.loadData();
  }

  onPageSizeChange(newSize: any) {
    this.pageSize.set(Number(newSize));
    this.currentPage.set(1);
    this.loadData();
  }


  openModal() {
    this.editingId.set(null);
    this.formData = this.emptyForm();
    // Pre-rellenar con el CC activo si hay uno seleccionado
    if (this.selectedCC()) {
      const cc = this.selectedCC()!;
      this.formData.CodCentroCto = cc.CodCentroCto;
      this.formData.CodEmpresa = cc.CodEmpresa;
      this.formData.IdPeriodo = cc.IdPeriodo;
      this.formData.id_centro_costo = cc.id ?? cc.id_centro_costo;
      this.formData.id_empresa = cc.id_empresa;
      this.formData.periodo = String(cc.periodo ?? cc.IdPeriodo ?? '');
    }
    this.showModal.set(true);
  }

  editModal(item: PresupuestoPrincipal) {
    this.editingId.set(String(item.IdPresupuesto));
    this.formData = { ...item };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
  }

  save() {
    if (this.editingId() && !this.formData.IdPresupuesto) {
      alert('El ID de Presupuesto es obligatorio.');
      return;
    }

    const payload = { ...this.formData };
    if (!this.editingId() && !String(payload.IdPresupuesto ?? '').trim()) {
      delete payload.IdPresupuesto;
    }

    const id = this.editingId();
    if (id) {
      this.presupuestosService.updatePresupuesto(id, payload).subscribe({
        next: () => { this.closeModal(); if (this.selectedCC()) this.onSelectCC(this.selectedCC()!); else this.loadData(); },
        error: (err) => alert('Error al actualizar: ' + (err.error?.message || err.message))
      });
    } else {
      this.presupuestosService.createPresupuesto(payload).subscribe({
        next: () => { this.closeModal(); if (this.selectedCC()) this.onSelectCC(this.selectedCC()!); else this.loadData(); },
        error: (err) => alert('Error al crear: ' + (err.error?.message || err.message))
      });
    }
  }

  delete(id: string | number) {
    const idStr = String(id);
    if (confirm(`¿Eliminar el Presupuesto "${idStr}"? Esta acción no se puede deshacer.`)) {
      this.presupuestosService.deletePresupuesto(idStr).subscribe({
        next: () => { if (this.selectedCC()) this.onSelectCC(this.selectedCC()!); else this.loadData(); },
        error: (err) => alert('Error al eliminar: ' + (err.error?.message || err.message))
      });
    }
  }
}
