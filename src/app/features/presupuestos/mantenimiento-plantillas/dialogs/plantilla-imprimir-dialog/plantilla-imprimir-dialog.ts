import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  PresupuestosService,
  PlantillaCompleta,
  PlantillaFaseDto,
  PlantillaCategoriaDto,
  PartidaItem,
} from '@app/features/presupuestos/presupuestos.service';

@Component({
  selector: 'app-plantilla-imprimir-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe],
  templateUrl: './plantilla-imprimir-dialog.html',
  styleUrl: './plantilla-imprimir-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantillaImprimirDialogComponent {
  private readonly presupuestosService = inject(PresupuestosService);

  readonly plantilla = input.required<PlantillaCompleta>();
  readonly closed = output<void>();
  readonly printArea = viewChild<ElementRef<HTMLDivElement>>('printArea');

  readonly incluirItems = signal<boolean>(false);
  readonly cargandoItems = signal<boolean>(false);
  readonly itemsPorPartida = signal<Map<number, PartidaItem[]>>(new Map());

  readonly fechaEmision = new Date();

  // Métricas calculadas
  readonly totalFases = computed(() => this.plantilla().fases?.length ?? 0);

  readonly totalPartidas = computed(() => {
    return (this.plantilla().fases ?? []).reduce(
      (acc, f) => acc + (f.categorias?.length ?? 0),
      0
    );
  });

  readonly costoTotalEstimado = computed(() => {
    let total = 0;
    for (const f of this.plantilla().fases ?? []) {
      for (const c of f.categorias ?? []) {
        total += Number(c.CostoReferencial) || 0;
      }
    }
    return total;
  });

  // Estado de acordeón de fases
  readonly fasesColapsadas = signal<Set<number>>(new Set());

  isFaseExpandida(faseId: number): boolean {
    return !this.fasesColapsadas().has(faseId);
  }

  toggleFase(faseId: number): void {
    const colapsadas = new Set(this.fasesColapsadas());
    if (colapsadas.has(faseId)) {
      colapsadas.delete(faseId);
    } else {
      colapsadas.add(faseId);
    }
    this.fasesColapsadas.set(colapsadas);
  }

  expandirTodas(): void {
    this.fasesColapsadas.set(new Set());
  }

  colapsarTodas(): void {
    const todas = new Set<number>();
    for (const f of this.plantilla().fases ?? []) {
      if (f.id != null) {
        todas.add(f.id);
      }
    }
    this.fasesColapsadas.set(todas);
  }

  calcularSubtotalFase(fase: PlantillaFaseDto): number {
    return (fase.categorias ?? []).reduce(
      (acc, c) => acc + (Number(c.CostoReferencial) || 0),
      0
    );
  }

  toggleIncluirItems(incluir: boolean): void {
    this.incluirItems.set(incluir);
    if (incluir && this.itemsPorPartida().size === 0) {
      this.cargarDetalleItems();
    }
  }

  private cargarDetalleItems(): void {
    const categoriasConItems: PlantillaCategoriaDto[] = [];
    for (const f of this.plantilla().fases ?? []) {
      for (const c of f.categorias ?? []) {
        if (c.id && (c.totalItems ?? 0) > 0) {
          categoriasConItems.push(c);
        }
      }
    }

    if (categoriasConItems.length === 0) return;

    this.cargandoItems.set(true);

    const observables = categoriasConItems.map((cat) =>
      this.presupuestosService.getPartidaItems(cat.id).pipe(
        catchError(() => of({ id_plantilla_categoria: cat.id, items: [], costoTotal: 0, ventaTotal: 0 }))
      )
    );

    forkJoin(observables).subscribe({
      next: (respuestas) => {
        const mapa = new Map<number, PartidaItem[]>();
        for (const res of respuestas) {
          mapa.set(res.id_plantilla_categoria, res.items);
        }
        this.itemsPorPartida.set(mapa);
        this.cargandoItems.set(false);
      },
      error: () => {
        this.cargandoItems.set(false);
      },
    });
  }

  obtenerItemsPartida(idPartida: number): PartidaItem[] {
    return this.itemsPorPartida().get(idPartida) ?? [];
  }

  imprimir(): void {
    const area = this.printArea()?.nativeElement;
    if (!area) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Plantilla - ${this.plantilla().Nombre || 'GLD'}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #0f172a;
            background: #fff;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.35;
          }
          .table-header-fase {
            background-color: #f1f5f9 !important;
            font-weight: 700;
            color: #0f172a;
          }
          .table-header-fase th, .table-header-fase td {
            border-top: 1.5px solid #cbd5e1;
            border-bottom: 1.5px solid #cbd5e1;
            padding: 6px 8px;
          }
          .partida-row td {
            border-bottom: 1px solid #f1f5f9;
            padding: 4.5px 8px;
          }
          .partida-row, .item-subrow {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .item-subrow td {
            background-color: #fafafa !important;
            border-bottom: 1px dashed #e2e8f0;
            padding: 3px 6px;
            font-size: 10px;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .badge-activa {
            background-color: #d1fae5 !important;
            color: #065f46 !important;
            border: 1px solid #a7f3d0;
          }
          .badge-inactiva {
            background-color: #fef3c7 !important;
            color: #92400e !important;
            border: 1px solid #fde68a;
          }
          .resumen-box {
            background-color: #f8fafc !important;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
          }
          .resumen-totales-box, .firmas-box {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          .font-bold { font-weight: 700; }
          .text-muted { color: #64748b; }
          .w-full { width: 100%; }
          .border-collapse { border-collapse: collapse; }
          .no-print { display: none !important; }
        </style>
      </head>
      <body>
        ${area.innerHTML}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  }
}
