import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { ExportarBotonesComponent } from '../../../shared/components/exportar-botones/exportar-botones';
import { ModalComponent } from '../../../shared/components/modal/modal';
import type { DatosExportacion } from '../../../shared/utils/exportar';
import { Empresa } from '../../administration/empresas/interfaces';
import { EmpresasService } from '../../administration/empresas/empresas.service';
import { CentrosCostosService } from '../../centros-costos/centros-costos.service';
import { CentroCostoSelect } from '../../centros-costos/interfaces/centros-costos.interface';
import { errorMessage } from '../../almacen/almacen.utils';
import {
  CreateLocalPayload,
  LocalItem,
  TipoAsignacionLocal,
  UbicacionItem,
  UpdateLocalPayload,
} from './locales.interface';
import { LocalesService } from './locales.service';
import { NivelItem, NivelesService } from './niveles.service';
import { AmbienteItem, AmbientesService } from './ambientes.service';
import { UbicacionesService } from './ubicaciones.service';
import { AreasService } from '../areas/areas.service';
import type { Area } from '../../requerimientos/requerimientos.models';

@Component({
  selector: 'app-locales',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, ExportarBotonesComponent],
  templateUrl: './locales.html',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalesComponent {
  private readonly localesService = inject(LocalesService);
  private readonly nivelesService = inject(NivelesService);
  private readonly ambientesService = inject(AmbientesService);
  private readonly ubicacionesService = inject(UbicacionesService);
  private readonly areasService = inject(AreasService);
  private readonly empresasService = inject(EmpresasService);
  private readonly centrosCostosService = inject(CentrosCostosService);

  protected readonly permisos = permisosDePantalla('maestros.generales');

  // Navegación por pestañas: Ubicaciones | Locales | Niveles | Ambientes | Selector
  protected readonly activeTab = signal<'ubicaciones' | 'locales' | 'niveles' | 'ambientes' | 'selector'>('ubicaciones');

  // ==================== 1. UBICACIONES CONSOLIDADAS (Solo lectura) ====================
  protected readonly ubicaciones = signal<UbicacionItem[]>([]);
  protected readonly busquedaUbicaciones = signal('');
  protected readonly isUbicacionesLoading = signal(false);

  protected readonly areas = signal<Area[]>([]);

  protected readonly ubicacionesFiltradas = computed(() => {
    const q = this.busquedaUbicaciones().trim().toLowerCase();
    return this.ubicaciones().filter((u) => {
      if (!q) return true;
      const enCodigo = u.codigo.toLowerCase().includes(q);
      const enLocal = (u.local_nombre ?? '').toLowerCase().includes(q) || (u.local_codigo ?? '').toLowerCase().includes(q);
      const enNivel = (u.nivel_descripcion ?? '').toLowerCase().includes(q) || (u.nivel_codigo ?? '').toLowerCase().includes(q);
      const enAmbiente = (u.ambiente_descripcion ?? '').toLowerCase().includes(q) || (u.ambiente_codigo ?? '').toLowerCase().includes(q);
      const enArea = (u.area_nombre ?? '').toLowerCase().includes(q);
      const enObs = (u.observaciones ?? '').toLowerCase().includes(q);
      return enCodigo || enLocal || enNivel || enAmbiente || enArea || enObs;
    });
  });

  protected readonly totalUbicaciones = computed(() => this.ubicacionesFiltradas().length);

  // ==================== 2. LOCALES (SEDES) ====================
  protected readonly items = signal<LocalItem[]>([]);
  protected readonly busqueda = signal('');
  protected readonly filtroTipo = signal<'TODOS' | 'EMPRESA' | 'CENTRO_COSTO'>('TODOS');
  protected readonly isLoading = signal(false);
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly editando = signal<LocalItem | null>(null);
  protected readonly tipoAsignacion = signal<TipoAsignacionLocal>('EMPRESA');

  protected readonly empresas = signal<Empresa[]>([]);
  protected readonly centrosCostos = signal<CentroCostoSelect[]>([]);

  protected readonly itemsFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const fTipo = this.filtroTipo();

    return this.items().filter((loc) => {
      const matchTipo = fTipo === 'TODOS' || loc.tipo_asignacion === fTipo;
      if (!matchTipo) return false;
      if (!q) return true;

      const enCodigo = loc.codigo.toLowerCase().includes(q);
      const enNombre = loc.nombre.toLowerCase().includes(q);
      const enDireccion = (loc.direccion ?? '').toLowerCase().includes(q);
      const enEmpresa = (loc.empresa_nombre ?? '').toLowerCase().includes(q);
      const enCC = `${loc.centro_costo_codigo ?? ''} ${loc.centro_costo_nombre ?? ''}`.toLowerCase().includes(q);

      return enCodigo || enNombre || enDireccion || enEmpresa || enCC;
    });
  });

  protected readonly totalRegistros = computed(() => this.itemsFiltrados().length);

  protected readonly form = new FormGroup({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9_-]{2,20}$/)],
    }),
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    direccion: new FormControl('', { nonNullable: true }),
    id_empresa: new FormControl<number | null>(null),
    id_centro_costo: new FormControl<number | null>(null),
    estado: new FormControl(true, { nonNullable: true }),
  });

  // ==================== 3. NIVELES ====================
  protected readonly niveles = signal<NivelItem[]>([]);
  protected readonly busquedaNiveles = signal('');
  protected readonly isNivelModalOpen = signal(false);
  protected readonly isNivelSaving = signal(false);
  protected readonly nivelModalError = signal('');
  protected readonly editandoNivel = signal<NivelItem | null>(null);

  protected readonly nivelesFiltrados = computed(() => {
    const q = this.busquedaNiveles().trim().toLowerCase();
    return this.niveles().filter((n) => {
      if (!q) return true;
      return n.codigo.toLowerCase().includes(q) || n.descripcion.toLowerCase().includes(q);
    });
  });

  protected readonly totalNiveles = computed(() => this.nivelesFiltrados().length);

  protected readonly nivelForm = new FormGroup({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9_-]{2,20}$/)],
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    estado: new FormControl(true, { nonNullable: true }),
  });

  // ==================== 4. AMBIENTES ====================
  protected readonly ambientes = signal<AmbienteItem[]>([]);
  protected readonly busquedaAmbientes = signal('');
  protected readonly isAmbienteModalOpen = signal(false);
  protected readonly isAmbienteSaving = signal(false);
  protected readonly ambienteModalError = signal('');
  protected readonly editandoAmbiente = signal<AmbienteItem | null>(null);

  protected readonly ambientesFiltrados = computed(() => {
    const q = this.busquedaAmbientes().trim().toLowerCase();
    return this.ambientes().filter((a) => {
      if (!q) return true;
      return a.codigo.toLowerCase().includes(q) || a.descripcion.toLowerCase().includes(q);
    });
  });

  protected readonly totalAmbientes = computed(() => this.ambientesFiltrados().length);

  protected readonly ambienteForm = new FormGroup({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9_-]{2,20}$/)],
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    estado: new FormControl(true, { nonNullable: true }),
  });

  // ==================== 5. SELECTOR REUSABLE EN CASCADA ====================
  protected readonly selectorLocal = signal<number | null>(null);
  protected readonly selectorNivel = signal<number | null>(null);
  protected readonly selectorAmbiente = signal<number | null>(null);
  protected readonly selectorResultado = signal<UbicacionItem | null>(null);
  protected readonly selectorBuscando = signal(false);
  protected readonly selectorNoEncontrado = signal(false);
  protected readonly selectorAreaGuardando = signal(false);
  protected readonly copiadoExito = signal(false);

  // Exportación
  protected readonly datosExportacion = computed<DatosExportacion>(() => {
    const tab = this.activeTab();
    if (tab === 'ubicaciones') {
      return {
        nombre: 'Ubicaciones_Fisicas_GLD',
        columnas: ['Código', 'Local / Sede', 'Pertenece a', 'Nivel', 'Ambiente', 'Área', 'Observaciones', 'Estado'],
        filas: this.ubicacionesFiltradas().map((u) => [
          u.codigo,
          u.local_nombre ?? '—',
          u.local_asignado_a
            ? `${u.local_tipo_asignacion === 'EMPRESA' ? 'Empresa' : 'Centro de Costo'}: ${u.local_asignado_a}`
            : '—',
          u.nivel_descripcion ?? '—',
          u.ambiente_descripcion ?? '—',
          u.area_nombre ?? '—',
          u.observaciones ?? '—',
          u.estado ? 'Activo' : 'Inactivo',
        ]),
      };
    }
    if (tab === 'niveles') {
      return {
        nombre: 'Niveles_GLD',
        columnas: ['Código', 'Descripción', 'Estado'],
        filas: this.nivelesFiltrados().map((n) => [n.codigo, n.descripcion, n.estado ? 'Activo' : 'Inactivo']),
      };
    }
    if (tab === 'ambientes') {
      return {
        nombre: 'Ambientes_GLD',
        columnas: ['Código', 'Descripción', 'Estado'],
        filas: this.ambientesFiltrados().map((a) => [a.codigo, a.descripcion, a.estado ? 'Activo' : 'Inactivo']),
      };
    }
    return {
      nombre: 'Locales_GLD',
      columnas: ['Código', 'Local / Sede', 'Dirección', 'Tipo Asignación', 'Asignado a', 'Estado'],
      filas: this.itemsFiltrados().map((l) => [
        l.codigo,
        l.nombre,
        l.direccion ?? '—',
        l.tipo_asignacion === 'EMPRESA' ? 'Empresa' : 'Centro de Costo',
        l.tipo_asignacion === 'EMPRESA'
          ? (l.empresa_nombre ?? '—')
          : `${l.centro_costo_codigo ?? ''} - ${l.centro_costo_nombre ?? ''}`,
        l.estado ? 'Activo' : 'Inactivo',
      ]),
    };
  });

  constructor() {
    this.loadCatalogos();
    this.loadUbicaciones();
    this.load();
    this.loadNiveles();
    this.loadAmbientes();
    this.loadAreas();
  }

  // ==================== CARGA DE DATOS ====================
  protected loadUbicaciones(): void {
    this.isUbicacionesLoading.set(true);
    this.ubicacionesService.getAll().subscribe({
      next: (data) => {
        this.ubicaciones.set(data);
        this.isUbicacionesLoading.set(false);
      },
      error: () => {
        this.ubicaciones.set([]);
        this.isUbicacionesLoading.set(false);
      },
    });
  }

  protected loadAreas(): void {
    this.areasService.getAll().subscribe({
      next: (data) => this.areas.set(data.filter((a) => a.estado)),
      error: () => this.areas.set([]),
    });
  }

  protected load(): void {
    this.isLoading.set(true);
    this.localesService.getAll().subscribe({
      next: (data) => {
        this.items.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.isLoading.set(false);
      },
    });
  }

  protected loadNiveles(): void {
    this.nivelesService.getAll().subscribe({
      next: (data) => this.niveles.set(data),
      error: () => this.niveles.set([]),
    });
  }

  protected loadAmbientes(): void {
    this.ambientesService.getAll().subscribe({
      next: (data) => this.ambientes.set(data),
      error: () => this.ambientes.set([]),
    });
  }

  private loadCatalogos(): void {
    this.empresasService.getAll().subscribe({
      next: (list) => this.empresas.set(list),
      error: () => this.empresas.set([]),
    });

    this.centrosCostosService.getSelect().subscribe({
      next: (list) => this.centrosCostos.set(list),
      error: () => this.centrosCostos.set([]),
    });
  }

  // ==================== INPUT SANITIZERS ====================
  protected onCodigoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = input.value.toUpperCase().replace(/\s+/g, '');
    this.form.controls.codigo.setValue(valor);
    input.value = valor;
  }

  protected onNivelCodigoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = input.value.toUpperCase().replace(/\s+/g, '');
    this.nivelForm.controls.codigo.setValue(valor);
    input.value = valor;
  }

  protected onAmbienteCodigoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = input.value.toUpperCase().replace(/\s+/g, '');
    this.ambienteForm.controls.codigo.setValue(valor);
    input.value = valor;
  }

  // ==================== 2. MÉTODOS SELECTOR EN CASCADA ====================
  protected onSelectorLocalChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectorLocal.set(val ? Number(val) : null);
    this.resolverSelector();
  }

  protected onSelectorNivelChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectorNivel.set(val ? Number(val) : null);
    this.resolverSelector();
  }

  protected onSelectorAmbienteChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectorAmbiente.set(val ? Number(val) : null);
    this.resolverSelector();
  }

  protected resolverSelector(): void {
    const locId = this.selectorLocal();
    const nivId = this.selectorNivel();
    const ambId = this.selectorAmbiente();

    if (!locId || !nivId || !ambId) {
      this.selectorResultado.set(null);
      this.selectorNoEncontrado.set(false);
      return;
    }

    this.selectorBuscando.set(true);
    this.ubicacionesService.resolver(locId, nivId, ambId).subscribe({
      next: (item) => {
        if (item) return this.mostrarResultadoSelector(item);

        // No existe: se registra solo si el usuario tiene permiso de crear; si no, solo se informa.
        if (!this.permisos.crear()) {
          this.selectorBuscando.set(false);
          this.selectorResultado.set(null);
          this.selectorNoEncontrado.set(true);
          return;
        }
        this.ubicacionesService.create({ id_local: locId, id_nivel: nivId, id_ambiente: ambId }).subscribe({
          next: (creada) => this.mostrarResultadoSelector(creada),
          error: () => {
            this.selectorBuscando.set(false);
            this.selectorResultado.set(null);
            this.selectorNoEncontrado.set(true);
          },
        });
      },
      error: () => {
        this.selectorBuscando.set(false);
        this.selectorResultado.set(null);
        this.selectorNoEncontrado.set(true);
      },
    });
  }

  private mostrarResultadoSelector(item: UbicacionItem): void {
    this.selectorBuscando.set(false);
    this.selectorResultado.set(item);
    this.selectorNoEncontrado.set(false);
    // Si no estaba en la lista local, recargar catálogo para mantenerlo sincronizado
    if (!this.ubicaciones().some((u) => u.id === item.id)) {
      this.loadUbicaciones();
    }
  }

  protected onSelectorAreaChange(event: Event): void {
    const actual = this.selectorResultado();
    if (!actual || !this.permisos.editar()) return;

    const select = event.target as HTMLSelectElement;
    const idArea = select.value ? Number(select.value) : null;

    this.selectorAreaGuardando.set(true);
    this.ubicacionesService.update(actual.id, { id_area: idArea }).subscribe({
      next: (item) => {
        this.selectorAreaGuardando.set(false);
        this.selectorResultado.set(item);
        this.loadUbicaciones();
      },
      error: (err: unknown) => {
        this.selectorAreaGuardando.set(false);
        select.value = String(actual.id_area ?? '');
        alert(errorMessage(err));
      },
    });
  }

  protected copiarCodigo(codigo: string): void {
    navigator.clipboard.writeText(codigo);
    this.copiadoExito.set(true);
    setTimeout(() => this.copiadoExito.set(false), 2000);
  }

  // ==================== 3. MÉTODOS LOCALES ====================
  protected setTipoAsignacion(tipo: TipoAsignacionLocal): void {
    this.tipoAsignacion.set(tipo);
    if (tipo === 'EMPRESA') {
      this.form.controls.id_centro_costo.setValue(null);
    } else {
      this.form.controls.id_empresa.setValue(null);
    }
  }

  protected nuevo(): void {
    if (!this.permisos.crear()) return;
    this.editando.set(null);
    this.modalError.set('');
    this.tipoAsignacion.set('EMPRESA');
    this.form.reset({
      codigo: '',
      nombre: '',
      direccion: '',
      id_empresa: null,
      id_centro_costo: null,
      estado: true,
    });
    this.form.controls.codigo.enable();
    this.isModalOpen.set(true);
  }

  protected editar(item: LocalItem): void {
    if (!this.permisos.editar()) return;
    this.editando.set(item);
    this.modalError.set('');
    this.tipoAsignacion.set(item.tipo_asignacion);
    this.form.reset({
      codigo: item.codigo,
      nombre: item.nombre,
      direccion: item.direccion ?? '',
      id_empresa: item.id_empresa,
      id_centro_costo: item.id_centro_costo,
      estado: item.estado,
    });
    this.form.controls.codigo.disable();
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected guardar(): void {
    const tipo = this.tipoAsignacion();


    const idEmpresa = this.form.controls.id_empresa.value;
    const idCc = this.form.controls.id_centro_costo.value;

    if (tipo === 'EMPRESA' && (!idEmpresa || Number(idEmpresa) <= 0)) {
      this.form.controls.id_empresa.markAsTouched();
      return this.modalError.set('Debe seleccionar la Empresa correspondiente.');
    }
    if (tipo === 'CENTRO_COSTO' && (!idCc || Number(idCc) <= 0)) {
      this.form.controls.id_centro_costo.markAsTouched();
      return this.modalError.set('Debe seleccionar el Centro de Costo u Obra correspondiente.');
    }

    this.modalError.set('');
    this.isSaving.set(true);
    const v = this.form.getRawValue();
    const actual = this.editando();

    if (actual) {
      const payload: UpdateLocalPayload = {
        id_empresa: tipo === 'EMPRESA' ? Number(idEmpresa) : undefined,
        id_centro_costo: tipo === 'CENTRO_COSTO' ? Number(idCc) : undefined,
        estado: v.estado,
      };

      this.localesService.update(actual.id, payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeModal();
          this.load();
        },
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.modalError.set(errorMessage(err));
        },
      });
    } else {
      const payload: CreateLocalPayload = {
        id_empresa: tipo === 'EMPRESA' ? Number(idEmpresa) : undefined,
        id_centro_costo: tipo === 'CENTRO_COSTO' ? Number(idCc) : undefined,
        estado: v.estado,
      };

      this.localesService.create(payload).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeModal();
          this.load();
        },
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.modalError.set(errorMessage(err));
        },
      });
    }
  }

  protected toggleEstado(item: LocalItem): void {
    if (!this.permisos.editar()) return;
    const nuevoEstado = !item.estado;
    this.localesService.toggleEstado(item.id, nuevoEstado).subscribe({
      next: () => this.load(),
      error: (err: unknown) => alert(errorMessage(err)),
    });
  }

  // ==================== 4. MÉTODOS NIVELES ====================
  protected nuevoNivel(): void {
    if (!this.permisos.crear()) return;
    this.editandoNivel.set(null);
    this.nivelModalError.set('');
    this.nivelForm.reset({ codigo: '', descripcion: '', estado: true });
    this.nivelForm.controls.codigo.enable();
    this.isNivelModalOpen.set(true);
  }

  protected editarNivel(item: NivelItem): void {
    if (!this.permisos.editar()) return;
    this.editandoNivel.set(item);
    this.nivelModalError.set('');
    this.nivelForm.reset({ codigo: item.codigo, descripcion: item.descripcion, estado: item.estado });
    this.nivelForm.controls.codigo.disable();
    this.isNivelModalOpen.set(true);
  }

  protected closeNivelModal(): void {
    this.isNivelModalOpen.set(false);
  }

  protected guardarNivel(): void {
    const codCtrl = this.nivelForm.controls.codigo;
    const descCtrl = this.nivelForm.controls.descripcion;

    if (codCtrl.invalid) {
      codCtrl.markAsTouched();
      return this.nivelModalError.set('El código del nivel es obligatorio (ej. PISO-01).');
    }
    if (descCtrl.invalid) {
      descCtrl.markAsTouched();
      return this.nivelModalError.set('La descripción del nivel es obligatoria.');
    }

    this.isNivelSaving.set(true);
    const v = this.nivelForm.getRawValue();
    const actual = this.editandoNivel();

    if (actual) {
      this.nivelesService.update(actual.id, { descripcion: v.descripcion.trim(), estado: v.estado }).subscribe({
        next: () => {
          this.isNivelSaving.set(false);
          this.closeNivelModal();
          this.loadNiveles();
        },
        error: (err) => {
          this.isNivelSaving.set(false);
          this.nivelModalError.set(errorMessage(err));
        },
      });
    } else {
      this.nivelesService.create({ codigo: v.codigo.trim().toUpperCase(), descripcion: v.descripcion.trim(), estado: v.estado }).subscribe({
        next: () => {
          this.isNivelSaving.set(false);
          this.closeNivelModal();
          this.loadNiveles();
        },
        error: (err) => {
          this.isNivelSaving.set(false);
          this.nivelModalError.set(errorMessage(err));
        },
      });
    }
  }

  protected toggleEstadoNivel(item: NivelItem): void {
    if (!this.permisos.editar()) return;
    this.nivelesService.toggleEstado(item.id, !item.estado).subscribe({
      next: () => this.loadNiveles(),
      error: (err) => alert(errorMessage(err)),
    });
  }

  // ==================== 5. MÉTODOS AMBIENTES ====================
  protected nuevoAmbiente(): void {
    if (!this.permisos.crear()) return;
    this.editandoAmbiente.set(null);
    this.ambienteModalError.set('');
    this.ambienteForm.reset({ codigo: '', descripcion: '', estado: true });
    this.ambienteForm.controls.codigo.enable();
    this.isAmbienteModalOpen.set(true);
  }

  protected editarAmbiente(item: AmbienteItem): void {
    if (!this.permisos.editar()) return;
    this.editandoAmbiente.set(item);
    this.ambienteModalError.set('');
    this.ambienteForm.reset({ codigo: item.codigo, descripcion: item.descripcion, estado: item.estado });
    this.ambienteForm.controls.codigo.disable();
    this.isAmbienteModalOpen.set(true);
  }

  protected closeAmbienteModal(): void {
    this.isAmbienteModalOpen.set(false);
  }

  protected guardarAmbiente(): void {
    const codCtrl = this.ambienteForm.controls.codigo;
    const descCtrl = this.ambienteForm.controls.descripcion;

    if (codCtrl.invalid) {
      codCtrl.markAsTouched();
      return this.ambienteModalError.set('El código del ambiente es obligatorio (ej. OFIC-01).');
    }
    if (descCtrl.invalid) {
      descCtrl.markAsTouched();
      return this.ambienteModalError.set('La descripción del ambiente es obligatoria.');
    }

    this.isAmbienteSaving.set(true);
    const v = this.ambienteForm.getRawValue();
    const actual = this.editandoAmbiente();

    if (actual) {
      this.ambientesService.update(actual.id, { descripcion: v.descripcion.trim(), estado: v.estado }).subscribe({
        next: () => {
          this.isAmbienteSaving.set(false);
          this.closeAmbienteModal();
          this.loadAmbientes();
        },
        error: (err) => {
          this.isAmbienteSaving.set(false);
          this.ambienteModalError.set(errorMessage(err));
        },
      });
    } else {
      this.ambientesService.create({ codigo: v.codigo.trim().toUpperCase(), descripcion: v.descripcion.trim(), estado: v.estado }).subscribe({
        next: () => {
          this.isAmbienteSaving.set(false);
          this.closeAmbienteModal();
          this.loadAmbientes();
        },
        error: (err) => {
          this.isAmbienteSaving.set(false);
          this.ambienteModalError.set(errorMessage(err));
        },
      });
    }
  }

  protected toggleEstadoAmbiente(item: AmbienteItem): void {
    if (!this.permisos.editar()) return;
    this.ambientesService.toggleEstado(item.id, !item.estado).subscribe({
      next: () => this.loadAmbientes(),
      error: (err) => alert(errorMessage(err)),
    });
  }
}
