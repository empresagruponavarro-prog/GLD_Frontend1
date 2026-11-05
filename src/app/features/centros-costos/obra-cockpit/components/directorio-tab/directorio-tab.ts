import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ObraResidente } from '../../obra.interface';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';
import { ObraService } from '../../obra.service';

@Component({
  selector: 'app-directorio-tab',
  standalone: true,
  templateUrl: './directorio-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectorioTabComponent {
  readonly #service = inject(ObraService);

  readonly residentes = input<readonly ObraResidente[]>([]);
  /** Obra del directorio; con ella se carga el historial del equipo (sin ella la sección no aparece). */
  readonly idCentroCosto = input<number | null>(null);
  /** Permisos del módulo `obra`; sin ellos la pestaña queda en solo lectura. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);
  readonly asignar = output<void>();
  readonly editar = output<ObraResidente>();

  /** Quiénes ocuparon antes cada rol del equipo (GRP S-06); se vuelve a pedir cuando cambia el directorio. */
  protected readonly historial = rxResource({
    params: () => {
      const id = this.idCentroCosto();
      return id === null ? undefined : { id, directorio: this.residentes() };
    },
    stream: ({ params }) => this.#service.getHistorialEquipo(params.id),
  });

  protected readonly filasHistorial = () => (this.historial.hasValue() ? this.historial.value() : []);
}
