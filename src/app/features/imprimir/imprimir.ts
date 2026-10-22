import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { errorMessage } from '@shared/utils/errores-http';
import { fmtMoney, fmtNum } from '@shared/utils/formato';
import { AdministracionDocumentosService } from '../documentos/administracion/administracion.service';
import { CLASE_LABEL, DocumentoDetalle } from '../documentos/administracion/administracion.models';
import {
  CuadroComparativo,
  MEDIO_PAGO_LABEL,
  Requerimiento,
  TIPO_LABEL,
} from '../requerimientos/requerimientos.models';
import { RequerimientosService } from '../requerimientos/requerimientos.service';
import { Pago } from '../tesoreria/tesoreria.models';
import { TesoreriaService } from '../tesoreria/tesoreria.service';
import { EmpresaCabecera, ImprimirService } from './imprimir.service';

export type TipoImpresion = 'fur' | 'cuadro-comparativo' | 'documento-origen' | 'comprobante-pago' | 'expediente';

interface Expediente {
  documento: DocumentoDetalle;
  requerimiento: Requerimiento | null;
  cuadro_comparativo: CuadroComparativo | null;
  recepciones: { id: number; numero: string; fecha: string; estado: string; lineas: number }[];
}

/**
 * Formatos para imprimir o guardar como PDF desde el navegador (sin menú lateral):
 * FUR, cuadro comparativo, documento de origen, comprobante de pago y expediente de pago.
 */
@Component({
  selector: 'app-imprimir',
  standalone: true,
  templateUrl: './imprimir.html',
  styleUrl: './imprimir.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImprimirComponent {
  private readonly imprimirService = inject(ImprimirService);
  private readonly requerimientos = inject(RequerimientosService);
  private readonly documentos = inject(AdministracionDocumentosService);
  private readonly tesoreria = inject(TesoreriaService);
  private readonly route = inject(ActivatedRoute);

  protected readonly fmtMoney = fmtMoney;
  protected readonly fmtNum = fmtNum;
  protected readonly tipoLabel = TIPO_LABEL;
  protected readonly claseLabel = CLASE_LABEL;
  protected readonly medioLabel = MEDIO_PAGO_LABEL;
  protected readonly hoy = new Date().toLocaleDateString('es-PE');

  protected readonly tipo = (this.route.snapshot.data['tipo'] ?? 'fur') as TipoImpresion;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly empresa = signal<EmpresaCabecera | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal('');

  protected readonly fur = signal<Requerimiento | null>(null);
  protected readonly cuadro = signal<CuadroComparativo | null>(null);
  protected readonly documento = signal<DocumentoDetalle | null>(null);
  protected readonly pago = signal<Pago | null>(null);
  protected readonly expediente = signal<Expediente | null>(null);

  protected readonly titulo = computed(() => {
    switch (this.tipo) {
      case 'fur': return 'FORMATO ÚNICO DE REQUERIMIENTO (FUR)';
      case 'cuadro-comparativo': return 'CUADRO COMPARATIVO DE COTIZACIONES';
      case 'documento-origen': return 'DOCUMENTO DE ORIGEN';
      case 'comprobante-pago': return 'COMPROBANTE DE PAGO';
      default: return 'EXPEDIENTE DE PAGO';
    }
  });

  constructor() {
    this.imprimirService.getEmpresas().subscribe({
      next: (r) => this.empresa.set(Array.isArray(r) ? (r[0] ?? null) : null),
      error: () => this.empresa.set(null),
    });
    this.cargar();
  }

  private cargar(): void {
    const fallo = (err: unknown) => {
      this.error.set(errorMessage(err));
      this.isLoading.set(false);
    };
    switch (this.tipo) {
      case 'fur':
        this.requerimientos.getById(this.id).subscribe({ next: (r) => this.listo(() => this.fur.set(r)), error: fallo });
        break;
      case 'cuadro-comparativo':
        this.requerimientos.getById(this.id).subscribe({
          next: (r) => {
            this.fur.set(r);
            this.requerimientos.getCuadroComparativo(this.id).subscribe({ next: (c) => this.listo(() => this.cuadro.set(c)), error: fallo });
          },
          error: fallo,
        });
        break;
      case 'documento-origen':
        this.documentos.getById(this.id).subscribe({ next: (d) => this.listo(() => this.documento.set(d)), error: fallo });
        break;
      case 'comprobante-pago':
        this.tesoreria.getPago(this.id).subscribe({ next: (p) => this.listo(() => this.pago.set(p)), error: fallo });
        break;
      default:
        this.documentos.getExpediente(this.id).subscribe({ next: (e) => this.listo(() => this.expediente.set(e as Expediente)), error: fallo });
    }
  }

  private listo(asignar: () => void): void {
    asignar();
    this.isLoading.set(false);
  }

  protected oferta(c: CuadroComparativo, idDetalle: number, idCotizacion: number) {
    return c.lineas.find((l) => l.id_detalle === idDetalle)?.ofertas.find((o) => o.id_cotizacion === idCotizacion);
  }

  protected cerrar(): void {
    window.close();
  }

  protected imprimir(): void {
    window.print();
  }
}
