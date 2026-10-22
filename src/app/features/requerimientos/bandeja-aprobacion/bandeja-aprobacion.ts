import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select';
import { DataTable } from '../../../shared/interfaces';
import { errorMessage } from '@shared/utils/errores-http';
import { fmtMoney, fmtNum } from '@shared/utils/formato';
import {
  CuadroComparativo,
  CuadroLinea,
  CuadroOferta,
  CuadroProveedor,
  ESTADO_LABEL,
  MEDIO_PAGO_LABEL,
  Requerimiento,
  RequerimientoLinea,
  SelectOption,
  TIPO_LABEL,
} from '../requerimientos.models';
import { RequerimientosService } from '../requerimientos.service';
import { estadoBadge } from '../requerimientos.utils';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;

function aprobacionGroup(linea: RequerimientoLinea) {
  return new FormGroup({
    id_detalle: new FormControl(linea.id, { nonNullable: true }),
    cantidad_aprobada: new FormControl(String(Number(linea.cantidad)), { nonNullable: true }),
  });
}

type AprobacionGroup = ReturnType<typeof aprobacionGroup>;

/**
 * Bandeja de aprobación. Las compras llegan COTIZADAS: el aprobador ve el cuadro comparativo completo y elige
 * al ganador (no necesariamente el más barato). Los demás tipos (planillas, caja chica…) llegan ENVIADOS.
 */
@Component({
  selector: 'app-bandeja-aprobacion',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DataTableComponent, ModalComponent, SearchSelectComponent],
  templateUrl: './bandeja-aprobacion.html',
  styleUrl: './bandeja-aprobacion.css',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BandejaAprobacionComponent {
  private readonly service = inject(RequerimientosService);
  /**
   * "Revisar" es de lectura (siempre visible). Observar / Rechazar / Aprobar y elegir al ganador →
   * aprobar (`FlujoAprobacionController`); sin él, la revisión queda en solo lectura.
   * Imprimir el cuadro comparativo es libre.
   */
  protected readonly permisos = permisosDePantalla('requerimientos.aprobacion');

  protected readonly fmtNum = fmtNum;
  protected readonly fmtMoney = fmtMoney;
  protected readonly estadoBadge = estadoBadge;
  protected readonly estadoLabel = ESTADO_LABEL;
  protected readonly tipoLabel = TIPO_LABEL;
  protected readonly medioLabel = MEDIO_PAGO_LABEL;
  protected readonly columns: DataTable[] = [
    { label: 'Número', width: '120px' },
    { label: 'Fecha', width: '100px' },
    { label: 'Tipo', width: '190px' },
    { label: 'Centro de costos' },
    { label: 'Solicitante', width: '170px' },
    { label: 'Justificación' },
    { label: 'Estado', align: 'center', width: '110px' },
    { label: 'Acciones', align: 'center', width: '110px' },
  ];

  private readonly todos = signal<Requerimiento[]>([]);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly total = computed(() => this.todos().length);
  protected readonly items = computed(() => {
    const desde = (this.page() - 1) * this.pageSize();
    return this.todos().slice(desde, desde + this.pageSize());
  });
  protected readonly isLoading = signal(false);
  protected readonly message = signal('');
  protected readonly trabajadores = signal<SelectOption[]>([]);

  protected readonly seleccionado = signal<Requerimiento | null>(null);
  protected readonly cuadro = signal<CuadroComparativo | null>(null);
  protected readonly ganadora = signal<number | null>(null);
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');

  protected readonly esCompra = computed(() => this.seleccionado()?.tipo === 'COMPRA');
  protected readonly proveedorGanador = computed<CuadroProveedor | null>(
    () => this.cuadro()?.proveedores.find((p) => p.id_cotizacion === this.ganadora()) ?? null,
  );
  /** Qué documentos se generarán con el ganador elegido (OC para bienes, OS para servicios). */
  protected readonly vistaPrevia = computed(() => {
    const r = this.seleccionado();
    const g = this.proveedorGanador();
    if (!r || !g) return '';
    const lineas = r.lineas ?? [];
    const bienes = lineas.filter((l) => l.tipo_producto === 'PRODUCTO' && this.cantidadAprobable(l.id) > 0).length;
    const servicios = lineas.filter((l) => l.tipo_producto === 'SERVICIO' && this.cantidadAprobable(l.id) > 0).length;
    const partes = [
      bienes ? `una orden de compra (${bienes} ${bienes === 1 ? 'ítem' : 'ítems'})` : '',
      servicios ? `una orden de servicio (${servicios} ${servicios === 1 ? 'ítem' : 'ítems'})` : '',
    ].filter(Boolean);
    return partes.length ? `Al aprobar se generará ${partes.join(' y ')} a nombre de ${g.proveedor ?? 'el proveedor'}.` : '';
  });

  protected readonly revision = new FormGroup({
    id_aprobador: new FormControl<number | null>(null),
    comentario: new FormControl('', { nonNullable: true }),
    comentario_adjudicacion: new FormControl('', { nonNullable: true }),
    lineas: new FormArray<AprobacionGroup>([]),
  });

  constructor() {
    this.service.getTrabajadoresSelect().subscribe({ next: (r) => this.trabajadores.set(r), error: () => this.trabajadores.set([]) });
    // Sin permiso de aprobar, el formulario de la revisión queda en solo lectura.
    effect(() => {
      this.permisos.aprobar();
      this.aplicarEdicionRevision();
    });
    this.load();
  }

  /** Habilita o deshabilita el formulario de la revisión según el permiso de aprobar. */
  private aplicarEdicionRevision(): void {
    if (this.permisos.aprobar()) this.revision.enable({ emitEvent: false });
    else this.revision.disable({ emitEvent: false });
  }

  protected get lineas(): FormArray<AprobacionGroup> {
    return this.revision.controls.lineas;
  }

  protected load(): void {
    this.isLoading.set(true);
    forkJoin([
      this.service.getAll({ estado: 'COTIZADO', pageSize: 100 }),
      this.service.getAll({ estado: 'ENVIADO', pageSize: 100 }),
    ]).subscribe({
      next: ([cotizados, enviados]) => {
        // Una compra ENVIADA todavía está en cotización: no es para esta bandeja.
        const pendientes = [...cotizados.data, ...enviados.data.filter((r) => r.tipo !== 'COMPRA')];
        this.todos.set(pendientes.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id));
        this.isLoading.set(false);
      },
      error: () => {
        this.todos.set([]);
        this.isLoading.set(false);
      },
    });
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  protected revisar(item: Requerimiento): void {
    this.modalError.set('');
    this.seleccionado.set(null);
    this.cuadro.set(null);
    this.ganadora.set(null);
    this.isModalOpen.set(true);
    this.service.getById(item.id).subscribe({
      next: (r) => {
        this.revision.reset({ id_aprobador: null, comentario: '', comentario_adjudicacion: '' });
        this.lineas.clear();
        for (const l of r.lineas ?? []) this.lineas.push(aprobacionGroup(l));
        // Las líneas nuevas nacen habilitadas: se reaplica el solo lectura si no hay permiso.
        this.aplicarEdicionRevision();
        this.seleccionado.set(r);
        if (r.tipo === 'COMPRA') {
          this.service.getCuadroComparativo(r.id).subscribe({
            next: (c) => this.cuadro.set(c),
            error: (err: unknown) => this.modalError.set(errorMessage(err)),
          });
        }
      },
      error: (err: unknown) => this.modalError.set(errorMessage(err)),
    });
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
    this.seleccionado.set(null);
    this.cuadro.set(null);
  }

  // ------------------------------------------------------- cuadro comparativo
  protected oferta(linea: CuadroLinea, idCotizacion: number): CuadroOferta | undefined {
    return linea.ofertas.find((o) => o.id_cotizacion === idCotizacion);
  }

  /** Elegir al ganador: las líneas que no cotiza quedan en 0 y las demás en lo que ofrece. */
  protected elegir(p: CuadroProveedor): void {
    if (!this.permisos.aprobar()) return;
    this.ganadora.set(p.id_cotizacion);
    this.modalError.set('');
    for (const g of this.lineas.controls) {
      g.controls.cantidad_aprobada.setValue(String(this.cantidadAprobable(g.controls.id_detalle.value, p.id_cotizacion)));
    }
  }

  private cantidadAprobable(idDetalle: number, idCotizacion: number | null = this.ganadora()): number {
    const linea = this.seleccionado()?.lineas?.find((l) => l.id === idDetalle);
    const cuadro = this.cuadro();
    if (!linea) return 0;
    if (idCotizacion === null || !cuadro) return Number(linea.cantidad);
    const o = cuadro.lineas.find((l) => l.id_detalle === idDetalle)?.ofertas.find((x) => x.id_cotizacion === idCotizacion);
    return o && o.cotiza ? Math.min(Number(linea.cantidad), Number(o.cantidad)) : 0;
  }

  // ------------------------------------------------------------------ acciones
  protected aprobar(): void {
    const r = this.seleccionado();
    const idAprobador = this.revision.controls.id_aprobador.value;
    if (!r || !this.permisos.aprobar()) return;
    if (!idAprobador) return this.modalError.set('Seleccione al aprobador.');
    if (this.esCompra() && this.ganadora() === null) return this.modalError.set('Elija la cotización ganadora en el cuadro comparativo.');
    const lineas = this.lineas.getRawValue();
    for (const [i, l] of lineas.entries()) {
      const pedido = Number(r.lineas?.[i]?.cantidad ?? 0);
      const valor = l.cantidad_aprobada.trim();
      if (!DECIMAL.test(valor)) return this.modalError.set(`Línea ${i + 1}: la cantidad aprobada no es válida.`);
      if (Number(valor) > pedido) return this.modalError.set(`Línea ${i + 1}: no se puede aprobar más de lo solicitado (${fmtNum(pedido)}).`);
      if (this.esCompra() && Number(valor) > this.cantidadAprobable(l.id_detalle)) {
        return this.modalError.set(`Línea ${i + 1}: el ganador no ofrece esa cantidad (máximo ${fmtNum(this.cantidadAprobable(l.id_detalle))}).`);
      }
    }
    if (!lineas.some((l) => Number(l.cantidad_aprobada) > 0)) {
      return this.modalError.set('Apruebe al menos una línea con cantidad mayor a 0, o rechace el requerimiento.');
    }
    this.resolver(
      this.service.aprobar(r.id, {
        id_aprobador: idAprobador,
        comentario: this.revision.controls.comentario.value.trim() || undefined,
        id_cotizacion_ganadora: this.esCompra() ? (this.ganadora() ?? undefined) : undefined,
        comentario_adjudicacion: this.revision.controls.comentario_adjudicacion.value.trim() || undefined,
        lineas: lineas.map((l) => ({ id_detalle: l.id_detalle, cantidad_aprobada: l.cantidad_aprobada.trim() })),
      }),
      `${r.numero} aprobado: se generaron sus documentos de origen.`,
    );
  }

  protected observar(): void {
    this.resolverConComentario('observar');
  }

  protected rechazar(): void {
    this.resolverConComentario('rechazar');
  }

  private resolverConComentario(accion: 'observar' | 'rechazar'): void {
    const r = this.seleccionado();
    const idAprobador = this.revision.controls.id_aprobador.value;
    const comentario = this.revision.controls.comentario.value.trim();
    if (!r || !this.permisos.aprobar()) return;
    if (!idAprobador) return this.modalError.set('Seleccione al aprobador.');
    if (!comentario) return this.modalError.set(accion === 'observar' ? 'Indique qué debe corregir el solicitante.' : 'Indique el motivo del rechazo.');
    if (accion === 'observar') this.resolver(this.service.observar(r.id, idAprobador, comentario), `${r.numero} devuelto con observaciones.`);
    else this.resolver(this.service.rechazar(r.id, idAprobador, comentario), `${r.numero} rechazado.`);
  }

  private resolver(request$: ReturnType<RequerimientosService['aprobar']>, mensaje: string): void {
    this.isSaving.set(true);
    this.modalError.set('');
    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeModal();
        this.message.set(mensaje);
        this.load();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.modalError.set(errorMessage(err));
      },
    });
  }
}
