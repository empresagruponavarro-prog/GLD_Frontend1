import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage } from '../../almacen/almacen.utils';
import { ObraService } from '../../centros-costos/obra-cockpit/obra.service';
import { ControlObra } from '../../centros-costos/obra-cockpit/obra-control.interface';
import { etiquetaEstadoObra, fechaCorta, fraseCurvaS, geometriaCurvaS, pctMostrado, textoDesviacion } from '../../centros-costos/obra-cockpit/obra-control.calc';

/**
 * Formato del **informe de avance** (GRP T80): resumen de la obra, partidas con su avance y la Curva S en SVG. Calcula con
 * el mismo motor que el cockpit (nada se guarda). Lo usa la ruta `/imprimir/informe-avance/:id` y el dosier.
 */
@Component({
  selector: 'app-formato-informe-avance',
  standalone: true,
  styleUrl: './formato.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recurso.error()) {
      <p class="imp-error" role="alert">{{ error() }}</p>
    } @else if (recurso.isLoading() || !c()) {
      <p>Cargando informe de avance…</p>
    } @else {
      @let ctl = c()!;
      <section class="imp-seccion" data-testid="formato-informe-avance">
        <h2 class="imp-sub">Informe de avance</h2>
        @if (!ctl.resultado) {
          <p class="imp-aviso" data-testid="informe-sin-control">La obra aún no participa del control de avance: falta cargar su estructura y sus fechas.</p>
        } @else {
          @let r = ctl.resultado;
          <table class="imp-grid">
            <tr><th>Estado</th><td>{{ estado() }}</td><th>Corte</th><td>{{ fecha(r.corte) }}</td></tr>
            <tr><th>Avance real</th><td>{{ pct(r.real) }} %</td><th>Programado</th><td>{{ pct(r.programado) }} %</td></tr>
            <tr><th>Desviación</th><td>{{ desviacion(r.desviacion) }}</td><th>Situación</th><td>{{ r.situacion.texto }}</td></tr>
            <tr><th>Semana</th><td>{{ r.semana.texto }}</td><th>Fin vigente</th><td>{{ fecha(r.plazos.finVigente) }}{{ r.plazos.diasReprogramados > 0 ? ' (reprogramado ' + r.plazos.diasReprogramados + ' d)' : '' }}</td></tr>
          </table>

          <h3 class="imp-sub">Partidas</h3>
          <table class="imp-table">
            <thead><tr><th>Ítem</th><th>Partida</th><th>Inicio</th><th>Fin</th><th class="num">Peso</th><th class="num">Programado</th><th class="num">Real</th><th>Situación</th></tr></thead>
            <tbody>
              @for (p of r.partidas; track p.item) {
                <tr class="imp-total">
                  <td>{{ p.item }}</td><td>{{ p.nombre }}</td><td>{{ fecha(p.inicio) }}</td><td>{{ fecha(p.fin) }}</td>
                  <td class="num">{{ p.pesoPct ?? '—' }}{{ (p.pesoPct ?? null) !== null ? ' %' : '' }}</td>
                  <td class="num">{{ pct(p.programado) }} %</td><td class="num">{{ pct(p.real) }} %</td><td>{{ p.situacion.texto }}</td>
                </tr>
                @for (s of p.subpartidas; track s.item) {
                  <tr>
                    <td>{{ s.item }}</td><td>&nbsp;&nbsp;{{ s.nombre }}</td><td>{{ fecha(s.inicio) }}</td><td>{{ fecha(s.fin) }}</td>
                    <td class="num">{{ s.pesoPct ?? '—' }}{{ (s.pesoPct ?? null) !== null ? ' %' : '' }}</td>
                    <td class="num">{{ pct(s.programado) }} %</td><td class="num">{{ pct(s.real) }} %</td><td>{{ s.situacion.texto }}</td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="8">La obra no tiene partidas.</td></tr>
              }
            </tbody>
          </table>

          <h3 class="imp-sub">Curva S</h3>
          @if (geo(); as g) {
            <svg class="imp-svg" [attr.viewBox]="'0 0 ' + g.ancho + ' ' + g.alto" role="img" aria-label="Curva S: pactado frente a real por semana" data-testid="curva-s">
              @for (l of g.guias; track l.valor) {
                <line [attr.x1]="g.izq" [attr.x2]="g.ancho - g.der" [attr.y1]="l.y" [attr.y2]="l.y" stroke="#d1d5db" stroke-width="1" />
                <text [attr.x]="g.izq - 6" [attr.y]="l.y + 3" text-anchor="end" font-size="10" fill="#4b5563">{{ l.valor }}%</text>
              }
              <path [attr.d]="g.pactado" fill="none" stroke="#2563eb" stroke-width="2" />
              @if (g.real) { <path [attr.d]="g.real" fill="none" stroke="#16a34a" stroke-width="2.5" /> }
              @if (g.xCorte !== null) {
                <line [attr.x1]="g.xCorte" [attr.x2]="g.xCorte" [attr.y1]="g.arriba" [attr.y2]="g.alto - g.abajo" stroke="#475569" stroke-width="1" stroke-dasharray="2 2" />
              }
              @for (sem of curva()!.semanas; track sem.semana; let i = $index) {
                <text [attr.x]="g.xs[i]" [attr.y]="g.alto - 14" text-anchor="end" font-size="9" fill="#4b5563">S{{ sem.semana }}</text>
              }
            </svg>
            <div class="imp-leyenda"><span>— Pactado (azul)</span><span>— Real (verde)</span></div>
            @if (frase(); as f) { <p class="imp-nota" data-testid="frase-curva">{{ f.texto }}</p> }
          } @else {
            <p class="imp-nota">Aún no hay curva: faltan las fechas de inicio y fin de la obra.</p>
          }
        }
      </section>
    }
  `,
})
export class FormatoInformeAvanceComponent {
  readonly #obra = inject(ObraService);

  readonly idCentroCosto = input.required<number>();

  protected readonly recurso = rxResource<ControlObra, number>({
    params: () => this.idCentroCosto(),
    stream: ({ params }) => this.#obra.getControl(params),
  });

  protected readonly c = computed(() => (this.recurso.hasValue() ? this.recurso.value() : undefined));
  protected readonly curva = computed(() => this.c()?.resultado?.curvaS ?? null);
  protected readonly geo = computed(() => {
    const curva = this.curva();
    return curva ? geometriaCurvaS(curva, 640, 260) : null;
  });
  protected readonly frase = computed(() => {
    const curva = this.curva();
    return curva ? fraseCurvaS(curva) : null;
  });
  protected readonly estado = computed(() => etiquetaEstadoObra(this.c()?.resultado?.estadoEfectivo ?? this.c()?.estado_obra ?? null));
  protected readonly error = computed(() => errorMessage(this.recurso.error()));
  protected readonly pct = pctMostrado;
  protected readonly desviacion = textoDesviacion;
  protected readonly fecha = (iso: string | null | undefined) => (iso ? fechaCorta(iso.slice(0, 10)) : '—');
}
