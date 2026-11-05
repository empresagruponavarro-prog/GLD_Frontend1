import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage } from '../../almacen/almacen.utils';
import { ObraCockpit } from '../../centros-costos/obra-cockpit/obra.interface';
import { ObraService } from '../../centros-costos/obra-cockpit/obra.service';
import { PlanosRequeridosObra } from '../../centros-costos/obra-cockpit/obra-liquidacion.interface';

/**
 * Listas de **planos** (vigentes y lista de verificación) y de **documentos técnicos y actas** de la obra (GRP T80/T69),
 * para el dosier. Lista lo cargado; no incluye los archivos.
 */
@Component({
  selector: 'app-formato-planos-documentos',
  standalone: true,
  styleUrl: './formato.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recurso.error()) {
      <p class="imp-error" role="alert">{{ error() }}</p>
    } @else if (recurso.isLoading() || !c()) {
      <p>Cargando planos y documentos…</p>
    } @else {
      @let o = c()!;
      <section class="imp-seccion" data-testid="formato-planos-documentos">
        <h2 class="imp-sub">Planos de la obra</h2>
        @let req = requeridos();
        @if (req && req.items.length > 0) {
          <p class="imp-nota">Lista de verificación{{ req.tipo_proyecto ? ' del tipo ' + req.tipo_proyecto : '' }}: {{ req.resumen.entregados_obligatorios }} de {{ req.resumen.obligatorios }} planos obligatorios entregados.</p>
          <table class="imp-table">
            <thead><tr><th>Código</th><th>Plano</th><th>Obligatorio</th><th>Entregado</th></tr></thead>
            <tbody>
              @for (i of req.items; track i.id_tipo_plano) {
                <tr><td>{{ i.codigo }}</td><td>{{ i.nombre }}</td><td>{{ i.obligatorio ? 'Sí' : 'No' }}</td><td>{{ i.entregado ? 'Sí' + (i.entregado_por ? ' · ' + i.entregado_por : '') : 'No' }}</td></tr>
              }
            </tbody>
          </table>
        }
        <table class="imp-table">
          <thead><tr><th>Código</th><th>Nombre</th><th>Disciplina</th><th>Versión</th><th>Estado</th></tr></thead>
          <tbody>
            @for (p of vigentes(); track p.id) {
              <tr><td>{{ p.codigo_plano }}</td><td>{{ p.nombre_plano }}</td><td>{{ p.disciplina }}</td><td>{{ p.version }}</td><td>{{ p.estado_aprobacion }}</td></tr>
            } @empty {
              <tr><td colspan="5">No hay planos cargados.</td></tr>
            }
          </tbody>
        </table>

        <h2 class="imp-sub">Documentos técnicos y actas</h2>
        <table class="imp-table">
          <thead><tr><th>Título</th><th>Categoría</th><th>N.º registro</th><th>Emisión</th><th>Estado</th></tr></thead>
          <tbody>
            @for (d of o.documentos; track d.id) {
              <tr><td>{{ d.titulo }}</td><td>{{ d.categoria }}</td><td>{{ d.nro_registro ?? '—' }}</td><td>{{ d.fecha_emision?.slice(0, 10) ?? '—' }}</td><td>{{ d.estado }}</td></tr>
            } @empty {
              <tr><td colspan="5">No hay documentos registrados.</td></tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
})
export class FormatoPlanosDocumentosComponent {
  readonly #obra = inject(ObraService);

  readonly idCentroCosto = input.required<number>();

  protected readonly recurso = rxResource<ObraCockpit, number>({
    params: () => this.idCentroCosto(),
    stream: ({ params }) => this.#obra.getCockpit(params),
  });
  /** La lista de verificación es opcional: si falla, el formato sigue con los planos cargados. */
  protected readonly listaRequerida = rxResource<PlanosRequeridosObra | null, number>({
    params: () => this.idCentroCosto(),
    stream: ({ params }) => this.#obra.getPlanosRequeridos(params),
  });

  protected readonly c = computed(() => (this.recurso.hasValue() ? this.recurso.value() : undefined));
  protected readonly requeridos = computed(() => (this.listaRequerida.hasValue() ? this.listaRequerida.value() : null));
  protected readonly vigentes = computed(() => (this.c()?.planos ?? []).filter((p) => p.es_vigente));
  protected readonly error = computed(() => errorMessage(this.recurso.error()));
}
