import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import {
  CotizacionFormDialogComponent,
  CotizacionFormValue,
  CotizacionInicial,
  LineaCotizable,
} from '../../../shared/components/cotizacion-form-dialog/cotizacion-form-dialog';
import { errorMessage, fmtMoney, fmtNum } from '../../almacen/almacen.utils';
import { Cotizacion, CotizacionPayload, MEDIO_PAGO_LABEL, Requerimiento, SelectOption } from '../requerimientos.models';
import { RequerimientosService } from '../requerimientos.service';

/**
 * Cotizaciones de un FUR de compra: de 1 a n proveedores. El sistema solo muestra los datos;
 * quien aprueba elige al ganador según precio, forma de pago, medio de pago y disponibilidad.
 * El formulario es el diálogo compartido `app-cotizacion-form-dialog` (el mismo de las cotizaciones del presupuesto).
 */
@Component({
  selector: 'app-cotizaciones-panel',
  standalone: true,
  imports: [RouterLink, CotizacionFormDialogComponent],
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

  /** Las líneas del FUR, como las pide el diálogo. */
  protected readonly lineasCotizables = computed<LineaCotizable[]>(() =>
    (this.requerimiento().lineas ?? []).map((l) => ({
      id: l.id,
      codigo: l.codigo,
      descripcion: l.descripcion,
      unidad: l.unidad,
      solicitado: l.cantidad,
      precio_ref: l.precio_referencial,
    })),
  );

  /** La cotización que se edita, como la pide el diálogo (`null` = una nueva). */
  protected readonly inicial = computed<CotizacionInicial | null>(() => {
    const c = this.editando();
    if (!c) return null;
    return {
      id_proveedor: c.id_proveedor,
      fecha: c.fecha,
      referencia: c.referencia,
      moneda_id: c.moneda_id,
      incluye_igv: c.incluye_igv,
      afecto_igv: c.afecto_igv,
      forma_pago: c.forma_pago,
      dias_credito: c.dias_credito,
      adelanto_porcentaje: c.adelanto_porcentaje,
      medio_pago: c.medio_pago,
      plazo_entrega_dias: c.plazo_entrega_dias,
      validez_dias: c.validez_dias,
      garantia: c.garantia,
      condiciones: c.condiciones,
      archivo_url: c.archivo_url,
      lineas: c.lineas.map((l) => ({
        id: l.id_requerimiento_detalle,
        cotiza: l.cotiza,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        plazo_entrega_dias: l.plazo_entrega_dias,
        marca_modelo: l.marca_modelo,
      })),
    };
  });

  constructor() {
    this.service.getProveedoresSelect().subscribe({ next: (r) => this.proveedores.set(r), error: () => this.proveedores.set([]) });
    effect(() => {
      const id = this.requerimiento().id;
      untracked(() => this.load(id));
    });
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
    this.isModalOpen.set(true);
  }

  protected editar(c: Cotizacion): void {
    if (!this.puedeEditar()) return;
    this.editando.set(c);
    this.modalError.set('');
    this.isModalOpen.set(true);
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
  }

  protected guardar(valor: CotizacionFormValue): void {
    const actual = this.editando();
    if (actual ? !this.puedeEditar() : !this.puedeRegistrar()) return;
    const payload = this.aPayload(valor);
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
  /** El valor del diálogo es el mismo para FUR y presupuesto; aquí cada línea apunta a una línea del FUR. */
  private aPayload(v: CotizacionFormValue): CotizacionPayload {
    return {
      id_proveedor: v.id_proveedor,
      fecha: v.fecha,
      referencia: v.referencia,
      moneda_id: v.moneda_id,
      moneda_simbolo: v.moneda_simbolo,
      incluye_igv: v.incluye_igv,
      afecto_igv: v.afecto_igv,
      forma_pago: v.forma_pago,
      dias_credito: v.dias_credito,
      adelanto_porcentaje: v.adelanto_porcentaje,
      medio_pago: v.medio_pago,
      plazo_entrega_dias: v.plazo_entrega_dias,
      validez_dias: v.validez_dias,
      garantia: v.garantia,
      condiciones: v.condiciones,
      archivo_url: v.archivo_url,
      lineas: v.lineas.map((l) => ({
        id_requerimiento_detalle: l.id,
        cotiza: l.cotiza,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        plazo_entrega_dias: l.plazo_entrega_dias,
        marca_modelo: l.marca_modelo,
      })),
    };
  }
}
