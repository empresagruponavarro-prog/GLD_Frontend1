import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { estadoPlanoClass } from '../../obra.calc';
import { ObraPlano } from '../../obra.interface';
import { ObraService } from '../../obra.service';

@Component({
  selector: 'app-historial-planos-dialog',
  standalone: true,
  imports: [ModalComponent, DatePipe],
  templateUrl: './historial-planos-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialPlanosDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly plano = input<ObraPlano | null>(null);

  readonly closed = output<void>();
  /** Solicita emitir una nueva versión del plano vigente. */
  readonly nuevaVersion = output<ObraPlano>();

  protected readonly estadoPlanoClass = estadoPlanoClass;
  protected readonly versiones = signal<ObraPlano[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const p = this.plano();
      if (!this.isOpen() || !p) return;
      this.isLoading.set(true);
      this.error.set('');
      this.#service.getHistorialPlano(this.idCentroCosto(), p.id).subscribe({
        next: (rows) => {
          this.versiones.set(rows);
          this.isLoading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(errorMessage(err));
          this.isLoading.set(false);
        },
      });
    });
  }

  protected vigente(): ObraPlano | undefined {
    return this.versiones().find((v) => v.es_vigente);
  }
}
