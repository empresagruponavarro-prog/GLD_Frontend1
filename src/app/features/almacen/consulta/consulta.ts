import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermisosService } from '@app/core/auth/permisos.service';
import { valorDeEvento } from '@shared/utils/eventos';
import { AlmacenService } from '../almacen.service';
import { CLASE_LABEL, Consulta, StockAlmacen } from '../almacen.models';
import { errorMessage, fmtMoney, fmtNum } from '../almacen.utils';

@Component({
  selector: 'app-consulta-almacen',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './consulta.html',
  styleUrl: './consulta.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultaAlmacenComponent {
  private readonly service = inject(AlmacenService);
  readonly #permisos = inject(PermisosService);

  /**
   * "Marcar operativo" llama a `PATCH /almacen/stock/:idProducto/:idAlmacen/operativo` (módulo
   * `almacen.stock`, también admitido desde `almacen.consulta`): exige editar en cualquiera de los dos.
   */
  protected readonly puedeMarcarOperativo = computed(
    () => this.#permisos.puede('almacen.consulta', 'editar') || this.#permisos.puede('almacen.stock', 'editar'),
  );

  protected readonly claseLabel = CLASE_LABEL;
  protected readonly fmtNum = fmtNum;
  protected readonly fmtMoney = fmtMoney;

  protected readonly term = signal('');
  protected readonly result = signal<Consulta | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly errorText = signal('');
  protected readonly notice = signal('');

  protected onInput(event: Event): void {
    this.term.set(valorDeEvento(event));
  }

  protected search(): void {
    const q = this.term().trim();
    if (!q) return;
    this.isLoading.set(true);
    this.errorText.set('');
    this.notice.set('');
    this.service.consultar(q).subscribe({
      next: (res) => {
        this.result.set(res);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.result.set(null);
        this.errorText.set(errorMessage(err));
        this.isLoading.set(false);
      },
    });
  }

  protected pick(codigo: string): void {
    this.term.set(codigo);
    this.search();
  }

  protected marcarOperativo(row: StockAlmacen): void {
    if (!this.puedeMarcarOperativo()) return;
    const ficha = this.result()?.producto;
    if (!ficha) return;
    const cantidad = prompt(`¿Cuántas unidades vuelven a operativo? (máx. ${row.no_operativo})`, row.no_operativo);
    if (!cantidad) return;
    this.service.marcarOperativo(ficha.id, row.id_almacen, cantidad.trim()).subscribe({
      next: () => {
        this.notice.set('Unidades marcadas como operativas.');
        this.search();
      },
      error: (err: unknown) => alert(errorMessage(err)),
    });
  }
}
