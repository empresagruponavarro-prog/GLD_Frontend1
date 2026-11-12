import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage } from '../../almacen/almacen.utils';
import { ObraService } from '../../centros-costos/obra-cockpit/obra.service';
import { DosierObra, SeccionDosier } from '../../centros-costos/obra-cockpit/obra-liquidacion.interface';
import { FormatoFichaObraComponent } from './ficha-obra';
import { FormatoInformeAvanceComponent } from './informe-avance';
import { FormatoPlanosDocumentosComponent } from './planos-documentos';
import { FormatoPresupuestoComercialComponent } from './presupuesto-comercial';
import { FormatoPresupuestoMetaComponent } from './presupuesto-meta';

/**
 * **Dosier de la obra** (GRP T69, SP-17): compone en un solo documento, con salto de página entre cada parte, el presupuesto
 * Meta, el Comercial, la ficha técnica, el informe de avance, los planos y los documentos. Sale del manifiesto del servidor
 * (`GET dosier`): si faltan planos obligatorios responde 409 y no se arma (R-06). Imprimir → «Guardar como PDF».
 */
@Component({
  selector: 'app-formato-dosier',
  standalone: true,
  imports: [
    FormatoPresupuestoMetaComponent,
    FormatoPresupuestoComercialComponent,
    FormatoFichaObraComponent,
    FormatoInformeAvanceComponent,
    FormatoPlanosDocumentosComponent,
  ],
  styleUrl: './formato.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recurso.error()) {
      <p class="imp-error" role="alert" data-testid="dosier-bloqueado">{{ error() }}</p>
      <p class="imp-nota">Suba el archivo y marque cada plano obligatorio en la pestaña Planos de Obra y vuelva a emitir el dosier.</p>
    } @else if (recurso.isLoading() || !d()) {
      <p>Armando el dosier…</p>
    } @else {
      @let m = d()!;
      <section class="imp-seccion" data-testid="dosier-portada">
        <h2 class="imp-sub">Dosier de la obra · {{ m.nombre_obra }}</h2>
        <p class="imp-nota">Fecha de emisión: {{ m.fecha }}. Planos obligatorios: {{ m.planos.entregados_obligatorios }} de {{ m.planos.obligatorios }} entregados.</p>
        <table class="imp-table imp-indice">
          <thead><tr><th>N.º</th><th>Contenido</th><th>Detalle</th><th>Incluido</th></tr></thead>
          <tbody>
            @for (s of m.secciones; track s.codigo; let i = $index) {
              <tr [attr.data-seccion]="s.codigo">
                <td>{{ i + 1 }}</td>
                <td>{{ s.titulo }}</td>
                <td>{{ s.referencias.join(', ') || '—' }}</td>
                <td>{{ s.disponible ? 'Sí' : 'No' }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (faltantes().length > 0) {
          <div class="imp-aviso" data-testid="dosier-faltantes">
            <strong>Lo que falta en este dosier:</strong>
            <ul>
              @for (s of faltantes(); track s.codigo) { <li>{{ s.titulo }}{{ s.nota ? ': ' + s.nota : '' }}</li> }
            </ul>
          </div>
        }
      </section>

      @for (s of m.secciones; track s.codigo) {
        @if (s.disponible) {
          @switch (s.codigo) {
            @case ('PRESUPUESTO_META') {
              @for (c of s.referencias; track c) { <div class="imp-salto"><app-formato-presupuesto-meta [presupuesto]="c" /></div> }
            }
            @case ('PRESUPUESTO_COMERCIAL') {
              @for (c of s.referencias; track c) { <div class="imp-salto"><app-formato-presupuesto-comercial [presupuesto]="c" /></div> }
            }
            @case ('FICHA_OBRA') {
              <div class="imp-salto"><app-formato-ficha-obra [idCentroCosto]="m.id_centro_costo" /></div>
            }
            @case ('INFORME_AVANCE') {
              <div class="imp-salto"><app-formato-informe-avance [idCentroCosto]="m.id_centro_costo" /></div>
            }
            @case ('PLANOS') {
              <div class="imp-salto"><app-formato-planos-documentos [idCentroCosto]="m.id_centro_costo" /></div>
            }
          }
        }
      }
      @if (soloDocumentos()) {
        <div class="imp-salto"><app-formato-planos-documentos [idCentroCosto]="m.id_centro_costo" /></div>
      }
    }
  `,
})
export class FormatoDosierComponent {
  readonly #obra = inject(ObraService);

  readonly idCentroCosto = input.required<number>();

  protected readonly recurso = rxResource<DosierObra, number>({
    params: () => this.idCentroCosto(),
    stream: ({ params }) => this.#obra.getDosier(params),
  });

  protected readonly d = computed(() => (this.recurso.hasValue() ? this.recurso.value() : undefined));
  protected readonly faltantes = computed<SeccionDosier[]>(() => (this.d()?.secciones ?? []).filter((s) => !s.disponible));
  /** Los planos y los documentos comparten formato: si solo hay documentos, se imprime igual. */
  protected readonly soloDocumentos = computed(() => {
    const s = this.d()?.secciones ?? [];
    return s.some((x) => x.codigo === 'DOCUMENTOS' && x.disponible) && !s.some((x) => x.codigo === 'PLANOS' && x.disponible);
  });
  protected readonly error = computed(() => errorMessage(this.recurso.error()));
}
