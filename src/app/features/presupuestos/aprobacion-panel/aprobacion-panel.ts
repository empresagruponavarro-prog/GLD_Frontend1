import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  AprobarPresupuestoResponse,
  EstadoPresupuesto,
  LimpiarVaciosResponse,
  NuevaVersionResponse,
  presupuestoAprobado,
  PresupuestosService,
} from '../presupuestos.service';
import { mensajeDeError } from '../presupuestos.orchestration';

type Accion = 'aprobar' | 'limpiar' | 'version';

const ETIQUETA_ESTADO: Record<EstadoPresupuesto, string> = {
  EN_DESARROLLO: 'En desarrollo',
  EN_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  ENTREGADO: 'Entregado',
  LIQUIDADO: 'Liquidado',
  ANULADO: 'Anulado',
};

/** Cuántos pendientes se listan antes de resumir el resto («y N más»). */
const MAX_PROBLEMAS_VISIBLES = 6;

/**
 * Panel de aprobación del presupuesto (GRP, paso 5 del asistente): qué falta para poder aprobarlo, «Limpiar vacíos»,
 * «Aprobar» (captura la estructura de la obra) y «Nueva versión». Las reglas las decide el backend (`GET :id/validacion`);
 * aquí solo se muestran y se piden las acciones, cada una con su permiso (limpiar → editar, aprobar → aprobar, versión → crear).
 */
@Component({
  selector: 'app-aprobacion-panel',
  standalone: true,
  templateUrl: './aprobacion-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AprobacionPanelComponent {
  readonly #service = inject(PresupuestosService);

  /** Código `IdPresupuesto` (o id) del presupuesto guardado. */
  readonly idPresupuesto = input.required<string>();
  readonly puedeEditar = input(false);
  readonly puedeAprobar = input(false);
  readonly puedeCrear = input(false);

  readonly aprobado = output<AprobarPresupuestoResponse>();
  readonly limpiado = output<LimpiarVaciosResponse>();
  readonly versionCreada = output<NuevaVersionResponse>();

  protected readonly refresco = signal(0);
  protected readonly ocupado = signal(false);
  protected readonly error = signal('');
  /** Acción que espera confirmación (segundo clic). */
  protected readonly confirmando = signal<Accion | null>(null);
  protected readonly ultimoAprobado = signal<AprobarPresupuestoResponse | null>(null);
  protected readonly ultimoLimpiado = signal<LimpiarVaciosResponse | null>(null);

  protected readonly validacionRes = rxResource({
    params: () => ({ id: this.idPresupuesto(), n: this.refresco() }),
    stream: ({ params }) => this.#service.getValidacion(params.id),
  });

  protected readonly validacion = computed(() => (this.validacionRes.hasValue() ? this.validacionRes.value() : null));
  protected readonly yaAprobado = computed(() => presupuestoAprobado(this.validacion()?.estado_ppto));
  protected readonly etiquetaEstado = computed(() => {
    const e = this.validacion()?.estado_ppto;
    return e ? ETIQUETA_ESTADO[e] : '';
  });
  protected readonly problemasVisibles = computed(() => (this.validacion()?.problemas ?? []).slice(0, MAX_PROBLEMAS_VISIBLES));
  protected readonly problemasOcultos = computed(() => Math.max(0, (this.validacion()?.problemas.length ?? 0) - MAX_PROBLEMAS_VISIBLES));
  /** Se puede limpiar si hay categorías sin ítems o ítems en cero entre los pendientes. */
  protected readonly hayVacios = computed(() => (this.validacion()?.problemas ?? []).some((p) => p.codigo === 'CATEGORIA_SIN_ITEMS' || p.codigo === 'ITEM_VACIO'));
  protected readonly esPrincipal = computed(() => this.validacion()?.tipo === 'Principal');
  protected readonly errorCarga = computed(() => (this.validacionRes.error() ? mensajeDeError(this.validacionRes.error()) : ''));

  protected verificar(): void {
    this.error.set('');
    this.confirmando.set(null);
    this.refresco.update((n) => n + 1);
  }

  /** Primer clic pide confirmación; el segundo ejecuta. */
  protected pedir(accion: Accion): void {
    this.error.set('');
    if (this.confirmando() === accion) {
      this.confirmando.set(null);
      this.ejecutar(accion);
    } else {
      this.confirmando.set(accion);
    }
  }

  protected cancelar(): void {
    this.confirmando.set(null);
  }

  private ejecutar(accion: Accion): void {
    const id = this.idPresupuesto();
    this.ocupado.set(true);
    const fin = () => {
      this.ocupado.set(false);
      this.refresco.update((n) => n + 1);
    };
    const falla = (e: unknown) => {
      this.error.set(mensajeDeError(e));
      fin();
    };
    if (accion === 'aprobar') {
      this.#service.aprobar(id).subscribe({
        next: (r) => {
          this.ultimoAprobado.set(r);
          this.ultimoLimpiado.set(null);
          this.aprobado.emit(r);
          fin();
        },
        error: falla,
      });
    } else if (accion === 'limpiar') {
      this.#service.limpiarVacios(id).subscribe({
        next: (r) => {
          this.ultimoLimpiado.set(r);
          this.limpiado.emit(r);
          fin();
        },
        error: falla,
      });
    } else {
      this.#service.nuevaVersion(id).subscribe({
        next: (r) => {
          this.versionCreada.emit(r);
          fin();
        },
        error: falla,
      });
    }
  }
}
