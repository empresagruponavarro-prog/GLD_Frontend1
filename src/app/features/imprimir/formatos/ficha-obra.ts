import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage } from '../../almacen/almacen.utils';
import { ObraCockpit } from '../../centros-costos/obra-cockpit/obra.interface';
import { ObraService } from '../../centros-costos/obra-cockpit/obra.service';
import { etiquetaEstadoObra, fechaCorta } from '../../centros-costos/obra-cockpit/obra-control.calc';

/**
 * Formato de la **ficha técnica de la obra** (GRP T80): datos generales, ubicación, plazos, contacto del cliente y equipo.
 * Lo usa la ruta `/imprimir/ficha-obra/:id` y el dosier.
 */
@Component({
  selector: 'app-formato-ficha-obra',
  standalone: true,
  styleUrl: './formato.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recurso.error()) {
      <p class="imp-error" role="alert">{{ error() }}</p>
    } @else if (recurso.isLoading() || !c()) {
      <p>Cargando ficha de la obra…</p>
    } @else {
      @let o = c()!;
      @let g = o.generales;
      <section class="imp-seccion" data-testid="formato-ficha-obra">
        <h2 class="imp-sub">Ficha técnica · {{ o.nombre_obra }}</h2>
        <table class="imp-grid">
          <tr><th>Código</th><td>{{ g?.codigo_obra ?? 'CC-' + o.id_centro_costo }}</td><th>Tienda</th><td>{{ g?.tienda ?? o.nombre_obra }}</td></tr>
          <tr><th>Empresa</th><td>{{ o.cabecera.empresa ?? '—' }}</td><th>Cliente</th><td>{{ o.cabecera.cliente ?? '—' }}</td></tr>
          <tr><th>Estado de la obra</th><td>{{ estado() }}</td><th>Expediente</th><td>{{ g?.expediente_codigo ?? '—' }}</td></tr>
          <tr><th>Inicio programado</th><td>{{ fecha(o.cabecera.fecha_inicio) }}</td><th>Fin programado</th><td>{{ fecha(o.cabecera.fecha_fin_prog) }}</td></tr>
          <tr><th>Fin real</th><td>{{ fecha(o.cabecera.fecha_fin_real) }}</td><th>Semanas</th><td>{{ g?.semanas_totales ?? '—' }}</td></tr>
        </table>

        <h3 class="imp-sub">Ubicación</h3>
        <table class="imp-grid">
          <tr><th>Dirección</th><td colspan="3">{{ g?.direccion ?? '—' }}</td></tr>
          <tr><th>Departamento</th><td>{{ g?.departamento ?? '—' }}</td><th>Provincia</th><td>{{ g?.provincia ?? '—' }}</td></tr>
          <tr><th>Distrito</th><td>{{ g?.distrito ?? '—' }}</td><th>Ubigeo</th><td>{{ g?.ubigeo_cod ?? '—' }}</td></tr>
          <tr><th>Latitud / longitud</th><td colspan="3">{{ g?.latitud ?? '—' }} / {{ g?.longitud ?? '—' }}</td></tr>
        </table>

        <h3 class="imp-sub">Cliente y operación</h3>
        <table class="imp-grid">
          <tr><th>Contacto</th><td>{{ g?.contacto_cliente_nombre ?? '—' }}</td><th>Teléfono</th><td>{{ g?.contacto_cliente_telefono ?? '—' }}</td></tr>
          <tr><th>Correo</th><td>{{ g?.contacto_cliente_correo ?? '—' }}</td><th>Turno de trabajo</th><td>{{ g?.turno_trabajo ?? '—' }}</td></tr>
          <tr><th>Personal promedio</th><td>{{ g?.personal_activo_promedio ?? '—' }}</td><th>Avance general</th><td>{{ g?.avance_general ?? '—' }}{{ g?.avance_general !== null && g?.avance_general !== undefined ? ' %' : '' }}</td></tr>
          @if (g?.comentario) { <tr><th>Comentario</th><td colspan="3">{{ g?.comentario }}</td></tr> }
        </table>

        <h3 class="imp-sub">Equipo de la obra</h3>
        <table class="imp-table">
          <thead><tr><th>Rol</th><th>Persona</th><th>Teléfono</th><th>Correo</th></tr></thead>
          <tbody>
            @for (r of o.residentes; track r.clave) {
              <tr><td>{{ r.rol_obra }}</td><td>{{ r.nombre_completo }}</td><td>{{ r.telefono ?? '—' }}</td><td>{{ r.correo ?? '—' }}</td></tr>
            } @empty {
              <tr><td colspan="4">Sin equipo registrado.</td></tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
})
export class FormatoFichaObraComponent {
  readonly #obra = inject(ObraService);

  readonly idCentroCosto = input.required<number>();

  protected readonly recurso = rxResource<ObraCockpit, number>({
    params: () => this.idCentroCosto(),
    stream: ({ params }) => this.#obra.getCockpit(params),
  });

  protected readonly c = computed(() => (this.recurso.hasValue() ? this.recurso.value() : undefined));
  protected readonly error = computed(() => errorMessage(this.recurso.error()));
  protected readonly estado = computed(() => etiquetaEstadoObra(this.c()?.generales?.estado_obra ?? null));
  protected readonly fecha = (iso: string | null | undefined) => (iso ? fechaCorta(iso.slice(0, 10)) : '—');
}
