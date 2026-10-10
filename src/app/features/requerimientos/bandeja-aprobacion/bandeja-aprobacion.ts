import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select';
import { DataTable } from '../../../shared/interfaces';
import { errorMessage, fmtNum } from '../../almacen/almacen.utils';
import { Requerimiento, RequerimientoLinea, SelectOption } from '../requerimientos.models';
import { RequerimientosService } from '../requerimientos.service';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;

function aprobacionGroup(linea: RequerimientoLinea) {
  return new FormGroup({
    id_detalle: new FormControl(linea.id, { nonNullable: true }),
    cantidad_aprobada: new FormControl(String(Number(linea.cantidad)), { nonNullable: true }),
  });
}

type AprobacionGroup = ReturnType<typeof aprobacionGroup>;

/** Bandeja de requerimientos ENVIADOS: el aprobador revisa, ajusta cantidades y aprueba, observa o rechaza. */
@Component({
  selector: 'app-bandeja-aprobacion',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DataTableComponent, ModalComponent, SearchSelectComponent],
  templateUrl: './bandeja-aprobacion.html',
  styleUrl: './bandeja-aprobacion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BandejaAprobacionComponent {
  private readonly service = inject(RequerimientosService);

  protected readonly fmtNum = fmtNum;
  protected readonly columns: DataTable[] = [
    { label: 'Número', width: '120px' },
    { label: 'Fecha', width: '100px' },
    { label: 'Centro de costos' },
    { label: 'Solicitante', width: '180px' },
    { label: 'Justificación' },
    { label: 'Líneas', align: 'center', width: '70px' },
    { label: 'Acciones', align: 'center', width: '110px' },
  ];

  protected readonly items = signal<Requerimiento[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly isLoading = signal(false);
  protected readonly message = signal('');
  protected readonly trabajadores = signal<SelectOption[]>([]);

  protected readonly seleccionado = signal<Requerimiento | null>(null);
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly modalError = signal('');
  protected readonly revision = new FormGroup({
    id_aprobador: new FormControl<number | null>(null),
    comentario: new FormControl('', { nonNullable: true }),
    lineas: new FormArray<AprobacionGroup>([]),
  });

  constructor() {
    this.service.getTrabajadoresSelect().subscribe({ next: (r) => this.trabajadores.set(r), error: () => this.trabajadores.set([]) });
    this.load();
  }

  protected get lineas(): FormArray<AprobacionGroup> {
    return this.revision.controls.lineas;
  }

  protected load(): void {
    this.isLoading.set(true);
    this.service.getAll({ estado: 'ENVIADO', page: this.page(), pageSize: this.pageSize() }).subscribe({
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

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  protected revisar(item: Requerimiento): void {
    this.modalError.set('');
    this.seleccionado.set(null);
    this.isModalOpen.set(true);
    this.service.getById(item.id).subscribe({
      next: (r) => {
        this.seleccionado.set(r);
        this.revision.reset({ id_aprobador: null, comentario: '' });
        this.lineas.clear();
        for (const l of r.lineas ?? []) this.lineas.push(aprobacionGroup(l));
      },
      error: (err) => this.modalError.set(errorMessage(err)),
    });
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
    this.seleccionado.set(null);
  }

  protected aprobar(): void {
    const r = this.seleccionado();
    const idAprobador = this.revision.controls.id_aprobador.value;
    if (!r) return;
    if (!idAprobador) return this.modalError.set('Seleccione al aprobador.');
    const lineas = this.lineas.getRawValue();
    for (const [i, l] of lineas.entries()) {
      const pedido = Number(r.lineas?.[i]?.cantidad ?? 0);
      const valor = l.cantidad_aprobada.trim();
      if (!DECIMAL.test(valor)) return this.modalError.set(`Línea ${i + 1}: la cantidad aprobada no es válida.`);
      if (Number(valor) > pedido) return this.modalError.set(`Línea ${i + 1}: no se puede aprobar más de lo solicitado (${fmtNum(pedido)}).`);
    }
    if (!lineas.some((l) => Number(l.cantidad_aprobada) > 0)) {
      return this.modalError.set('Apruebe al menos una línea con cantidad mayor a 0, o rechace el requerimiento.');
    }
    this.resolver(
      this.service.aprobar(r.id, {
        id_aprobador: idAprobador,
        comentario: this.revision.controls.comentario.value.trim() || undefined,
        lineas: lineas.map((l) => ({ id_detalle: l.id_detalle, cantidad_aprobada: l.cantidad_aprobada.trim() })),
      }),
      `${r.numero} aprobado.`,
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
    if (!r) return;
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
      error: (err) => {
        this.isSaving.set(false);
        this.modalError.set(errorMessage(err));
      },
    });
  }
}
