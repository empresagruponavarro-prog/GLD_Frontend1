import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { ObraIncidencia } from '../../obra.interface';

@Component({
  selector: 'app-incidencias-tab',
  standalone: true,
  imports: [DatePipe, UpperCasePipe],
  templateUrl: './incidencias-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidenciasTabComponent {
  readonly incidencias = input<readonly ObraIncidencia[]>([]);
  readonly reportar = output<void>();
  readonly verBitacora = output<ObraIncidencia>();
  readonly resolver = output<ObraIncidencia>();
}
