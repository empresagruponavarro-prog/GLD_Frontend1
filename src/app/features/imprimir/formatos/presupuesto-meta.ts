import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage, fmtMoney } from '../../almacen/almacen.utils';
import { DetalleFase, PresupuestoCompleto } from '../../presupuestos/interfaces/presupuestos.interface';
import { PresupuestosService } from '../../presupuestos/presupuestos.service';

/** Texto legible del estado normalizado del presupuesto. */
const ESTADOS: Readonly<Record<string, string>> = {
  EN_DESARROLLO: 'En desarrollo',
  EN_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  ENTREGADO: 'Entregado',
  LIQUIDADO: 'Liquidado',
  ANULADO: 'Anulado',
};

/**
 * Formato del **presupuesto Meta** (GRP T68): cabecera, fases con sus categorías y costos, y el resumen económico.
 * Lo usa la ruta `/imprimir/presupuesto-meta/:id` y el dosier de la obra.
 */
@Component({
  selector: 'app-formato-presupuesto-meta',
  standalone: true,
  styleUrl: './formato.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recurso.error()) {
      <p class="imp-error" role="alert">{{ error() }}</p>
    } @else if (recurso.isLoading() || !p()) {
      <p>Cargando presupuesto…</p>
    } @else {
      @let d = p()!;
      <section class="imp-seccion" data-testid="formato-presupuesto-meta">
        <h2 class="imp-sub">Presupuesto Meta {{ d.IdPresupuesto }}{{ d.numero_version && d.numero_version > 1 ? ' · versión ' + d.numero_version : '' }}</h2>
        <table class="imp-grid">
          <tr><th>Proyecto</th><td>{{ d.Proyecto ?? '—' }}</td><th>Tipo</th><td>{{ d.TipoPpto ?? 'Principal' }}</td></tr>
          <tr><th>Cliente</th><td>{{ d.Cliente ?? d.CodigoAnexo ?? '—' }}</td><th>Periodo</th><td>{{ d.periodo ?? '—' }}</td></tr>
          <tr><th>Estado</th><td>{{ estado() }}</td><th>Aprobación</th><td>{{ d.aprobado_por ? d.aprobado_por + ' · ' + (d.fecha_aprobacion ?? '').slice(0, 10) : '—' }}</td></tr>
          @if (d.Concepto) { <tr><th>Concepto</th><td colspan="3">{{ d.Concepto }}</td></tr> }
        </table>

        <table class="imp-table">
          <thead><tr><th>Fase / partida</th><th class="num">Ítems</th><th class="num">Costo directo</th></tr></thead>
          <tbody>
            @for (f of fases(); track f.id) {
              <tr class="imp-total"><td>{{ f.NombreFase ?? f.FaseProyecto ?? f.IdpptoFase }}</td><td class="num"></td><td class="num">{{ fmt(f.CostoDirecto) }}</td></tr>
              @for (c of f.categorias ?? []; track c.id) {
                <tr><td>&nbsp;&nbsp;{{ nombreCategoria(c) }}</td><td class="num">{{ c.totalItems ?? 0 }}</td><td class="num">{{ fmt(c.CostoDirecto) }}</td></tr>
              }
            } @empty {
              <tr><td colspan="3">El presupuesto no tiene fases.</td></tr>
            }
          </tbody>
        </table>

        <table class="imp-resumen">
          <tr><th>Costo directo</th><td>{{ fmt(d.CostoDirecto) }}</td></tr>
          <tr><th>Gastos generales ({{ d.GGPorcentaje ?? 0 }} %)</th><td>{{ fmt(d.GastosGenerales) }}</td></tr>
          <tr><th>Utilidad ({{ d.UtiliPorcentaje ?? 0 }} %)</th><td>{{ fmt(d.Utilidad) }}</td></tr>
          <tr><th>Viáticos</th><td>{{ fmt(d.Viaticos) }}</td></tr>
          @if (d.DsctoComercial) { <tr><th>Descuento comercial</th><td>- {{ fmt(d.DsctoComercial) }}</td></tr> }
          <tr><th>Subtotal sin IGV</th><td>{{ fmt(d.SubTotalSinIGV) }}</td></tr>
          <tr><th>IGV</th><td>{{ fmt(d.IGV) }}</td></tr>
          <tr class="imp-total"><th>Total</th><td>{{ fmt(d.Total) }}</td></tr>
        </table>
      </section>
    }
  `,
})
export class FormatoPresupuestoMetaComponent {
  readonly #presupuestos = inject(PresupuestosService);

  /** `IdPresupuesto` (código) o id numérico. */
  readonly presupuesto = input.required<string | number>();

  protected readonly recurso = rxResource<PresupuestoCompleto, string | number>({
    params: () => this.presupuesto(),
    stream: ({ params }) => this.#presupuestos.getPresupuestoCompleto(params),
  });

  protected readonly p = computed(() => (this.recurso.hasValue() ? this.recurso.value() : undefined));
  protected readonly fases = computed<DetalleFase[]>(() => this.p()?.fases ?? []);
  protected readonly estado = computed(() => ESTADOS[this.p()?.estado_ppto ?? ''] ?? this.p()?.Estado ?? '—');
  protected readonly error = computed(() => errorMessage(this.recurso.error()));
  protected readonly fmt = (v: string | number | null | undefined) => fmtMoney(v ?? 0);

  protected nombreCategoria(c: { Descripcion?: string; CategoriaInsumo?: string; categoria?: { descripcion?: string } | null }): string {
    return c.Descripcion ?? c.CategoriaInsumo ?? c.categoria?.descripcion ?? '(sin nombre)';
  }
}
