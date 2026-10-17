import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ObraResidente } from '../../obra.interface';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';

@Component({
  selector: 'app-directorio-tab',
  standalone: true,
  templateUrl: './directorio-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectorioTabComponent {
  readonly residentes = input<readonly ObraResidente[]>([]);
  /** Permisos del módulo `obra`; sin ellos la pestaña queda en solo lectura. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);
  readonly asignar = output<void>();
  readonly editar = output<ObraResidente>();
}
