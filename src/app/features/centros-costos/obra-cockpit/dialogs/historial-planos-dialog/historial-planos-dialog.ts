import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@shared/utils/errores-http';
import { estadoPlanoClass } from '../../obra.calc';
import { ObraPlano } from '../../obra.interface';
import { ObraService } from '../../obra.service';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';

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
  /** Permisos de `obra`: «Emitir nueva versión» (`POST …/planos/:id/versiones`) exige `editar`. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  /** Solicita emitir una nueva versión del plano vigente. */
  readonly nuevaVersion = output<ObraPlano>();
  /** Solicita abrir el visor seguro para una versión del plano. */
  readonly verPlano = output<ObraPlano>();

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

  /** URL del archivo de una versión (se sirve desde el backend; los enlaces externos redirigen). */
  protected archivoUrl(v: ObraPlano): string {
    return this.#service.archivoPlanoUrl(this.idCentroCosto(), v.id, true);
  }
}
