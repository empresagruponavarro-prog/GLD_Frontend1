import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ObraResidente } from '../../obra.interface';

@Component({
  selector: 'app-directorio-tab',
  standalone: true,
  templateUrl: './directorio-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectorioTabComponent {
  readonly residentes = input<readonly ObraResidente[]>([]);
  readonly asignar = output<void>();
  readonly editar = output<ObraResidente>();
}
