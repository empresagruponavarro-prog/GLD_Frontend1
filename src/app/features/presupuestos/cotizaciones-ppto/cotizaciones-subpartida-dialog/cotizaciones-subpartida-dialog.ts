import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import {
  CotizacionFormDialogComponent,
  CotizacionFormValue,
  CotizacionInicial,
  LineaCotizable,
} from '../../../../shared/components/cotizacion-form-dialog/cotizacion-form-dialog';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { errorMessage, fmtMoney, fmtNum } from '../../../almacen/almacen.utils';
import { SelectOption } from '../../../requerimientos/requerimientos.models';
import { RequerimientosService } from '../../../requerimientos/requerimientos.service';
import {
  CuadroComparativoPpto,
  CuadroLineaPpto,
  CuadroOfertaPpto,
  CuadroProveedorPpto,
  PptoCotizacion,
  PptoCotizacionPayload,
  resumenConciliacion,
} from '../cotizaciones-ppto.models';
import { CotizacionesPptoService } from '../cotizaciones-ppto.service';

/** Estados en los que el presupuesto ya no admite cotizaciones ni cambios de proveedor. */
const ESTADOS_CERRADOS = ['ENTREGADO', 'LIQUIDADO', 'ANULADO'];

/**
 * Cotizaciones de una subpartida del presupuesto Meta (plan 09): cada proveedor cotiza UN total por toda la subpartida, el sistema lo
 * prorratea entre sus ítems según el costo Meta, y quien aprueba elige un solo ganador para la subpartida completa. Al grabar se
 * generan el FUR y las órdenes (provisionales hasta aprobar el presupuesto). El sistema no sugiere ni exige el más barato.
 */
@Component({
  selector: 'app-cotizaciones-subpartida-dialog',
  imports: [FormsModule, RouterLink, ModalComponent, CotizacionFormDialogComponent],
  templateUrl: './cotizaciones-subpartida-dialog.html',
  styleUrl: './cotizaciones-subpartida-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CotizacionesSubpartidaDialogComponent implements OnInit {
  private readonly service = inject(CotizacionesPptoService);
  private readonly requerimientos = inject(RequerimientosService);
  /** Módulo `presupuestos`: registrar → crear; editar y elegir ganador → editar; eliminar → eliminar. */
  protected readonly permisos = permisosDePantalla('presupuestos');

  readonly idPresupuesto = input.required<number>();
  /** La subpartida (`ppto_DetalleFasesCate.id`) cuyas cotizaciones se ven. */
  readonly idDetalleCategoria = input.required<number>();
  /** Abre directamente el formulario de una cotización nueva. */
  readonly abrirRegistro = input(false);

  readonly cerrar = output<void>();
  /** Algo cambió (cotización o ganador): quien abrió el diálogo puede recargar sus datos. */
  readonly cambio = output<void>();

  protected readonly fmtMoney = fmtMoney;
  protected readonly fmtNum = fmtNum;

  protected readonly cuadro = signal<CuadroComparativoPpto | null>(null);
  protected readonly cotizaciones = signal<PptoCotizacion[]>([]);
  protected readonly proveedores = signal<SelectOption[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');

  /** Ganador elegido y todavía sin guardar: `undefined` = sin cambio; `null` = quitar el ganador. */
  protected readonly eleccion = signal<number | null | undefined>(undefined);
  protected readonly comentario = signal('');
  protected readonly guardandoAdjudicacion = signal(false);

  protected readonly formAbierto = signal(false);
  protected readonly editando = signal<PptoCotizacion | null>(null);
  protected readonly guardandoForm = signal(false);
  protected readonly errorForm = signal('');

  protected readonly estado = computed(() => this.cuadro()?.estado ?? '');
  /** El presupuesto todavía admite cotizar y cambiar proveedores. */
  protected readonly abierto = computed(() => !!this.cuadro() && !ESTADOS_CERRADOS.includes(this.estado()));
  protected readonly puedeRegistrar = computed(() => this.abierto() && this.permisos.crear());
  protected readonly puedeEditar = computed(() => this.abierto() && this.permisos.editar());
  protected readonly puedeEliminar = computed(() => this.abierto() && this.permisos.eliminar());

  /** Algún ítem de la subpartida ya tiene una orden registrada: el proveedor no cambia mientras no se anule. */
  protected readonly cubierta = computed(() => (this.cuadro()?.lineas ?? []).some((l) => l.cubierto));
  /** Ganador de la subpartida ahora (con lo elegido y todavía sin guardar). */
  protected readonly ganadora = computed(() => {
    const e = this.eleccion();
    return e === undefined ? (this.cuadro()?.id_cotizacion_ganadora ?? null) : e;
  });
  protected readonly hayCambio = computed(() => this.eleccion() !== undefined && this.eleccion() !== (this.cuadro()?.id_cotizacion_ganadora ?? null));
  protected readonly puedeElegir = computed(() => this.abierto() && this.permisos.editar() && !this.cubierta());
  protected readonly proveedorGanador = computed(() => this.cuadro()?.proveedores.find((p) => p.id_cotizacion === this.ganadora()) ?? null);
  /** Costo total de la subpartida en el Meta (la base del prorrateo). */
  protected readonly costoMeta = computed(() => (this.cuadro()?.lineas ?? []).reduce((s, l) => s + Number(l.costo_total_meta), 0));

  protected readonly lineasCotizables = computed<LineaCotizable[]>(() => {
    const c = this.cuadro();
    if (!c) return [];
    const nombrePorCot = new Map(c.proveedores.map((p) => [p.id_cotizacion, p.proveedor]));
    return c.lineas.map((l) => ({
      id: l.id_ppto_item,
      codigo: l.codigo,
      descripcion: l.descripcion,
      unidad: l.unidad,
      solicitado: l.cantidad,
      precio_ref: l.costo_unitario_meta,
      costo_total: l.costo_total_meta,
      subfase: l.subfase,
      ganador: l.id_cotizacion_ganadora === null ? null : (nombrePorCot.get(l.id_cotizacion_ganadora) ?? null),
    }));
  });

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
      lineas: [],
      total_global: c.total_global,
      adjudicada: c.id === this.cuadro()?.id_cotizacion_ganadora,
    };
  });

  protected readonly tituloForm = computed(() => {
    const c = this.editando();
    return c ? `Editar cotización ${c.numero}` : 'Registrar cotización';
  });

  ngOnInit(): void {
    this.requerimientos.getProveedoresSelect().subscribe({ next: (r) => this.proveedores.set(r), error: () => this.proveedores.set([]) });
    this.cargar(() => {
      if (this.abrirRegistro() && this.puedeRegistrar()) this.nueva();
    });
  }

  // ---------------------------------------------------------------- lectura
  protected cargar(despues?: () => void): void {
    this.cargando.set(true);
    this.error.set('');
    const idP = this.idPresupuesto();
    const idS = this.idDetalleCategoria();
    this.service.getCuadro(idP, idS).subscribe({
      next: (c) => {
        this.cuadro.set(c);
        this.eleccion.set(undefined);
        this.service.getCotizaciones(idP, { idDetalleCategoria: idS }).subscribe({
          next: (cs) => {
            this.cotizaciones.set(cs);
            this.cargando.set(false);
            despues?.();
          },
          error: (err: unknown) => {
            this.cargando.set(false);
            this.error.set(errorMessage(err));
          },
        });
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  /** Lo que ofrece un proveedor por un ítem (su parte del total prorrateado). */
  protected oferta(l: CuadroLineaPpto, idCotizacion: number): CuadroOfertaPpto | undefined {
    return l.ofertas.find((o) => o.id_cotizacion === idCotizacion && o.cotiza);
  }

  /** Diferencia del total sin IGV de un proveedor contra el costo Meta de la subpartida (sin convertir moneda). */
  protected diferencia(p: CuadroProveedorPpto): number {
    return Number(p.total_sin_igv) - this.costoMeta();
  }

  /** FUR y orden que ya nacieron de la subpartida (el del primer ítem que los tiene). */
  protected compromiso() {
    return this.cuadro()?.lineas.find((l) => l.compromiso !== null)?.compromiso ?? null;
  }

  // ---------------------------------------------------------------- elegir ganador
  protected elegir(idCotizacion: number | null): void {
    if (!this.puedeElegir()) return;
    // Volver a lo que ya estaba guardado deja de ser un cambio.
    this.eleccion.set(idCotizacion === (this.cuadro()?.id_cotizacion_ganadora ?? null) ? undefined : idCotizacion);
  }

  protected guardarAdjudicacion(): void {
    const e = this.eleccion();
    if (e === undefined || !this.hayCambio() || !this.permisos.editar()) return;
    this.guardandoAdjudicacion.set(true);
    this.error.set('');
    this.service
      .adjudicar(this.idPresupuesto(), { id_detalle_categoria: this.idDetalleCategoria(), id_cotizacion: e, comentario: this.comentario().trim() || undefined })
      .subscribe({
        next: (r) => {
          this.guardandoAdjudicacion.set(false);
          this.comentario.set('');
          this.mensaje.set(this.textoGrabado(e === null ? 'Se quitó el proveedor de la subpartida.' : 'Proveedor de la subpartida guardado.', resumenConciliacion(r.compromisos)));
          this.cargar();
          this.cambio.emit();
        },
        error: (err: unknown) => {
          this.guardandoAdjudicacion.set(false);
          this.error.set(errorMessage(err));
        },
      });
  }

  // ---------------------------------------------------------------- cotizaciones
  protected nueva(): void {
    if (!this.puedeRegistrar()) return;
    this.editando.set(null);
    this.errorForm.set('');
    this.formAbierto.set(true);
  }

  protected editar(c: PptoCotizacion): void {
    if (!this.puedeEditar() || c.protegida) return;
    this.editando.set(c);
    this.errorForm.set('');
    this.formAbierto.set(true);
  }

  protected cerrarForm(): void {
    this.formAbierto.set(false);
  }

  protected guardarCotizacion(v: CotizacionFormValue): void {
    const actual = this.editando();
    const { lineas: _lineas, total, ...cabecera } = v;
    const payload: PptoCotizacionPayload = { ...cabecera, total: total ?? '' };
    this.guardandoForm.set(true);
    this.errorForm.set('');
    const peticion$ = actual
      ? this.service.updateCotizacion(this.idPresupuesto(), actual.id, payload)
      : this.service.createCotizacion(this.idPresupuesto(), { ...payload, id_detalle_categoria: this.idDetalleCategoria() });
    peticion$.subscribe({
      next: (r) => {
        this.guardandoForm.set(false);
        this.formAbierto.set(false);
        this.mensaje.set(this.textoGrabado(actual ? 'Cotización actualizada.' : 'Cotización registrada.', resumenConciliacion(r.compromisos)));
        this.cargar();
        this.cambio.emit();
      },
      error: (err: unknown) => {
        this.guardandoForm.set(false);
        this.errorForm.set(errorMessage(err));
      },
    });
  }

  protected eliminar(c: PptoCotizacion): void {
    if (!this.puedeEliminar() || c.protegida) return;
    if (!confirm(`¿Eliminar la cotización ${c.numero} de ${c.proveedor ?? 'este proveedor'}? Si ganaba la subpartida, quedará sin proveedor.`)) return;
    this.service.deleteCotizacion(this.idPresupuesto(), c.id).subscribe({
      next: (r) => {
        this.mensaje.set(this.textoGrabado('Cotización eliminada.', resumenConciliacion(r.compromisos)));
        this.cargar();
        this.cambio.emit();
      },
      error: (err: unknown) => this.error.set(errorMessage(err)),
    });
  }

  protected cotizacionCompleta(idCotizacion: number): PptoCotizacion | undefined {
    return this.cotizaciones().find((c) => c.id === idCotizacion);
  }

  protected onCerrar(): void {
    this.cerrar.emit();
  }

  private textoGrabado(base: string, compromisos: string): string {
    return compromisos ? `${base} ${compromisos}.` : base;
  }
}
