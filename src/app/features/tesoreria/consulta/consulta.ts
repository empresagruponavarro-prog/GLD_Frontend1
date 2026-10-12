import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage, fmtMoney, todayISO } from '../../almacen/almacen.utils';
import { CLASES_DOCUMENTO, CLASE_LABEL } from '../../documentos/administracion/administracion.models';
import { Area, SelectOption } from '../../requerimientos/requerimientos.models';
import { RequerimientosService } from '../../requerimientos/requerimientos.service';
import { Resumen, ResumenFila, ResumenQuery, Retenciones } from '../tesoreria.models';
import { TesoreriaService } from '../tesoreria.service';
import { pct } from '../tesoreria.utils';

/** Tablero gerencial de documentos de origen y pagos (todo en soles) y reporte de retenciones/detracciones. */
@Component({
  selector: 'app-tesoreria-consulta',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './consulta.html',
  styleUrl: './consulta.css',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultaTesoreriaComponent {
  private readonly service = inject(TesoreriaService);
  private readonly requerimientos = inject(RequerimientosService);

  protected readonly fmtMoney = fmtMoney;
  protected readonly pct = pct;
  protected readonly clases = CLASES_DOCUMENTO;
  protected readonly claseLabel = CLASE_LABEL;

  protected readonly pestana = signal<'tablero' | 'retenciones'>('tablero');
  protected readonly resumen = signal<Resumen | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly error = signal('');
  protected readonly areas = signal<Area[]>([]);
  protected readonly centrosCostos = signal<SelectOption[]>([]);

  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly idArea = signal('');
  protected readonly idCentro = signal('');
  protected readonly clase = signal('');

  protected readonly periodo = signal(todayISO().slice(0, 7));
  protected readonly retenciones = signal<Retenciones | null>(null);
  protected readonly isLoadingRet = signal(false);

  protected readonly maxMes = computed(() => {
    const r = this.resumen();
    return r ? Math.max(1, ...r.por_mes.flatMap((m) => [Number(m.comprometido_soles), Number(m.pagado_soles)])) : 1;
  });

  constructor() {
    this.requerimientos.getAreas().subscribe({ next: (r) => this.areas.set(r), error: () => this.areas.set([]) });
    this.requerimientos.getCentrosCostosSelect().subscribe({ next: (r) => this.centrosCostos.set(r), error: () => this.centrosCostos.set([]) });
    this.load();
    this.loadRetenciones();
  }

  protected maximo(filas: ResumenFila[]): number {
    return Math.max(1, ...filas.map((f) => Number(f.monto_soles)));
  }

  protected load(): void {
    this.isLoading.set(true);
    this.error.set('');
    const num = (s: string) => (s === '' ? undefined : Number(s));
    const query: ResumenQuery = {
      desde: this.desde() || undefined,
      hasta: this.hasta() || undefined,
      id_area: num(this.idArea()),
      id_centro_costo: num(this.idCentro()),
      clase_documento: this.clase() || undefined,
    };
    this.service.getResumen(query).subscribe({
      next: (r) => {
        this.resumen.set(r);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.resumen.set(null);
        this.error.set(errorMessage(err));
        this.isLoading.set(false);
      },
    });
  }

  protected setFiltro(target: 'desde' | 'hasta' | 'area' | 'centro' | 'clase', value: string): void {
    switch (target) {
      case 'desde': this.desde.set(value); break;
      case 'hasta': this.hasta.set(value); break;
      case 'area': this.idArea.set(value); break;
      case 'centro': this.idCentro.set(value); break;
      case 'clase': this.clase.set(value); break;
    }
    this.load();
  }

  protected limpiar(): void {
    for (const s of [this.desde, this.hasta, this.idArea, this.idCentro, this.clase]) s.set('');
    this.load();
  }

  protected setPeriodo(value: string): void {
    this.periodo.set(value);
    this.loadRetenciones();
  }

  protected loadRetenciones(): void {
    if (!/^\d{4}-\d{2}$/.test(this.periodo())) return;
    this.isLoadingRet.set(true);
    this.service.getRetenciones(this.periodo()).subscribe({
      next: (r) => {
        this.retenciones.set(r);
        this.isLoadingRet.set(false);
      },
      error: () => {
        this.retenciones.set(null);
        this.isLoadingRet.set(false);
      },
    });
  }
}
