import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../shared/components/modal/modal';

import { PresupuestosService } from './presupuestos.service';
import { PresupuestoPrincipal, PaginatedResponse, DetalleFase, PresupuestoCompleto } from './interfaces';
import { CentrosCostosService } from '../centros-costos/centros-costos.service';
import { CentroCosto, CatalogosFiltros } from '../centros-costos/interfaces/centros-costos.interface';

@Component({
  selector: 'app-presupuestos',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './presupuestos.html',
  styleUrls: ['./presupuestos.css']
})
export class PresupuestosComponent implements OnInit {
  private presupuestosService = inject(PresupuestosService);
  private centrosCostosService = inject(CentrosCostosService);

  // Estado general
  loading = signal<boolean>(false);
  search = signal<string>('');
  searchInput = '';

  // Filtros — propiedades planas para compatibilidad con [(ngModel)]
  catalogos = signal<CatalogosFiltros | null>(null);
  filterSearch = '';
  filterEmpresa = '';
  filterPeriodo = '';
  filterCliente = '';
  filterEstado = '';
  filterCategoria = 'Todos'; // 'Todos' | 'Materiales' | 'Mano de Obra' | 'Equipos & Subc.'

  // Estado del layout Maestro-Detalle Múltiple
  centrosCostos = signal<CentroCosto[]>([]);

  // Getters en vez de computed() — se recalculan con el change detection normal de Angular
  get centrosCostosFiltrados(): CentroCosto[] {
    let list = this.centrosCostos();
    const s = (this.filterSearch || '').toLowerCase();
    const emp = this.filterEmpresa;
    const per = this.filterPeriodo;
    const cli = this.filterCliente;
    const est = this.filterEstado;

    if (s) {
      list = list.filter(cc =>
        (cc.CodCentroCto && cc.CodCentroCto.toLowerCase().includes(s)) ||
        (cc.CentroCosto && cc.CentroCosto.toLowerCase().includes(s))
      );
    }
    if (emp) list = list.filter(cc => cc.CodEmpresa === emp || cc.Empresa === emp);
    if (per) list = list.filter(cc => cc.IdPeriodo === per);
    if (cli) list = list.filter(cc => cc.CodCliente === cli || cc.Cliente === cli);
    if (est) list = list.filter(cc => (cc.PresupuestoEstado || cc.Estado) === est);

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
  formFases = signal<{ id?: number; nombre: string; categoria: string; subtotal: number }[]>([
    { nombre: '01. Movimiento de Tierras & Excavaciones', categoria: 'Maquinaria y Equipos', subtotal: 48500 },
    { nombre: '02. Obras de Concreto Armado (Cimentaciones)', categoria: 'Materiales & Acero', subtotal: 124000 },
    { nombre: '03. Albañilería y Muros de Contención', categoria: 'Mano de Obra Calificada', subtotal: 62000 },
    { nombre: '04. Instalaciones Sanitarias & Redes de Desagüe', categoria: 'Subcontratos Especiales', subtotal: 50000 }
  ]);

  // Quick Add para Fases
  newFaseNombre = '';
  newFaseCategoria = '';
  newFaseSubtotal: number | null = null;

  // Parámetros Financieros para Paso 3
  pctGG = signal<number>(10.00);
  pctUtilidad = signal<number>(8.00);
  viaticos = signal<number>(5000.00);
  descuento = signal<number>(0.00);

  // Archivos para Paso 4
  filePresupuestoName = signal<string>('PPTO_Paracas_Rev1.xlsx');
  filePresupuestoInfo = signal<string>('2.4 MB • 08 Sep 2026');
  fileOCName = signal<string | null>(null);

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
    if (!this.newFaseNombre.trim()) {
      alert('Por favor ingrese el nombre de la fase o tarea.');
      return;
    }
    const monto = Number(this.newFaseSubtotal) || 0;
    this.formFases.update(items => [
      ...items,
      {
        nombre: this.newFaseNombre.trim(),
        categoria: this.newFaseCategoria || 'General',
        subtotal: monto
      }
    ]);
    this.newFaseNombre = '';
    this.newFaseCategoria = '';
    this.newFaseSubtotal = null;
  }

  removeFormFase(index: number) {
    this.formFases.update(items => items.filter((_, i) => i !== index));
  }

  openNewPresupuestoForm() {
    this.editingId.set(null);
    this.formData = this.emptyForm();
    this.formStep.set(1);

    const anio = new Date().getFullYear();
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    this.formData.IdPresupuesto = `PPTO-${anio}-${randomSuffix}`;
    this.formData.Proyecto = '';
    this.formData.periodo = String(anio);
    this.formData.TipoPpto = 'Principal';
    this.formData.Estado = 'PENDIENTE';

    if (this.selectedCC()) {
      const cc = this.selectedCC()!;
      this.formData.CodCentroCto = cc.CodCentroCto;
      this.formData.id_centro_costo = cc.id ?? cc.id_centro_costo;
      this.formData.id_empresa = cc.id_empresa;
      this.formData.CodEmpresa = cc.CodEmpresa;
      this.formData.Proyecto = cc.CentroCosto ? `Obra - ${cc.CentroCosto}` : '';
      if (cc.periodo) this.formData.periodo = String(cc.periodo);
    }

    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
  }

  savePresupuestoCompleto() {
    if (!String(this.formData.IdPresupuesto ?? '').trim()) {
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
        next: () => {
          this.loading.set(false);
          this.closeForm();
          alert(`✅ Presupuesto ${payload.IdPresupuesto} guardado y emitido con éxito.`);
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
    this.loadCentrosCostos();
  }

  loadCatalogos() {
    this.centrosCostosService.getCatalogosFiltros().subscribe({
      next: (cat) => this.catalogos.set(cat),
      error: (e) => console.error('Error al cargar catálogos', e)
    });
  }

  limpiarFiltros() {
    this.filterSearch = '';
    this.filterEmpresa = '';
    this.filterPeriodo = '';
    this.filterCliente = '';
    this.filterEstado = '';
  }

  emptyForm(): Partial<PresupuestoPrincipal> {
    return {
      IdPresupuesto: '',
      Proyecto: '',
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
        if (!this.selectedCC() && list.length > 0) {
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
    if (!this.formData.IdPresupuesto) {
      alert('El ID de Presupuesto es obligatorio.');
      return;
    }

    const id = this.editingId();
    if (id) {
      this.presupuestosService.updatePresupuesto(id, this.formData).subscribe({
        next: () => { this.closeModal(); if (this.selectedCC()) this.onSelectCC(this.selectedCC()!); else this.loadData(); },
        error: (err) => alert('Error al actualizar: ' + (err.error?.message || err.message))
      });
    } else {
      this.presupuestosService.createPresupuesto(this.formData).subscribe({
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
