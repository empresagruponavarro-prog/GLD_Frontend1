import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select';
import { errorMessage, fmtMoney, fmtNum, todayISO } from '../../almacen/almacen.utils';
import { FasePorCentroCosto } from '../../presupuestos/interfaces/presupuestos.interface';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';
import { CatalogoPickerComponent } from '../catalogo-picker/catalogo-picker';
import {
  ACCION_LABEL,
  AVANCE_LABEL,
  ESTADO_LABEL,
  ItemCatalogo,
  Requerimiento,
  RequerimientoPayload,
  SelectOption,
} from '../requerimientos.models';
import { RequerimientosService } from '../requerimientos.service';
import { avanceBadge, esEditable, estadoBadge } from '../requerimientos.utils';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;

function lineaGroup() {
  return new FormGroup({
    id_producto: new FormControl<number | null>(null, { validators: [Validators.required] }),
    etiqueta: new FormControl('', { nonNullable: true }),
    tipo: new FormControl<'PRODUCTO' | 'SERVICIO' | ''>('', { nonNullable: true }),
    cantidad: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(DECIMAL)] }),
    precio_referencial: new FormControl('', { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true }),
  });
}

type LineaGroup = ReturnType<typeof lineaGroup>;

@Component({
  selector: 'app-requerimiento-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SearchSelectComponent, CatalogoPickerComponent],
  templateUrl: './requerimiento-form.html',
  styleUrl: './requerimiento-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequerimientoFormComponent {
  private readonly service = inject(RequerimientosService);
  private readonly presupuestos = inject(PresupuestosService);
  private readonly router = inject(Router);
  private readonly idParam = inject(ActivatedRoute).snapshot.paramMap.get('id');

  protected readonly estadoLabel = ESTADO_LABEL;
  protected readonly avanceLabel = AVANCE_LABEL;
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

  protected readonly esNuevo = this.idParam === null;
  /** Solo BORRADOR y OBSERVADO se pueden modificar; el resto es de lectura. */
  protected readonly soloLectura = computed(() => {
    const r = this.requerimiento();
    return r !== null && !esEditable(r.estado);
  });
  protected readonly ultimaObservacion = computed(() => {
    const r = this.requerimiento();
    if (r?.estado !== 'OBSERVADO') return null;
    return [...(r.eventos ?? [])].reverse().find((e) => e.accion === 'OBSERVAR') ?? null;
  });
  protected readonly puedeGenerarOc = computed(() => {
    const r = this.requerimiento();
    return r?.estado === 'APROBADO' && r.avance !== 'ATENDIDO';
  });
  protected readonly puedeAnular = computed(() => {
    const r = this.requerimiento();
    return r !== null && ['ENVIADO', 'APROBADO', 'OBSERVADO'].includes(r.estado) && (r.ordenes_compra ?? []).length === 0;
  });

  protected readonly form = new FormGroup({
    fecha: new FormControl(todayISO(), { nonNullable: true, validators: [Validators.required] }),
    fecha_requerida: new FormControl('', { nonNullable: true }),
    id_centro_costo: new FormControl<number | null>(null, { validators: [Validators.required] }),
    id_fase: new FormControl<number | null>(null),
    id_solicitante: new FormControl<number | null>(null, { validators: [Validators.required] }),
    area: new FormControl('', { nonNullable: true }),
    justificacion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lineas: new FormArray<LineaGroup>([lineaGroup()]),
  });

  constructor() {
    this.service.getCentrosCostosSelect().subscribe({ next: (r) => this.centrosCostos.set(r), error: () => this.centrosCostos.set([]) });
    this.service.getTrabajadoresSelect().subscribe({ next: (r) => this.trabajadores.set(r), error: () => this.trabajadores.set([]) });
    this.form.controls.id_centro_costo.valueChanges.subscribe((id) => {
      this.form.controls.id_fase.setValue(null, { emitEvent: false });
      this.loadFases(id);
    });
    if (this.idParam !== null) this.load(Number(this.idParam));
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
      error: (err) => {
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
        area: r.area ?? '',
        justificacion: r.justificacion,
      },
      { emitEvent: false },
    );
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
      });
      this.lineas.push(g);
    }
    if (this.lineas.length === 0) this.lineas.push(lineaGroup());
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
    this.lineas.push(lineaGroup());
  }

  protected removeLinea(index: number): void {
    if (this.lineas.length > 1) this.lineas.removeAt(index);
  }

  protected onItemPicked(linea: LineaGroup, item: ItemCatalogo): void {
    linea.patchValue({ id_producto: item.id, etiqueta: `${item.codigo} — ${item.descripcion}`, tipo: item.tipo_producto });
  }

  // ---------------------------------------------------------------- acciones
  protected save(enviar = false): void {
    const error = this.validate();
    if (error) {
      this.formError.set(error);
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    this.formError.set('');
    const payload = this.buildPayload();
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
            error: (err) => this.onSaveError(err, r),
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
      error: (err) => this.onSaveError(err),
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
      error: (err) => alert(errorMessage(err)),
    });
  }

  protected generarOc(): void {
    const r = this.requerimiento();
    if (r) void this.router.navigate(['/documentos/origen'], { queryParams: { requerimiento: r.id } });
  }

  private validate(): string | null {
    const v = this.form.getRawValue();
    if (!v.fecha) return 'Indique la fecha.';
    if (!v.id_centro_costo) return 'Seleccione el centro de costos.';
    if (!v.id_solicitante) return 'Seleccione al solicitante.';
    if (!v.justificacion.trim()) return 'Indique la justificación del requerimiento.';
    const productos = new Set<number>();
    for (const [i, l] of v.lineas.entries()) {
      const n = i + 1;
      if (!l.id_producto) return `Línea ${n}: seleccione un producto o servicio.`;
      if (productos.has(l.id_producto)) return `Línea ${n}: el ítem está repetido.`;
      productos.add(l.id_producto);
      if (!DECIMAL.test(l.cantidad.trim()) || Number(l.cantidad) <= 0) return `Línea ${n}: la cantidad debe ser mayor a 0 (hasta 4 decimales).`;
      const precio = l.precio_referencial.trim();
      if (precio !== '' && !DECIMAL.test(precio)) return `Línea ${n}: el precio referencial no es válido.`;
    }
    return null;
  }

  private buildPayload(): RequerimientoPayload {
    const v = this.form.getRawValue();
    const text = (s: string) => s.trim() || undefined;
    return {
      fecha: v.fecha,
      fecha_requerida: text(v.fecha_requerida),
      id_centro_costo: v.id_centro_costo as number,
      id_fase: v.id_fase ?? undefined,
      id_solicitante: v.id_solicitante as number,
      area: text(v.area),
      justificacion: v.justificacion.trim(),
      lineas: v.lineas.map((l) => ({
        id_producto: l.id_producto as number,
        cantidad: l.cantidad.trim(),
        precio_referencial: text(l.precio_referencial),
        observaciones: text(l.observaciones),
      })),
    };
  }
}
