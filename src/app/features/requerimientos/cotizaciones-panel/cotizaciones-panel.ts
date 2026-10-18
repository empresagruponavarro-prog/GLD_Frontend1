import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select';
import { errorMessage, fmtMoney, fmtNum, todayISO } from '../../almacen/almacen.utils';
import {
  Cotizacion,
  CotizacionPayload,
  MEDIOS_PAGO,
  MEDIO_PAGO_LABEL,
  MedioPago,
  Requerimiento,
  RequerimientoLinea,
  SelectOption,
} from '../requerimientos.models';
import { RequerimientosService } from '../requerimientos.service';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;

function lineaGroup(linea: RequerimientoLinea) {
  return new FormGroup({
    id_requerimiento_detalle: new FormControl(linea.id, { nonNullable: true }),
    etiqueta: new FormControl(`${linea.codigo} — ${linea.descripcion}`, { nonNullable: true }),
    unidad: new FormControl(linea.unidad, { nonNullable: true }),
    solicitada: new FormControl(linea.cantidad, { nonNullable: true }),
    cotiza: new FormControl(true, { nonNullable: true }),
    cantidad: new FormControl(linea.cantidad, { nonNullable: true, validators: [Validators.pattern(DECIMAL)] }),
    precio_unitario: new FormControl('', { nonNullable: true }),
    plazo_entrega_dias: new FormControl('', { nonNullable: true }),
    marca_modelo: new FormControl('', { nonNullable: true }),
  });
}

type LineaGroup = ReturnType<typeof lineaGroup>;

/**
 * Cotizaciones de un FUR de compra: de 1 a n proveedores. El sistema solo muestra los datos;
 * quien aprueba elige al ganador según precio, forma de pago, medio de pago y disponibilidad.
 */
@Component({
  selector: 'app-cotizaciones-panel',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ModalComponent, SearchSelectComponent],
  templateUrl: './cotizaciones-panel.html',
  styleUrl: './cotizaciones-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CotizacionesPanelComponent {
  private readonly service = inject(RequerimientosService);
  /**
   * Módulo `requerimientos` (anexo §7.3, `CotizacionController`): Registrar → crear; Editar → editar;
   * Eliminar → eliminar. Cerrar el cuadro y Reabrir → basta ver. Imprimir el cuadro es libre.
   */
  protected readonly permisos = permisosDePantalla('requerimientos');

  readonly requerimiento = input.required<Requerimiento>();
  readonly changed = output<void>();

  protected readonly fmtMoney = fmtMoney;
  protected readonly fmtNum = fmtNum;
  protected readonly medios = MEDIOS_PAGO;
  protected readonly medioLabel = MEDIO_PAGO_LABEL;

  protected readonly cotizaciones = signal<Cotizacion[]>([]);
  protected readonly proveedores = signal<SelectOption[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly editando = signal<Cotizacion | null>(null);

  /** Solo se cotiza mientras el FUR está ENVIADO. */
  protected readonly puedeCotizar = computed(() => this.requerimiento().estado === 'ENVIADO');
  protected readonly puedeCerrar = computed(() => this.puedeCotizar() && this.cotizaciones().length > 0);
  protected readonly puedeReabrir = computed(() => this.requerimiento().estado === 'COTIZADO');
  protected readonly puedeRegistrar = computed(() => this.puedeCotizar() && this.permisos.crear());
  protected readonly puedeEditar = computed(() => this.puedeCotizar() && this.permisos.editar());
  protected readonly puedeEliminar = computed(() => this.puedeCotizar() && this.permisos.eliminar());
  protected readonly tituloModal = computed(() => {
    const c = this.editando();
    return c ? `Editar cotización ${c.numero}` : 'Registrar cotización';
  });

  protected readonly form = new FormGroup({
    id_proveedor: new FormControl<number | null>(null, { validators: [Validators.required] }),
    fecha: new FormControl(todayISO(), { nonNullable: true, validators: [Validators.required] }),
    referencia: new FormControl('', { nonNullable: true }),
    moneda_id: new FormControl<'PEN' | 'USD'>('PEN', { nonNullable: true }),
    incluye_igv: new FormControl(false, { nonNullable: true }),
    afecto_igv: new FormControl(true, { nonNullable: true }),
    forma_pago: new FormControl('Contado', { nonNullable: true, validators: [Validators.required] }),
    dias_credito: new FormControl('0', { nonNullable: true }),
    adelanto_porcentaje: new FormControl('', { nonNullable: true }),
    medio_pago: new FormControl<MedioPago | ''>('', { nonNullable: true }),
    plazo_entrega_dias: new FormControl('', { nonNullable: true }),
    validez_dias: new FormControl('', { nonNullable: true }),
    garantia: new FormControl('', { nonNullable: true }),
    condiciones: new FormControl('', { nonNullable: true }),
    archivo_url: new FormControl('', { nonNullable: true }),
    lineas: new FormArray<LineaGroup>([]),
  });

  constructor() {
    this.service.getProveedoresSelect().subscribe({ next: (r) => this.proveedores.set(r), error: () => this.proveedores.set([]) });
    effect(() => {
      const id = this.requerimiento().id;
      untracked(() => this.load(id));
    });
  }

  protected get lineas(): FormArray<LineaGroup> {
    return this.form.controls.lineas;
  }

  /** Precio referencial del FUR para la línea i (solo lectura; el precio cotizado se digita aparte). */
  protected precioRef(i: number): string | null {
    return this.requerimiento().lineas?.[i]?.precio_referencial ?? null;
  }

  protected load(id = this.requerimiento().id): void {
    this.isLoading.set(true);
    this.service.getCotizaciones(id).subscribe({
      next: (r) => {
        this.cotizaciones.set(r);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.cotizaciones.set([]);
        this.isLoading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  // ---------------------------------------------------------------- modal
  protected nueva(): void {
    if (!this.puedeRegistrar()) return;
    this.editando.set(null);
    this.modalError.set('');
    this.form.reset({
      id_proveedor: null,
      fecha: todayISO(),
      moneda_id: 'PEN',
      incluye_igv: false,
      afecto_igv: true,
      forma_pago: 'Contado',
      dias_credito: '0',
    });
    this.lineas.clear();
    for (const l of this.requerimiento().lineas ?? []) this.lineas.push(lineaGroup(l));
    this.isModalOpen.set(true);
  }

  protected editar(c: Cotizacion): void {
    if (!this.puedeEditar()) return;
    this.editando.set(c);
    this.modalError.set('');
    this.form.reset({
      id_proveedor: c.id_proveedor,
      fecha: c.fecha,
      referencia: c.referencia ?? '',
      moneda_id: c.moneda_id === 'USD' ? 'USD' : 'PEN',
      incluye_igv: c.incluye_igv,
      afecto_igv: c.afecto_igv,
      forma_pago: c.forma_pago,
      dias_credito: String(c.dias_credito),
      adelanto_porcentaje: c.adelanto_porcentaje ?? '',
      medio_pago: c.medio_pago ?? '',
      plazo_entrega_dias: c.plazo_entrega_dias === null ? '' : String(c.plazo_entrega_dias),
      validez_dias: c.validez_dias === null ? '' : String(c.validez_dias),
      garantia: c.garantia ?? '',
      condiciones: c.condiciones ?? '',
      archivo_url: c.archivo_url ?? '',
    });
    this.lineas.clear();
    for (const l of this.requerimiento().lineas ?? []) {
      const g = lineaGroup(l);
      const previa = c.lineas.find((x) => x.id_requerimiento_detalle === l.id);
      if (previa) {
        g.patchValue({
          cotiza: previa.cotiza,
          cantidad: previa.cantidad,
          precio_unitario: previa.precio_unitario,
          plazo_entrega_dias: previa.plazo_entrega_dias === null ? '' : String(previa.plazo_entrega_dias),
          marca_modelo: previa.marca_modelo ?? '',
        });
      }
      this.lineas.push(g);
    }
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected guardar(): void {
    const actual = this.editando();
    if (actual ? !this.puedeEditar() : !this.puedeRegistrar()) return;
    const error = this.validar();
    const payload = error ? null : this.armarPayload();
    if (error || !payload) {
      this.modalError.set(error ?? 'Seleccione al proveedor.');
      return;
    }
    const id = this.requerimiento().id;
    this.isSaving.set(true);
    this.modalError.set('');
    const request$ = actual ? this.service.updateCotizacion(id, actual.id, payload) : this.service.createCotizacion(id, payload);
    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeModal();
        this.message.set(actual ? 'Cotización actualizada.' : 'Cotización registrada.');
        this.load();
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.modalError.set(errorMessage(err));
      },
    });
  }

  protected eliminar(c: Cotizacion): void {
    if (!this.puedeEliminar() || !confirm(`¿Eliminar la cotización ${c.numero} de ${c.proveedor ?? 'este proveedor'}?`)) return;
    this.service.deleteCotizacion(this.requerimiento().id, c.id).subscribe({
      next: () => {
        this.message.set('Cotización eliminada.');
        this.load();
        this.changed.emit();
      },
      error: (err: unknown) => alert(errorMessage(err)),
    });
  }

  // ---------------------------------------------------------------- cuadro
  protected cerrar(): void {
    if (!confirm('¿Cerrar el cuadro comparativo? Pasará a COTIZADO y quedará listo para que Administración elija al ganador.')) return;
    this.service.cerrarCotizacion(this.requerimiento().id).subscribe({
      next: () => {
        this.message.set('Cuadro comparativo cerrado.');
        this.changed.emit();
      },
      error: (err: unknown) => alert(errorMessage(err)),
    });
  }

  protected reabrir(): void {
    if (!confirm('¿Reabrir las cotizaciones? Podrá agregar o corregir cotizaciones antes de aprobar.')) return;
    this.service.reabrirCotizacion(this.requerimiento().id).subscribe({
      next: () => {
        this.message.set('Cotizaciones reabiertas.');
        this.changed.emit();
      },
      error: (err: unknown) => alert(errorMessage(err)),
    });
  }

  // ---------------------------------------------------------------- privado
  private validar(): string | null {
    const v = this.form.getRawValue();
    if (!v.id_proveedor) return 'Seleccione al proveedor.';
    if (!v.fecha) return 'Indique la fecha de la cotización.';
    if (!v.forma_pago.trim()) return 'Indique la forma de pago (Contado, Crédito…).';
    const dias = Number(v.dias_credito || 0);
    if (!Number.isInteger(dias) || dias < 0) return 'Los días de crédito deben ser un entero mayor o igual a 0.';
    if (v.adelanto_porcentaje.trim() && !DECIMAL.test(v.adelanto_porcentaje.trim())) return 'El adelanto (%) no es válido.';
    let alguna = false;
    for (const [i, l] of v.lineas.entries()) {
      if (!l.cotiza) continue;
      alguna = true;
      const n = i + 1;
      if (!DECIMAL.test(l.cantidad.trim()) || Number(l.cantidad) <= 0) return `Ítem ${n}: la cantidad debe ser mayor a 0.`;
      if (Number(l.cantidad) > Number(l.solicitada)) return `Ítem ${n}: no puede ofrecer más de lo solicitado (${fmtNum(l.solicitada)}).`;
      if (!DECIMAL.test(l.precio_unitario.trim())) return `Ítem ${n}: indique el precio unitario.`;
    }
    return alguna ? null : 'La cotización debe ofrecer al menos un ítem.';
  }

  /** Payload de la cotización; `null` si falta el proveedor (no ocurre tras `validar`). */
  private armarPayload(): CotizacionPayload | null {
    const v = this.form.getRawValue();
    const texto = (s: string) => s.trim() || undefined;
    const entero = (s: string) => (s.trim() === '' ? undefined : Number(s));
    if (v.id_proveedor === null) return null;
    return {
      id_proveedor: v.id_proveedor,
      fecha: v.fecha,
      referencia: texto(v.referencia),
      moneda_id: v.moneda_id,
      moneda_simbolo: v.moneda_id === 'USD' ? '$' : 'S/',
      incluye_igv: v.incluye_igv,
      afecto_igv: v.afecto_igv,
      forma_pago: v.forma_pago.trim(),
      dias_credito: Number(v.dias_credito || 0),
      adelanto_porcentaje: texto(v.adelanto_porcentaje),
      medio_pago: v.medio_pago || undefined,
      plazo_entrega_dias: entero(v.plazo_entrega_dias),
      validez_dias: entero(v.validez_dias),
      garantia: texto(v.garantia),
      condiciones: texto(v.condiciones),
      archivo_url: texto(v.archivo_url),
      lineas: v.lineas.map((l) => ({
        id_requerimiento_detalle: l.id_requerimiento_detalle,
        cotiza: l.cotiza,
        cantidad: l.cotiza ? l.cantidad.trim() : '0',
        precio_unitario: l.cotiza ? l.precio_unitario.trim() : '0',
        plazo_entrega_dias: entero(l.plazo_entrega_dias),
        marca_modelo: texto(l.marca_modelo),
      })),
    };
  }
}
