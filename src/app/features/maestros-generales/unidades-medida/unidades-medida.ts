import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { mensajeError } from '@shared/utils/errores-http';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ExportarBotonesComponent } from '../../../shared/components/exportar-botones/exportar-botones';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
import { traerTodasLasPaginas, type DatosExportacion } from '../../../shared/utils/exportar';
import { valorDeEvento } from '../../../shared/utils/eventos';
import {
  CampoBusqueda,
  Equivalencia,
  FiltroEstado,
  UnidadMedida,
  UnidadMedidaOpcion,
} from './unidades-medida.models';
import { UnidadesMedidaService } from './unidades-medida.service';

/** Decimal positivo como lo acepta la API (`100`, `0.5`). */
const FACTOR = /^\d+(\.\d+)?$/;

/**
 * Maestro de unidades de medida (KG, M2, CIENTO…) que usan el catálogo de bienes, los
 * requerimientos y almacén, con sus equivalencias (1 CIENTO = 100 UNIDAD). La API no borra:
 * "Desactivar" pone `estado = false` y se reactiva desde Editar.
 */
@Component({
  selector: 'app-unidades-medida',
  standalone: true,
  imports: [ReactiveFormsModule, DataTableComponent, ModalComponent, ExportarBotonesComponent],
  templateUrl: './unidades-medida.html',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnidadesMedidaComponent {
  private readonly service = inject(UnidadesMedidaService);
  /** Nueva → crear; Editar → editar; Desactivar → eliminar (en unidades y equivalencias). */
  protected readonly permisos = permisosDePantalla('maestros.generales');

  protected readonly columns: DataTable[] = [
    { label: 'Código', width: '140px' },
    { label: 'Descripción' },
    { label: 'Símbolo', width: '120px' },
    { label: 'Estado', width: '110px', align: 'center' },
    { label: 'Acciones', width: '150px', align: 'center' },
  ];

  // ── Lista ───────────────────────────────────────────────────────────────────
  protected readonly items = signal<readonly UnidadMedida[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly campo = signal<CampoBusqueda>('descripcion');
  protected readonly texto = signal('');
  protected readonly estado = signal<FiltroEstado>('todas');
  protected readonly isLoading = signal(false);
  protected readonly listError = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  /** Todas las unidades (id → "DESCRIPCIÓN (símbolo)") para nombrar los destinos de equivalencia. */
  protected readonly opciones = signal<UnidadMedidaOpcion[]>([]);
  private readonly nombres = computed(() => new Map(this.opciones().map((o) => [o.id, o.nombre])));

  // ── Modal de unidad ─────────────────────────────────────────────────────────
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly editando = signal<UnidadMedida | null>(null);

  protected readonly form = new FormGroup({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    descripcion: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    simbolo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    estado: new FormControl(true, { nonNullable: true }),
  });

  // ── Modal de equivalencias ──────────────────────────────────────────────────
  protected readonly origen = signal<UnidadMedida | null>(null);
  protected readonly equivalencias = signal<readonly Equivalencia[]>([]);
  protected readonly eqLoading = signal(false);
  protected readonly eqSaving = signal(false);
  protected readonly eqError = signal('');
  /** Equivalencia en edición; `null` con el formulario abierto = nueva. */
  protected readonly eqEditando = signal<Equivalencia | null>(null);
  protected readonly eqFormAbierto = signal(false);

  protected readonly eqForm = new FormGroup({
    destino: new FormControl<number | null>(null, { validators: [Validators.required] }),
    factor: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(FACTOR)] }),
    estado: new FormControl(true, { nonNullable: true }),
  });

  /** Destinos posibles: todas las unidades menos la de origen. */
  protected readonly destinos = computed(() => {
    const idOrigen = this.origen()?.id;
    return this.opciones().filter((o) => o.id !== idOrigen);
  });

  readonly exportar = async (): Promise<DatosExportacion> => {
    const filtros = { campo: this.campo(), texto: this.texto(), estado: this.estado() };
    const filas = await traerTodasLasPaginas((page, pageSize) => this.service.list({ ...filtros, page, pageSize }));
    return {
      nombre: 'Unidades de medida',
      columnas: ['Código', 'Descripción', 'Símbolo', 'Estado'],
      filas: filas.map((u) => [u.codigo, u.descripcion, u.simbolo ?? '', u.estado ? 'Activa' : 'Inactiva']),
    };
  };

  constructor() {
    this.load();
    this.loadOpciones();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.listError.set('');
    this.service
      .list({ page: this.page(), pageSize: this.pageSize(), campo: this.campo(), texto: this.texto(), estado: this.estado() })
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.total.set(r.total);
          this.isLoading.set(false);
        },
        error: (err: unknown) => {
          this.items.set([]);
          this.total.set(0);
          this.listError.set(mensajeError(err));
          this.isLoading.set(false);
        },
      });
  }

  private loadOpciones(): void {
    this.service.select().subscribe({ next: (r) => this.opciones.set(r), error: () => this.opciones.set([]) });
  }

  protected nombreUnidad(id: number): string {
    return this.nombres().get(id) ?? `#${id}`;
  }

  // ── Filtros y paginación ────────────────────────────────────────────────────
  protected onSearch(event: Event): void {
    this.texto.set(valorDeEvento(event));
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.irAPagina(1), 350);
  }

  protected onCampo(event: Event): void {
    this.campo.set(valorDeEvento(event) === 'codigo' ? 'codigo' : 'descripcion');
    if (this.texto().trim()) this.irAPagina(1);
  }

  protected onEstado(event: Event): void {
    const v = valorDeEvento(event);
    this.estado.set(v === 'activas' || v === 'inactivas' ? v : 'todas');
    this.irAPagina(1);
  }

  protected restablecer(): void {
    this.campo.set('descripcion');
    this.texto.set('');
    this.estado.set('todas');
    this.irAPagina(1);
  }

  protected irAPagina(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected cambiarTamano(size: number): void {
    this.pageSize.set(size);
    this.irAPagina(1);
  }

  // ── Alta / edición / desactivación ──────────────────────────────────────────
  protected nueva(): void {
    if (!this.permisos.crear()) return;
    this.editando.set(null);
    this.modalError.set('');
    this.form.reset({ codigo: '', descripcion: '', simbolo: '', estado: true });
    this.isModalOpen.set(true);
  }

  protected editar(u: UnidadMedida): void {
    if (!this.permisos.editar()) return;
    this.editando.set(u);
    this.modalError.set('');
    this.form.reset({ codigo: u.codigo, descripcion: u.descripcion, simbolo: u.simbolo ?? '', estado: u.estado });
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.modalError.set('Indique el código y la descripción.');
    }
    const v = this.form.getRawValue();
    const body = {
      codigo: v.codigo.trim().toUpperCase(),
      descripcion: v.descripcion.trim().toUpperCase(),
      simbolo: v.simbolo.trim() || undefined,
    };
    const actual = this.editando();
    this.isSaving.set(true);
    const request$: Observable<UnidadMedida> = actual
      ? this.service.update(actual.id, { ...body, estado: v.estado })
      : this.service.create(body);
    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeModal();
        this.load();
        this.loadOpciones();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.modalError.set(mensajeError(err));
      },
    });
  }

  /** Avisa cuántos productos la usan antes de desactivarla (siguen guardados, pero no se elige en nuevos). */
  protected desactivar(u: UnidadMedida): void {
    if (!this.permisos.eliminar()) return;
    this.service.contarProductos(u.id).subscribe({
      next: (n) => this.confirmarDesactivar(u, n),
      error: () => this.confirmarDesactivar(u, null),
    });
  }

  private confirmarDesactivar(u: UnidadMedida, productos: number | null): void {
    const uso =
      productos === null
        ? 'No se pudo comprobar si hay productos que la usan.'
        : productos === 0
          ? 'Ningún producto del catálogo la usa.'
          : `${productos} producto(s) del catálogo la usan.`;
    if (!confirm(`¿Desactivar la unidad "${u.codigo} - ${u.descripcion}"?\n${uso}\nPuede reactivarla desde Editar.`)) return;
    this.service.desactivar(u.id).subscribe({
      next: () => {
        this.load();
        this.loadOpciones();
      },
      error: (err: unknown) => alert(mensajeError(err)),
    });
  }

  // ── Equivalencias ───────────────────────────────────────────────────────────
  protected abrirEquivalencias(u: UnidadMedida): void {
    this.origen.set(u);
    this.eqError.set('');
    this.eqFormAbierto.set(false);
    this.loadEquivalencias();
  }

  protected cerrarEquivalencias(): void {
    this.origen.set(null);
    this.equivalencias.set([]);
  }

  private loadEquivalencias(): void {
    const u = this.origen();
    if (!u) return;
    this.eqLoading.set(true);
    this.service.equivalencias(u.id).subscribe({
      next: (r) => {
        this.equivalencias.set(r);
        this.eqLoading.set(false);
      },
      error: (err: unknown) => {
        this.equivalencias.set([]);
        this.eqError.set(mensajeError(err));
        this.eqLoading.set(false);
      },
    });
  }

  protected nuevaEquivalencia(): void {
    if (!this.permisos.crear()) return;
    this.eqEditando.set(null);
    this.eqError.set('');
    this.eqForm.reset({ destino: null, factor: '', estado: true });
    this.eqForm.controls.destino.enable();
    this.eqFormAbierto.set(true);
  }

  protected editarEquivalencia(e: Equivalencia): void {
    if (!this.permisos.editar()) return;
    this.eqEditando.set(e);
    this.eqError.set('');
    this.eqForm.reset({ destino: e.id_uni_med_destino, factor: e.factor_conversion, estado: e.estado });
    this.eqForm.controls.destino.disable();
    this.eqFormAbierto.set(true);
  }

  protected cancelarEquivalencia(): void {
    this.eqFormAbierto.set(false);
    this.eqError.set('');
  }

  protected guardarEquivalencia(): void {
    const u = this.origen();
    if (!u) return;
    const v = this.eqForm.getRawValue();
    const factor = v.factor.trim();
    if (v.destino === null || !FACTOR.test(factor) || Number(factor) <= 0) {
      this.eqForm.markAllAsTouched();
      return this.eqError.set('Elija la unidad destino e indique un factor mayor que 0 (use punto decimal).');
    }
    const actual = this.eqEditando();
    this.eqSaving.set(true);
    const request$: Observable<Equivalencia> = actual
      ? this.service.editarEquivalencia(u.id, actual.id, { factor_conversion: factor, estado: v.estado })
      : this.service.crearEquivalencia(u.id, { id_uni_med_destino: v.destino, factor_conversion: factor });
    request$.subscribe({
      next: () => {
        this.eqSaving.set(false);
        this.eqFormAbierto.set(false);
        this.loadEquivalencias();
      },
      error: (err: unknown) => {
        this.eqSaving.set(false);
        this.eqError.set(mensajeError(err));
      },
    });
  }

  protected desactivarEquivalencia(e: Equivalencia): void {
    const u = this.origen();
    if (!u || !this.permisos.eliminar()) return;
    const texto = `1 ${u.descripcion} = ${e.factor_conversion} ${this.nombreUnidad(e.id_uni_med_destino)}`;
    if (!confirm(`¿Desactivar la equivalencia "${texto}"?`)) return;
    this.service.desactivarEquivalencia(u.id, e.id).subscribe({
      next: () => this.loadEquivalencias(),
      error: (err: unknown) => this.eqError.set(mensajeError(err)),
    });
  }
}
