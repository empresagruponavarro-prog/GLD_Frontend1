import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { ModalComponent } from '../../shared/components/modal/modal';
import { DataTable } from '../../shared/interfaces';
import { PresupuestosService } from './presupuestos.service';
import { PresupuestoPrincipal, PaginatedResponse, DetalleFase, PresupuestoCompleto } from './interfaces';
import { CentrosCostosService } from '../centros-costos/centros-costos.service';
import { CentroCosto, CatalogosFiltros } from '../centros-costos/interfaces/centros-costos.interface';

@Component({
  selector: 'app-presupuestos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './presupuestos.html',
  styleUrls: ['./presupuestos.css']
})
export class PresupuestosComponent {
  private presupuestosService = inject(PresupuestosService);
  private centrosCostosService = inject(CentrosCostosService);

  // Estado general
  loading = signal<boolean>(false);
  search = signal<string>('');
  searchInput = '';

  // Filtros
  catalogos = signal<CatalogosFiltros | null>(null);
  filterSearch = signal<string>('');
  filterEmpresa = signal<string>('');
  filterPeriodo = signal<string>('');
  filterCliente = signal<string>('');
  filterEstado = signal<string>('');
  filterCategoria = signal<string>('Todos'); // 'Todos' | 'Materiales' | 'Mano de Obra' | 'Equipos & Subc.'

  // Estado del layout Maestro-Detalle Múltiple
  centrosCostos = signal<CentroCosto[]>([]);
  
  centrosCostosFiltrados = computed(() => {
    let list = this.centrosCostos();
    const s = this.filterSearch().toLowerCase();
    const emp = this.filterEmpresa();
    const per = this.filterPeriodo();
    const cli = this.filterCliente();
    const est = this.filterEstado();

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
  });

  selectedCC = signal<CentroCosto | null>(null);
  
  presupuestoActivo = signal<PresupuestoCompleto | null>(null);
  selectedFase = signal<DetalleFase | null>(null);

  categoriasFiltradas = computed(() => {
    const f = this.selectedFase();
    if (!f || !f.categorias) return [];
    const cat = this.filterCategoria();
    if (cat === 'Todos') return f.categorias;
    if (cat === 'Materiales') return f.categorias.filter(c => c.CategoriaInsumo === 'MATERIALES');
    if (cat === 'Mano de Obra') return f.categorias.filter(c => c.CategoriaInsumo === 'MANO DE OBRA');
    if (cat === 'Equipos & Subc.') return f.categorias.filter(c => c.CategoriaInsumo !== 'MATERIALES' && c.CategoriaInsumo !== 'MANO DE OBRA');
    return f.categorias;
  });

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
    this.filterSearch.set('');
    this.filterEmpresa.set('');
    this.filterPeriodo.set('');
    this.filterCliente.set('');
    this.filterEstado.set('');
  }

  emptyForm(): Partial<PresupuestoPrincipal> {
    return {
      IdPresupuesto: '',
      Proyecto: '',
      CodEmpresa: '',
      CodCentroCto: '',
      IdPeriodo: '',
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
    this.centrosCostosService.getAll().subscribe({
      next: (data) => {
        this.centrosCostos.set(data || []);
        this.loading.set(false);
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

    // Buscar todos los presupuestos por CodCentroCto (hasta 100)
    this.presupuestosService.getPresupuestos(1, 100, '', cc.CodCentroCto).subscribe({
      next: (res) => {
        let pptos: PresupuestoPrincipal[] = [];
        if ('data' in res && res.data.length > 0) pptos = res.data;
        else if (Array.isArray(res) && res.length > 0) pptos = res;

        this.presupuestosDelCC.set(pptos);

        if (pptos.length > 0) {
          this.selectedPresupuestoId.set(String(pptos[0].IdPresupuesto));
          this.cargarDetallePresupuesto(String(pptos[0].IdPresupuesto));
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
    return this.centrosCostosFiltrados().length;
  }

  get totalPortafolio() {
    return this.centrosCostosFiltrados().reduce((acc, cc) => {
      const monto = Number(cc.PresupuestoMonto) || 0;
      return acc + monto;
    }, 0);
  }

  get conteoEstados() {
    const ccs = this.centrosCostosFiltrados();
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
    if (!p) return null;

    const cd = Number(p.CostoDirecto) || 0;
    const ggPorcentaje = Number(p.GGPorcentaje) || 0;
    const utilPorcentaje = Number(p.UtiliPorcentaje) || 0;
    
    // Si la BD trae los totales ya calculados, usarlos, si no, calcular:
    const gg = Number(p.GastosGenerales) || (cd * ggPorcentaje / 100);
    const util = Number(p.Utilidad) || (cd * utilPorcentaje / 100);
    const total = Number(p.Total) || (cd + gg + util);
    
    return {
      cd,
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
        next: () => { this.closeModal(); this.loadData(); },
        error: (err) => alert('Error al actualizar: ' + (err.error?.message || err.message))
      });
    } else {
      this.presupuestosService.createPresupuesto(this.formData).subscribe({
        next: () => { this.closeModal(); this.loadData(); },
        error: (err) => alert('Error al crear: ' + (err.error?.message || err.message))
      });
    }
  }

  delete(id: string | number) {
    const idStr = String(id);
    if (confirm(`¿Eliminar el Presupuesto "${idStr}"? Esta acción no se puede deshacer.`)) {
      this.presupuestosService.deletePresupuesto(idStr).subscribe({
        next: () => this.loadData(),
        error: (err) => alert('Error al eliminar: ' + (err.error?.message || err.message))
      });
    }
  }
}
