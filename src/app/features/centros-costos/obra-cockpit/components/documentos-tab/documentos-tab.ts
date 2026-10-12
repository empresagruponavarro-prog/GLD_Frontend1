import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ObraDocumento } from '../../obra.interface';

@Component({
  selector: 'app-documentos-tab',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './documentos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentosTabComponent {
  readonly documentos = input<readonly ObraDocumento[]>([]);
  readonly anexar = output<void>();
  readonly verDetalle = output<ObraDocumento>();
  readonly descargar = output<ObraDocumento>();
}
