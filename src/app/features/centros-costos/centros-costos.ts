import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Copy, X, Check, Lock, Calendar, CloudUpload, FileText, CircleCheck, Contact, Clock } from 'lucide-angular';

import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { ModalComponent } from '../../shared/components/modal/modal';
import { DataTable } from '../../shared/interfaces';
import { CentroCosto, CentroCostoPrincipal, CreateCentroCostoDto, CatalogosFiltros, FiltrosCentrosCostos } from './interfaces';
import { CentrosCostosService } from './centros-costos.service';
import { EmpresasService } from '../administration/empresas/empresas.service';
import { Empresa } from '../administration/empresas/interfaces';

@Component({
  selector: 'app-centros-costos',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, ModalComponent, LucideAngularModule],
  templateUrl: './centros-costos.html',
  styleUrl: './centros-costos.css'
})
export class CentrosCostosComponent {
  readonly ArrowLeft = ArrowLeft;
  readonly Copy = Copy;
  readonly X = X;
  readonly Check = Check;
  readonly Lock = Lock;
  readonly Calendar = Calendar;
  readonly CloudUpload = CloudUpload;
  readonly FileText = FileText;
  readonly CircleCheck = CircleCheck;
  readonly Contact = Contact;
  readonly Clock = Clock;

  private readonly router = inject(Router);

  columns: DataTable[] = [
    { label: 'ID', width: '75px', align: 'center' },
    { label: 'Centro de Costo' },
    { label: 'Empresa' },
    { label: 'Cliente' },
    { label: 'CC Principal' },
    { label: 'Fecha Inicio' },
    { label: 'Fin Programado' },
    { label: 'Estado' },
    { label: 'Ppto. Estado' },
    { label: 'Acciones', width: '220px' }
  ];
  private centrosCostosService = inject(CentrosCostosService);
  private empresasService = inject(EmpresasService);

  items = signal<CentroCosto[]>([]);
  loading = signal<boolean>(false);
  showModal = signal<boolean>(false);
  editingId = signal<number | string | null>(null);
  search = signal<string>('');
  catalogos = signal<CatalogosFiltros>({ empresas: [], clientes: [], periodos: [], estados: [], pptoEstados: [] });
  principales = signal<CentroCostoPrincipal[]>([]);
  empresas = signal<Empresa[]>([]);

  // Resumen financiero (solo en edición)
  resumen = signal<any>(null);
  resumenLoading = signal<boolean>(false);

  empresaFilter = signal<string>('');
  clienteFilter = signal<string>('');
  estadoFilter = signal<string>('');
  pptoEstadoFilter = signal<string>('');
  periodoFilter = signal<string>('');

  estadoOptions = ['ABIERTO', 'CERRADO', 'POR LIQUIDAR'];
  presupuestoEstadoOptions = [
    'EN DESARROLLO',
    'EN REVISION',
    'APROBADO',
  ];

  clientesList = [
    { id: 'CLI-001', nombre: 'SEDAPAL' },
    { id: '5ef24aa7', nombre: 'Cliente Retail SA' },
    { id: '34689840', nombre: 'Constructora del Norte' },
    { id: '626d2014', nombre: 'Inmobiliaria Central' },
    { id: '5fa9c9b0', nombre: 'Proyectos Urbanos' }
  ];

  onClienteChange() {
    const found = this.clientesList.find(c => c.id === this.formData.CodCliente);
    this.formData.Cliente = found ? found.nombre : '';
  }

  onPrincipalChange() {
    const idPrincipal = this.formData.id_centro_costos_principal;
    const found = this.principales().find(p => p.id === idPrincipal || p.id === Number(idPrincipal));
    if (found) {
      this.formData.id_centro_costos_principal = found.id;
      this.formData.CodCentroCtoPrincipal = found.centro_costo_principal;
      this.formData.CentroCostoPrincipal = found.descripcion;
      this.formData.id_empresa = found.id_empresa;
    } else {
      this.formData.id_centro_costos_principal = undefined;
      this.formData.CodCentroCtoPrincipal = '';
      this.formData.CentroCostoPrincipal = '';
    }
  }

  get principalesFiltrados(): CentroCostoPrincipal[] {
    const empresaId = this.formData.id_empresa;
    if (empresaId == null) return [];
    return this.principales().filter((principal) => principal.id_empresa === Number(empresaId));
  }

  onEmpresaChange() {
    this.formData.id_centro_costos_principal = undefined;
    this.formData.CodCentroCtoPrincipal = '';
    this.formData.CentroCostoPrincipal = '';
  }


  // Paginación
  currentPage = signal<number>(1);
  pageSize = signal<number>(20);
  totalRecords = signal<number>(0);

  formData: CentroCosto = this.emptyForm();

  activeFiltersCount = computed(() => {
    return [
      this.empresaFilter(),
      this.clienteFilter(),
      this.estadoFilter(),
      this.pptoEstadoFilter(),
      this.periodoFilter()
    ].filter((value) => !!value).length;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.totalRecords() / this.pageSize())));

  private searchDebounceTimer: any;

  constructor() {
    this.load();
    this.centrosCostosService.getCatalogosFiltros().subscribe({
      next: (data) => this.catalogos.set(data || { empresas: [], clientes: [], periodos: [], estados: [], pptoEstados: [] }),
      error: (err) => console.warn('Error al cargar catálogos:', err)
    });
    this.centrosCostosService.getPrincipales().subscribe({
      next: (data) => this.principales.set(data || []),
      error: (err) => console.warn('Error al cargar CC principales:', err)
    });
    this.empresasService.getAll().subscribe({
      next: (data) => this.empresas.set(data || []),
      error: (err) => console.warn('Error al cargar empresas:', err)
    });
  }

  emptyForm(): CentroCosto {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    return {
      id_centro_costos_principal: undefined,
      CodCentroCtoPrincipal: '',
      CentroCostoPrincipal: '',
      CentroCosto: '',
      Estado: 'ABIERTO',
      periodo: 2026,
      CodCliente: '',
      Cliente: '',
      PresupuestoEstado: 'PENDIENTE',
      PresupuestoCostoDirecto: 0,
      PresupuestoGastosGenerales: 0,
      PresupuestoViaticos: 0,
      PresupuestoMonto: 0,
      OCFile: '',
      FechaIncio: today,
      FechaFinProg: '',
      FechaFinReal: '',
    };
  }

  buildFiltros(): FiltrosCentrosCostos {
    return {
      search: this.search() || undefined,
      estado: this.estadoFilter() || undefined,
      empresa: this.empresaFilter() || undefined,
      periodo: this.periodoFilter() || undefined,
      cliente: this.clienteFilter() || undefined,
      pptoEstado: this.pptoEstadoFilter() || undefined,
    };
  }

  load() {
    this.loading.set(true);
    this.centrosCostosService.getAll(this.currentPage(), this.pageSize(), this.buildFiltros()).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.totalRecords.set(res.total);
        this.currentPage.set(res.page);
        this.loading.set(false);
      },
      error: (err) => { console.error(err); this.loading.set(false); }
    });
  }

  onSearch(value: string) {
    this.search.set(value);
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage.set(1);
      this.load();
    }, 350);
  }

  onFilterChange(filter: 'empresa' | 'cliente' | 'estado' | 'periodo' | 'pptoEstado', value: string) {
    const setter: Record<string, (v: string) => void> = {
      empresa: (v) => this.empresaFilter.set(v),
      cliente: (v) => this.clienteFilter.set(v),
      estado: (v) => this.estadoFilter.set(v),
      periodo: (v) => this.periodoFilter.set(v),
      pptoEstado: (v) => this.pptoEstadoFilter.set(v),
    };
    setter[filter](value);
    this.currentPage.set(1);
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load();
  }

  getCentroCostoPrincipalLabel(item: CentroCosto): string {
    const idPrincipal = item.idCentroCostosPrincipal ?? item.id_centro_costos_principal ?? item.id_centro_costo_principal;
    if (idPrincipal) {
      const principalById = this.principales().find(p => p.id === idPrincipal);
      if (principalById) {
        return principalById.descripcion;
      }
    }

    const principalCode = item.CodCentroCtoPrincipal || item.CentroCostoPrincipal;

    if (!principalCode) {
      return '—';
    }

    const principal = this.items().find((centro) => centro.CodCentroCto === principalCode);
    if (principal?.CentroCosto) {
      return principal.CentroCosto;
    }

    const principalFromList = this.principales().find(
      (p) => p.centro_costo_principal === principalCode || p.descripcion === principalCode
    );
    if (principalFromList?.descripcion) {
      return principalFromList.descripcion;
    }

    return item.CentroCostoPrincipal || item.CodCentroCtoPrincipal || '—';
  }

  resetFilters() {
    this.search.set('');
    this.empresaFilter.set('');
    this.clienteFilter.set('');
    this.estadoFilter.set('');
    this.pptoEstadoFilter.set('');
    this.periodoFilter.set('');
    this.currentPage.set(1);
    this.load();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.load();
    }
  }

  openModal() {
    this.editingId.set(null);
    this.formData = this.emptyForm();
    this.showModal.set(true);
  }

  editModal(item: CentroCosto) {
    const id = item.id ?? item.id_centro_costo ?? item.CodCentroCto;
    this.editingId.set(id);
    this.formData = {
      ...item,
      periodo: item.periodo ?? (item.IdPeriodo ? Number(item.IdPeriodo) : undefined),
      id_centro_costos_principal: item.idCentroCostosPrincipal ?? item.id_centro_costos_principal ?? item.id_centro_costo_principal,
    };

    if (!this.formData.id_centro_costos_principal && (this.formData.CodCentroCtoPrincipal || this.formData.CentroCostoPrincipal)) {
      const match = this.principales().find(
        p => p.centro_costo_principal === this.formData.CodCentroCtoPrincipal || p.descripcion === this.formData.CentroCostoPrincipal
      );
      if (match) {
        this.formData.id_centro_costos_principal = match.id;
      }
    }

    this.showModal.set(true);
    // Cargar resumen financiero al editar
    this.resumen.set(null);
    this.resumenLoading.set(true);
    this.centrosCostosService.getResumenFinanciero(id).subscribe({
      next: (data) => { this.resumen.set(data); this.resumenLoading.set(false); },
      error: () => { this.resumenLoading.set(false); }
    });
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
    this.resumen.set(null);
  }

  buildPayload(): CreateCentroCostoDto {
    const d = this.formData;
    return {
      periodo: Number(d.periodo),
      CodCliente: d.CodCliente,
      id_centro_costos_principal: d.id_centro_costos_principal as number,
      CentroCosto: d.CentroCosto,
      FechaIncio: d.FechaIncio ?? '',
      Estado: d.Estado,
      FechaFinProg: d.FechaFinProg,
      FechaFinReal: d.FechaFinReal,
      PresupuestoEstado: d.PresupuestoEstado,
      PresupuestoCostoDirecto: d.PresupuestoCostoDirecto,
      PresupuestoGastosGenerales: d.PresupuestoGastosGenerales,
      PresupuestoViaticos: d.PresupuestoViaticos,
      PresupuestoMonto: d.PresupuestoMonto ? Number(d.PresupuestoMonto) : undefined,
      OCFile: d.OCFile,
    };
  }

  save() {
    const obligatorios = [
      { campo: 'Periodo', ok: !!this.formData.periodo },
      { campo: 'Empresa', ok: !!this.formData.id_empresa },
      { campo: 'Cliente', ok: !!this.formData.CodCliente },
      { campo: 'Centro de Costo Principal', ok: !!this.formData.id_centro_costos_principal },
      { campo: 'Nombre del Centro de Costo', ok: !!this.formData.CentroCosto },
      { campo: 'Fecha de Inicio', ok: !!this.formData.FechaIncio }
    ];
    const faltantes = obligatorios.filter(o => !o.ok).map(o => o.campo);

    if (faltantes.length > 0) {
      alert('Campos obligatorios: ' + faltantes.join(', '));
      return;
    }

    const payload = this.buildPayload();
    const id = this.editingId();
    if (id !== null) {
      this.centrosCostosService.update(id, payload).subscribe({
        next: () => { this.closeModal(); this.load(); },
        error: (err) => alert('Error al actualizar: ' + (err.error?.message || err.message))
      });
    } else {
      this.centrosCostosService.create(payload).subscribe({
        next: () => { this.closeModal(); this.load(); },
        error: (err) => alert('Error al crear: ' + (err.error?.message || err.message))
      });
    }
  }

  setPeriodo(p: number) {
    this.formData.periodo = p;
  }

  onOCFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.formData.OCFile = input.files?.[0]?.name ?? '';
  }

  removeOCFile(event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.formData.OCFile = '';
    const fileInput = document.getElementById('cc-oc-file') as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  duplicar() {
    if (!this.formData.CentroCosto && !this.formData.id_centro_costos_principal) {
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    // Cambiar a modo creación (nuevo registro) manteniendo los datos clonados
    this.editingId.set(null);
    this.resumen.set(null);

    this.formData = {
      ...this.formData,
      id: undefined,
      id_centro_costo: undefined,
      CodCentroCto: undefined,
      CentroCosto: this.formData.CentroCosto ? `${this.formData.CentroCosto} (Copia)` : '',
      FechaIncio: this.formData.FechaIncio || today,
      FechaFinProg: '',
      FechaFinReal: '',
      OCFile: '',
      Estado: 'ABIERTO',
    };
  }

  descartar() {
    this.closeModal();
  }

  guardar() {
    this.save();
  }

  delete(item: CentroCosto) {
    const nombre = item.CentroCosto || item.CodCentroCto;
    const targetId = item.id ?? item.id_centro_costo ?? item.CodCentroCto;

    if (confirm(`¿Eliminar el Centro de Costo "${nombre}"? Esta acción no se puede deshacer.`)) {
      this.centrosCostosService.delete(targetId).subscribe({
        next: () => this.load(),
        error: (err) => alert('Error al eliminar: ' + (err.error?.message || err.message))
      });
    }
  }

  goToPresupuestos(item: CentroCosto) {
    this.router.navigate(['/presupuestos'], {
      state: { fromCC: item }
    }); 
  }

  onVerDatos(item: CentroCosto) {
    console.log('Datos del Centro de Costo:', item);
  }
}
