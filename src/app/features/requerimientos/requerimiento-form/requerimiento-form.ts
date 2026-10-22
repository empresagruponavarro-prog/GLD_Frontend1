import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { PermisosService } from '@app/core/auth/permisos.service';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select';
import { errorMessage } from '@shared/utils/errores-http';
import { fmtMoney, fmtNum, todayISO } from '@shared/utils/formato';
import { FasePorCentroCosto } from '../../presupuestos/interfaces/presupuestos.interface';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';
import { CatalogoPickerComponent } from '../catalogo-picker/catalogo-picker';
import { CotizacionesPanelComponent } from '../cotizaciones-panel/cotizaciones-panel';
import {
  ACCION_LABEL,
  AVANCE_LABEL,
  Area,
  ESTADO_LABEL,
  ItemCatalogo,
  Requerimiento,
  RequerimientoLineaPayload,
  RequerimientoPayload,
  SelectOption,
  TIPOS_REQUERIMIENTO,
  TIPO_LABEL,
  TipoRequerimiento,
} from '../requerimientos.models';
import { RequerimientosService } from '../requerimientos.service';
import { ESTADOS_ANULABLES, avanceBadge, esEditable, estadoBadge } from '../requerimientos.utils';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;

function lineaGroup() {
  return new FormGroup({
    id_producto: new FormControl<number | null>(null, { validators: [Validators.required] }),
    etiqueta: new FormControl('', { nonNullable: true }),
    tipo: new FormControl<'PRODUCTO' | 'SERVICIO' | ''>('', { nonNullable: true }),
    cantidad: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(DECIMAL)] }),
    precio_referencial: new FormControl('', { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true }),
    id_beneficiario: new FormControl<number | null>(null),
  });
}

type LineaGroup = ReturnType<typeof lineaGroup>;

@Component({
  selector: 'app-requerimiento-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SearchSelectComponent, CatalogoPickerComponent, CotizacionesPanelComponent],
  templateUrl: './requerimiento-form.html',
  styleUrl: './requerimiento-form.css',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequerimientoFormComponent {
  private readonly service = inject(RequerimientosService);
  private readonly presupuestos = inject(PresupuestosService);
  private readonly router = inject(Router);
  private readonly idParam = inject(ActivatedRoute).snapshot.paramMap.get('id');
  private readonly permisosSesion = inject(PermisosService);
  /**
   * Módulo `requerimientos` (anexo §7.3): Guardar borrador → crear (alta) / editar (edición);
   * "Guardar y enviar" exige además poder guardar (enviar solo exige ver). Anular → basta ver.
   * Generar orden de compra → crear en `documentos.origen`. Imprimir el FUR es libre.
   */
  protected readonly permisos = permisosDePantalla('requerimientos');

  protected readonly estadoLabel = ESTADO_LABEL;
  protected readonly avanceLabel = AVANCE_LABEL;
  protected readonly tipos = TIPOS_REQUERIMIENTO;
  protected readonly tipoLabel = TIPO_LABEL;
  protected readonly accionLabel = ACCION_LABEL;
  protected readonly estadoBadge = estadoBadge;
  protected readonly avanceBadge = avanceBadge;
  protected readonly fmtNum = fmtNum;
  protected readonly fmtMoney = fmtMoney;

  protected readonly requerimiento = signal<Requerimiento | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly loadError = signal('');

  protected readonly centrosCostos = signal<SelectOption[]>([]);
  protected readonly trabajadores = signal<SelectOption[]>([]);
  protected readonly fases = signal<FasePorCentroCosto[]>([]);
  protected readonly areas = signal<Area[]>([]);
  protected readonly beneficiarios = signal<SelectOption[]>([]);
  /** Tipo elegido en el formulario (cambia lo que se pide en cada línea). */
  protected readonly tipoActual = signal<TipoRequerimiento>('COMPRA');
  protected readonly esCompra = computed(() => this.tipoActual() === 'COMPRA');

  protected readonly esNuevo = this.idParam === null;
  /** Guardar exige crear en el alta y editar en la edición. */
  protected readonly puedeGuardar = computed(() => (this.esNuevo ? this.permisos.crear() : this.permisos.editar()));
  /** Alta sin permiso de crear: el formulario queda vacío, deshabilitado y sin botones de guardar. */
  protected readonly altaSinPermiso = computed(() => this.esNuevo && !this.permisos.crear());
  /** Solo BORRADOR y OBSERVADO se pueden modificar (y solo con permiso de editar); el resto es de lectura. */
  protected readonly soloLectura = computed(() => {
    const r = this.requerimiento();
    return r !== null && (!esEditable(r.estado) || !this.permisos.editar());
  });
  protected readonly ultimaObservacion = computed(() => {
    const r = this.requerimiento();
    if (r?.estado !== 'OBSERVADO') return null;
    return [...(r.eventos ?? [])].reverse().find((e) => e.accion === 'OBSERVAR') ?? null;
  });
  /** Generar la OC abre un alta en documentos de origen: exige crear en `documentos.origen`. */
  protected readonly puedeGenerarOc = computed(() => {
    const r = this.requerimiento();
    return (
      r?.estado === 'APROBADO' &&
      r.tipo === 'COMPRA' &&
      r.avance !== 'ATENDIDO' &&
      this.permisosSesion.puede('documentos.origen', 'crear')
    );
  });
  /** Las compras muestran sus cotizaciones desde que se envían. */
  protected readonly muestraCotizaciones = computed(() => {
    const r = this.requerimiento();
    return r !== null && r.tipo === 'COMPRA' && r.estado !== 'BORRADOR';
  });
  protected readonly puedeAnular = computed(() => {
    const r = this.requerimiento();
    return r !== null && ESTADOS_ANULABLES.includes(r.estado) && (r.ordenes_compra ?? []).every((o) => o.estado === 'ANULADO');
  });

  protected readonly form = new FormGroup({
    fecha: new FormControl(todayISO(), { nonNullable: true, validators: [Validators.required] }),
    fecha_requerida: new FormControl('', { nonNullable: true }),
    id_centro_costo: new FormControl<number | null>(null, { validators: [Validators.required] }),
    id_fase: new FormControl<number | null>(null),
    id_solicitante: new FormControl<number | null>(null, { validators: [Validators.required] }),
    tipo: new FormControl<TipoRequerimiento>('COMPRA', { nonNullable: true }),
    id_area: new FormControl<number | null>(null),
    id_beneficiario: new FormControl<number | null>(null),
    justificacion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lineas: new FormArray<LineaGroup>([lineaGroup()]),
  });

  constructor() {
    this.service.getCentrosCostosSelect().subscribe({ next: (r) => this.centrosCostos.set(r), error: () => this.centrosCostos.set([]) });
    this.service.getTrabajadoresSelect().subscribe({ next: (r) => this.trabajadores.set(r), error: () => this.trabajadores.set([]) });
    this.service.getAreas().subscribe({ next: (r) => this.areas.set(r), error: () => this.areas.set([]) });
    this.service.getAnexosSelect().subscribe({ next: (r) => this.beneficiarios.set(r), error: () => this.beneficiarios.set([]) });
    this.form.controls.tipo.valueChanges.subscribe((t) => this.tipoActual.set(t));
    this.form.controls.id_centro_costo.valueChanges.subscribe((id) => {
      this.form.controls.id_fase.setValue(null, { emitEvent: false });
      this.loadFases(id);
    });
    // Sin permiso de guardar, el formulario queda en solo lectura.
    effect(() => {
      this.puedeGuardar();
      this.aplicarEdicion();
    });
    if (this.idParam !== null) this.load(Number(this.idParam));
  }

  /** Habilita o deshabilita el formulario según el permiso de guardar. */
  private aplicarEdicion(): void {
    if (this.puedeGuardar()) this.form.enable({ emitEvent: false });
    else this.form.disable({ emitEvent: false });
  }

  protected get lineas(): FormArray<LineaGroup> {
    return this.form.controls.lineas;
  }

  private load(id: number): void {
    this.isLoading.set(true);
    this.service.getById(id).subscribe({
      next: (r) => {
        this.requerimiento.set(r);
        this.isLoading.set(false);
        if (esEditable(r.estado)) this.patchForm(r);
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(errorMessage(err));
      },
    });
  }

  private patchForm(r: Requerimiento): void {
    this.form.patchValue(
      {
        fecha: r.fecha,
        fecha_requerida: r.fecha_requerida ?? '',
        id_centro_costo: r.id_centro_costo,
        id_solicitante: r.id_solicitante,
        tipo: r.tipo,
        id_area: r.id_area,
        id_beneficiario: r.id_beneficiario,
        justificacion: r.justificacion,
      },
      { emitEvent: false },
    );
    this.tipoActual.set(r.tipo);
    this.loadFases(r.id_centro_costo, r.id_fase);
    this.lineas.clear();
    for (const l of r.lineas ?? []) {
      const g = lineaGroup();
      g.patchValue({
        id_producto: l.id_producto,
        etiqueta: `${l.codigo} — ${l.descripcion}`,
        tipo: l.tipo_producto,
        cantidad: l.cantidad,
        precio_referencial: l.precio_referencial ?? '',
        observaciones: l.observaciones ?? '',
        id_beneficiario: l.id_beneficiario,
      });
      this.lineas.push(g);
    }
    if (this.lineas.length === 0) this.lineas.push(lineaGroup());
    // Las líneas nuevas nacen habilitadas: se reaplica el solo lectura si no hay permiso.
    this.aplicarEdicion();
  }

  private loadFases(idCentroCosto: number | null, seleccionada: number | null = null): void {
    this.fases.set([]);
    if (!idCentroCosto) return;
    this.presupuestos.getFasesPorCentroCosto(idCentroCosto).subscribe({
      next: (res) => {
        this.fases.set(Array.isArray(res) ? res : []);
        if (seleccionada) this.form.controls.id_fase.setValue(seleccionada, { emitEvent: false });
      },
      error: () => this.fases.set([]),
    });
  }

  // ---------------------------------------------------------------- líneas
  protected addLinea(): void {
    if (!this.puedeGuardar()) return;
    this.lineas.push(lineaGroup());
  }

  protected removeLinea(index: number): void {
    if (!this.puedeGuardar()) return;
    if (this.lineas.length > 1) this.lineas.removeAt(index);
  }

  protected onItemPicked(linea: LineaGroup, item: ItemCatalogo): void {
    if (!this.puedeGuardar()) return;
    linea.patchValue({ id_producto: item.id, etiqueta: `${item.codigo} — ${item.descripcion}`, tipo: item.tipo_producto });
  }

  // ---------------------------------------------------------------- acciones
  protected save(enviar = false): void {
    if (!this.puedeGuardar()) return;
    const error = this.validate();
    const payload = error ? null : this.buildPayload();
    if (error || !payload) {
      this.formError.set(error ?? 'Complete los datos obligatorios.');
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    this.formError.set('');
    const actual = this.requerimiento();
    const guardar$ = actual ? this.service.update(actual.id, payload) : this.service.create(payload);
    guardar$.subscribe({
      next: (r) => {
        if (enviar) {
          this.service.enviar(r.id).subscribe({
            next: () => {
              this.isSaving.set(false);
              void this.router.navigate(['/requerimientos']);
            },
            error: (err: unknown) => this.onSaveError(err, r),
          });
          return;
        }
        this.isSaving.set(false);
        if (actual) {
          this.requerimiento.set(r);
          this.patchForm(r);
        } else {
          void this.router.navigate(['/requerimientos', r.id]);
        }
      },
      error: (err: unknown) => this.onSaveError(err),
    });
  }

  /** Si el borrador ya se guardó pero el envío falló, se queda editando ese borrador. */
  private onSaveError(err: unknown, guardado?: Requerimiento): void {
    this.isSaving.set(false);
    this.formError.set(errorMessage(err));
    if (guardado && !this.requerimiento()) void this.router.navigate(['/requerimientos', guardado.id]);
  }

  protected anular(): void {
    const r = this.requerimiento();
    if (!r || !confirm(`¿Anular ${r.numero}? Esta acción no se puede deshacer.`)) return;
    this.service.anular(r.id).subscribe({
      next: (res) => this.requerimiento.set(res),
      error: (err: unknown) => alert(errorMessage(err)),
    });
  }

  /** Tras registrar o cerrar cotizaciones se recarga el FUR (cambia de estado y de cotizaciones). */
  protected onCotizacionesChanged(): void {
    const r = this.requerimiento();
    if (r) this.load(r.id);
  }

  protected generarOc(): void {
    const r = this.requerimiento();
    if (r && this.puedeGenerarOc()) void this.router.navigate(['/documentos/origen'], { queryParams: { requerimiento: r.id } });
  }

  private validate(): string | null {
    const v = this.form.getRawValue();
    if (!v.fecha) return 'Indique la fecha.';
    if (!v.id_centro_costo) return 'Seleccione el centro de costos.';
    if (!v.id_solicitante) return 'Seleccione al solicitante.';
    if (!v.justificacion.trim()) return 'Indique la justificación del requerimiento.';
    if (v.tipo !== 'COMPRA' && !v.id_beneficiario && v.lineas.some((l) => !l.id_beneficiario)) {
      return 'Indique el beneficiario del requerimiento (o uno por línea).';
    }
    const vistos = new Set<string>();
    for (const [i, l] of v.lineas.entries()) {
      const n = i + 1;
      if (!l.id_producto) return `Línea ${n}: seleccione un producto o servicio.`;
      const clave = v.tipo === 'COMPRA' ? String(l.id_producto) : `${l.id_producto}:${l.id_beneficiario ?? v.id_beneficiario ?? 0}`;
      if (vistos.has(clave)) return v.tipo === 'COMPRA' ? `Línea ${n}: el ítem está repetido.` : `Línea ${n}: el concepto está repetido para el mismo beneficiario.`;
      vistos.add(clave);
      if (v.tipo !== 'COMPRA' && !(Number(l.precio_referencial) > 0)) return `Línea ${n}: indique el importe (precio) mayor a 0.`;
      if (!DECIMAL.test(l.cantidad.trim()) || Number(l.cantidad) <= 0) return `Línea ${n}: la cantidad debe ser mayor a 0 (hasta 4 decimales).`;
      const precio = l.precio_referencial.trim();
      if (precio !== '' && !DECIMAL.test(precio)) return `Línea ${n}: el precio referencial no es válido.`;
    }
    return null;
  }

  /** Payload del formulario; `null` si falta un dato obligatorio (no ocurre tras `validate`). */
  private buildPayload(): RequerimientoPayload | null {
    const v = this.form.getRawValue();
    const text = (s: string) => s.trim() || undefined;
    if (v.id_centro_costo === null || v.id_solicitante === null) return null;
    const lineas: RequerimientoLineaPayload[] = [];
    for (const l of v.lineas) {
      if (l.id_producto === null) return null;
      lineas.push({
        id_producto: l.id_producto,
        cantidad: l.cantidad.trim(),
        precio_referencial: text(l.precio_referencial),
        observaciones: text(l.observaciones),
        id_beneficiario: l.id_beneficiario ?? undefined,
      });
    }
    return {
      fecha: v.fecha,
      fecha_requerida: text(v.fecha_requerida),
      id_centro_costo: v.id_centro_costo,
      id_fase: v.id_fase ?? undefined,
      id_solicitante: v.id_solicitante,
      tipo: v.tipo,
      id_beneficiario: v.id_beneficiario ?? undefined,
      id_area: v.id_area ?? undefined,
      justificacion: v.justificacion.trim(),
      lineas,
    };
  }
}
