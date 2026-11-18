import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { fmtMoney, fmtNum, todayISO } from '../../../features/almacen/almacen.utils';
import { MEDIOS_PAGO, MEDIO_PAGO_LABEL, MedioPago, SelectOption } from '../../../features/requerimientos/requerimientos.models';
import { ModalComponent } from '../modal/modal';
import { SearchSelectComponent } from '../search-select/search-select';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;

/** Una línea que se puede cotizar: la de un FUR o un ítem de un presupuesto. */
export interface LineaCotizable {
  /** Id de la línea de FUR o del ítem del presupuesto: vuelve en el payload. */
  id: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  /** Cantidad pedida (FUR) o del ítem (presupuesto): lo máximo que se puede ofrecer. */
  solicitado: string;
  /** Precio de referencia: el del FUR o el costo unitario del Meta. */
  precio_ref: string | null;
  subfase?: string | null;
  /** Proveedor que hoy gana el ítem (solo presupuesto). */
  ganador?: string | null;
}

export interface CotizacionInicialLinea {
  id: number;
  cotiza: boolean;
  cantidad: string;
  precio_unitario: string;
  plazo_entrega_dias: number | null;
  marca_modelo: string | null;
  /** Esta cotización es la ganadora del ítem (solo presupuesto). */
  adjudicada?: boolean;
}

/** Una cotización ya registrada que se edita. */
export interface CotizacionInicial {
  id_proveedor: number;
  fecha: string;
  referencia: string | null;
  moneda_id: string;
  incluye_igv: boolean;
  afecto_igv: boolean;
  forma_pago: string;
  dias_credito: number;
  adelanto_porcentaje: string | null;
  medio_pago: MedioPago | null;
  plazo_entrega_dias: number | null;
  validez_dias: number | null;
  garantia: string | null;
  condiciones: string | null;
  archivo_url: string | null;
  lineas: CotizacionInicialLinea[];
}

export interface CotizacionFormLinea {
  id: number;
  cotiza: boolean;
  cantidad: string;
  precio_unitario: string;
  plazo_entrega_dias?: number;
  marca_modelo?: string;
  /** Solo en modo presupuesto: true = gana el ítem; false = lo suelta si lo ganaba. */
  adjudicar?: boolean;
}

export interface CotizacionFormValue {
  id_proveedor: number;
  fecha: string;
  referencia?: string;
  moneda_id: 'PEN' | 'USD';
  moneda_simbolo: string;
  incluye_igv: boolean;
  afecto_igv: boolean;
  forma_pago: string;
  dias_credito: number;
  adelanto_porcentaje?: string;
  medio_pago?: MedioPago;
  plazo_entrega_dias?: number;
  validez_dias?: number;
  garantia?: string;
  condiciones?: string;
  archivo_url?: string;
  lineas: CotizacionFormLinea[];
}

function lineaGroup(l: LineaCotizable) {
  return new FormGroup({
    id: new FormControl(l.id, { nonNullable: true }),
    etiqueta: new FormControl(`${l.codigo} — ${l.descripcion}`, { nonNullable: true }),
    unidad: new FormControl(l.unidad, { nonNullable: true }),
    solicitada: new FormControl(l.solicitado, { nonNullable: true }),
    cotiza: new FormControl(true, { nonNullable: true }),
    cantidad: new FormControl(l.solicitado, { nonNullable: true, validators: [Validators.pattern(DECIMAL)] }),
    precio_unitario: new FormControl('', { nonNullable: true }),
    plazo_entrega_dias: new FormControl('', { nonNullable: true }),
    marca_modelo: new FormControl('', { nonNullable: true }),
    adjudicar: new FormControl(false, { nonNullable: true }),
  });
}

type LineaGroup = ReturnType<typeof lineaGroup>;

/**
 * Formulario «Registrar cotización» de un proveedor, compartido por las cotizaciones de un FUR y las de un presupuesto (plan 09, lámina 5).
 * No guarda nada: valida y devuelve el valor por `guardar`; quien lo usa llama al servicio y le pasa `guardando` y `error`.
 */
@Component({
  selector: 'app-cotizacion-form-dialog',
  imports: [ReactiveFormsModule, ModalComponent, SearchSelectComponent],
  templateUrl: './cotizacion-form-dialog.html',
  styleUrl: './cotizacion-form-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CotizacionFormDialogComponent {
  readonly abierto = input(false);
  readonly titulo = input('Registrar cotización');
  /** `fur`: líneas de un requerimiento. `presupuesto`: ítems de una fase (agrega la columna «Adjudicar»). */
  readonly modo = input<'fur' | 'presupuesto'>('fur');
  readonly lineas = input<LineaCotizable[]>([]);
  readonly proveedores = input<SelectOption[]>([]);
  /** Cotización que se edita; `null` = una nueva. */
  readonly inicial = input<CotizacionInicial | null>(null);
  /** Ítems que se marcan para cotizar al abrir una cotización nueva (vacío = todos). Solo presupuesto. */
  readonly marcadas = input<number[]>([]);
  readonly guardando = input(false);
  readonly error = input('');

  readonly guardar = output<CotizacionFormValue>();
  readonly cancelar = output<void>();

  protected readonly fmtMoney = fmtMoney;
  protected readonly fmtNum = fmtNum;
  protected readonly medios = MEDIOS_PAGO;
  protected readonly medioLabel = MEDIO_PAGO_LABEL;
  protected readonly esPresupuesto = computed(() => this.modo() === 'presupuesto');
  protected readonly errorLocal = signal('');
  protected readonly mensajeError = computed(() => this.errorLocal() || this.error());

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
    // Cada vez que se abre, el formulario se arma de nuevo con las líneas y la cotización que llegan.
    effect(() => {
      if (!this.abierto()) return;
      untracked(() => this.armar());
    });
  }

  protected get lineasForm(): FormArray<LineaGroup> {
    return this.form.controls.lineas;
  }

  /** Precio de referencia de la línea i (solo lectura). */
  protected precioRef(i: number): string | null {
    return this.lineas()[i]?.precio_ref ?? null;
  }

  protected subfase(i: number): string | null {
    return this.lineas()[i]?.subfase ?? null;
  }

  protected ganador(i: number): string | null {
    return this.lineas()[i]?.ganador ?? null;
  }

  protected onGuardar(): void {
    const error = this.validar();
    if (error) {
      this.errorLocal.set(error);
      return;
    }
    this.errorLocal.set('');
    const payload = this.armarPayload();
    if (payload) this.guardar.emit(payload);
  }

  protected onCancelar(): void {
    this.errorLocal.set('');
    this.cancelar.emit();
  }

  // ---------------------------------------------------------------- privado
  private armar(): void {
    const c = this.inicial();
    this.errorLocal.set('');
    if (c) {
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
    } else {
      this.form.reset({
        id_proveedor: null,
        fecha: todayISO(),
        referencia: '',
        moneda_id: 'PEN',
        incluye_igv: false,
        afecto_igv: true,
        forma_pago: 'Contado',
        dias_credito: '0',
        adelanto_porcentaje: '',
        medio_pago: '',
        plazo_entrega_dias: '',
        validez_dias: '',
        garantia: '',
        condiciones: '',
        archivo_url: '',
      });
    }
    this.lineasForm.clear();
    const marcadas = this.marcadas();
    for (const l of this.lineas()) {
      const g = lineaGroup(l);
      const previa = c?.lineas.find((x) => x.id === l.id);
      if (c) {
        // Al editar, una línea que la cotización no tenía queda sin cotizar; las demás traen lo que ya se registró.
        g.patchValue({
          cotiza: previa?.cotiza ?? false,
          cantidad: previa?.cantidad ?? l.solicitado,
          precio_unitario: previa?.precio_unitario ?? '',
          plazo_entrega_dias: previa?.plazo_entrega_dias == null ? '' : String(previa.plazo_entrega_dias),
          marca_modelo: previa?.marca_modelo ?? '',
          adjudicar: previa?.adjudicada ?? false,
        });
      } else if (this.esPresupuesto()) {
        const cotiza = marcadas.length === 0 || marcadas.includes(l.id);
        // Se propone adjudicar los ítems que todavía no tienen proveedor; el usuario lo ajusta.
        g.patchValue({ cotiza, adjudicar: cotiza && !l.ganador });
      }
      this.lineasForm.push(g);
    }
  }

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
      if (this.esPresupuesto() && l.adjudicar && Math.abs(Number(l.cantidad) - Number(l.solicitada)) > 0.005) {
        return `Ítem ${n}: para adjudicarlo debe cotizar la cantidad completa (${fmtNum(l.solicitada)}): un ítem va completo a un solo proveedor.`;
      }
    }
    for (const [i, l] of v.lineas.entries()) {
      if (this.esPresupuesto() && l.adjudicar && !l.cotiza) return `Ítem ${i + 1}: no puede adjudicarlo si el proveedor no lo cotiza.`;
    }
    return alguna ? null : 'La cotización debe ofrecer al menos un ítem.';
  }

  private armarPayload(): CotizacionFormValue | null {
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
        id: l.id,
        cotiza: l.cotiza,
        cantidad: l.cotiza ? l.cantidad.trim() : '0',
        precio_unitario: l.cotiza ? l.precio_unitario.trim() : '0',
        plazo_entrega_dias: entero(l.plazo_entrega_dias),
        marca_modelo: texto(l.marca_modelo),
        ...(this.esPresupuesto() ? { adjudicar: l.adjudicar } : {}),
      })),
    };
  }
}
