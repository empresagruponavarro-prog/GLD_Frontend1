import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTable } from '../../../shared/interfaces';
import { errorMessage } from '../../almacen/almacen.utils';
import {
  AVANCE_LABEL,
  ESTADOS_REQUERIMIENTO,
  ESTADO_LABEL,
  EstadoRequerimiento,
  Requerimiento,
  RequerimientoQuery,
} from '../requerimientos.models';
import { RequerimientosService } from '../requerimientos.service';
import { avanceBadge, esEditable, estadoBadge } from '../requerimientos.utils';

@Component({
  selector: 'app-requerimientos-lista',
  standalone: true,
  imports: [RouterLink, DataTableComponent],
  templateUrl: './requerimientos-lista.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequerimientosListaComponent {
  private readonly service = inject(RequerimientosService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly estados = ESTADOS_REQUERIMIENTO;
  protected readonly estadoLabel = ESTADO_LABEL;
  protected readonly avanceLabel = AVANCE_LABEL;
  protected readonly estadoBadge = estadoBadge;
  protected readonly avanceBadge = avanceBadge;
  protected readonly esEditable = esEditable;

  protected readonly columns: DataTable[] = [
    { label: 'Número', width: '120px' },
    { label: 'Fecha', width: '100px' },
    { label: 'Centro de costos' },
    { label: 'Solicitante', width: '180px' },
    { label: 'Justificación' },
    { label: 'Líneas', align: 'center', width: '70px' },
    { label: 'Estado', align: 'center', width: '160px' },
    { label: 'Acciones', align: 'center', width: '150px' },
  ];

  protected readonly items = signal<Requerimiento[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly isLoading = signal(false);
  protected readonly message = signal('');

  protected readonly fEstado = signal<EstadoRequerimiento | ''>('');
  protected readonly fDesde = signal('');
  protected readonly fHasta = signal('');
  protected readonly fSearch = signal('');

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    const query: RequerimientoQuery = {
      page: this.page(),
      pageSize: this.pageSize(),
      estado: this.fEstado() || undefined,
      desde: this.fDesde() || undefined,
      hasta: this.fHasta() || undefined,
      search: this.fSearch().trim() || undefined,
    };
    this.service.getAll(query).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.total.set(res.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.total.set(0);
        this.isLoading.set(false);
      },
    });
  }

  protected applyFilter(target: 'estado' | 'desde' | 'hasta', value: string): void {
    if (target === 'estado') this.fEstado.set(value as EstadoRequerimiento | '');
    else if (target === 'desde') this.fDesde.set(value);
    else this.fHasta.set(value);
    this.page.set(1);
    this.load();
  }

  protected onSearch(value: string): void {
    this.fSearch.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 350);
  }

  protected resetFilters(): void {
    this.fEstado.set('');
    this.fDesde.set('');
    this.fHasta.set('');
    this.fSearch.set('');
    this.page.set(1);
    this.load();
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  protected canAnular(item: Requerimiento): boolean {
    return ['BORRADOR', 'ENVIADO', 'OBSERVADO', 'APROBADO'].includes(item.estado);
  }

  protected canGenerarOc(item: Requerimiento): boolean {
    return item.estado === 'APROBADO' && item.avance !== 'ATENDIDO';
  }

  protected enviar(item: Requerimiento): void {
    if (!confirm(`¿Enviar ${item.numero} a aprobación? Ya no podrá modificarlo hasta que se observe.`)) return;
    this.service.enviar(item.id).subscribe({
      next: () => {
        this.message.set(`${item.numero} enviado a aprobación.`);
        this.load();
      },
      error: (err) => alert(errorMessage(err)),
    });
  }

  protected anular(item: Requerimiento): void {
    if (!confirm(`¿Anular ${item.numero}? Esta acción no se puede deshacer.`)) return;
    this.service.anular(item.id).subscribe({
      next: () => {
        this.message.set(`${item.numero} anulado.`);
        this.load();
      },
      error: (err) => alert(errorMessage(err)),
    });
  }

  protected eliminar(item: Requerimiento): void {
    if (!confirm(`¿Eliminar el borrador ${item.numero}?`)) return;
    this.service.delete(item.id).subscribe({
      next: () => {
        this.message.set(`${item.numero} eliminado.`);
        this.load();
      },
      error: (err) => alert(errorMessage(err)),
    });
  }
}
