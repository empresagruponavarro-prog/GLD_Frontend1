import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select';
import { DataTable } from '../../../shared/interfaces';
import { AlmacenService } from '../almacen.service';
import { RecepcionOrdenCompra, RecepcionPayload, RecepcionPendiente, SelectOption } from '../almacen.models';
import { errorMessage, fmtMoney, fmtNum, todayISO } from '../almacen.utils';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;

function lineaGroup(idDetalle: number, saldo: string) {
  return new FormGroup({
    id_detalle: new FormControl(idDetalle, { nonNullable: true }),
    cantidad: new FormControl(String(Number(saldo)), { nonNullable: true }),
  });
}

type LineaGroup = ReturnType<typeof lineaGroup>;

/** Recepción de compras: convierte los productos de una OC en un ingreso COMPRA de almacén. */
@Component({
  selector: 'app-recepciones',
  standalone: true,
  imports: [ReactiveFormsModule, DataTableComponent, ModalComponent, SearchSelectComponent],
  templateUrl: './recepciones.html',
  styleUrl: './recepciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecepcionesComponent {
  private readonly service = inject(AlmacenService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly fmtNum = fmtNum;
  protected readonly fmtMoney = fmtMoney;

  protected readonly columns: DataTable[] = [
    { label: 'OC', width: '130px' },
    { label: 'Emisión', width: '100px' },
    { label: 'Proveedor' },
    { label: 'Centro de costos' },
    { label: 'Requerimiento', width: '130px' },
    { label: 'Total', align: 'right', width: '120px' },
    { label: 'Pendientes', align: 'center', width: '100px' },
    { label: 'Acciones', align: 'center', width: '110px' },
  ];

  protected readonly items = signal<RecepcionPendiente[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly search = signal('');
  protected readonly message = signal('');
  protected readonly almacenes = signal<SelectOption[]>([]);
  protected readonly trabajadores = signal<SelectOption[]>([]);

  protected readonly oc = signal<RecepcionOrdenCompra | null>(null);
  protected readonly isModalOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly form = new FormGroup({
    fecha: new FormControl(todayISO(), { nonNullable: true, validators: [Validators.required] }),
    id_almacen: new FormControl<number | null>(null, { validators: [Validators.required] }),
    id_recibido_por: new FormControl<number | null>(null),
    tipo_cambio: new FormControl('', { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true }),
    lineas: new FormArray<LineaGroup>([]),
  });

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
    this.service.getAlmacenesSelect().subscribe({ next: (r) => this.almacenes.set(r), error: () => this.almacenes.set([]) });
    this.service.getTrabajadoresSelect().subscribe({ next: (r) => this.trabajadores.set(r), error: () => this.trabajadores.set([]) });
    this.load();
  }

  protected get lineas(): FormArray<LineaGroup> {
    return this.form.controls.lineas;
  }

  protected load(): void {
    this.isLoading.set(true);
    this.service.getRecepcionesPendientes(this.search().trim() || undefined).subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.isLoading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.isLoading.set(false);
      },
    });
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 350);
  }

  protected recibir(item: RecepcionPendiente): void {
    this.formError.set('');
    this.oc.set(null);
    this.isModalOpen.set(true);
    this.service.getOrdenCompraParaRecepcion(item.id).subscribe({
      next: (oc) => {
        this.oc.set(oc);
        this.form.reset({ fecha: todayISO(), id_almacen: null, id_recibido_por: null, tipo_cambio: '', observaciones: '' });
        this.lineas.clear();
        for (const l of oc.lineas) this.lineas.push(lineaGroup(l.id_detalle, l.saldo));
      },
      error: (err) => this.formError.set(errorMessage(err)),
    });
  }

  protected closeModal(): void {
    this.isModalOpen.set(false);
    this.oc.set(null);
  }

  protected save(): void {
    const oc = this.oc();
    if (!oc) return;
    const error = this.validate(oc);
    if (error) {
      this.formError.set(error);
      return;
    }
    const v = this.form.getRawValue();
    const text = (s: string) => s.trim() || undefined;
    const payload: RecepcionPayload = {
      id_orden_compra: oc.id,
      id_almacen: v.id_almacen as number,
      fecha: v.fecha,
      id_recibido_por: v.id_recibido_por ?? undefined,
      tipo_cambio: oc.es_soles ? undefined : text(v.tipo_cambio),
      observaciones: text(v.observaciones),
      lineas: v.lineas
        .filter((l) => Number(l.cantidad) > 0)
        .map((l) => ({ id_orden_compra_detalle: l.id_detalle, cantidad: l.cantidad.trim() })),
    };
    this.isSaving.set(true);
    this.formError.set('');
    this.service.recibirOrdenCompra(payload).subscribe({
      next: (doc) => {
        this.isSaving.set(false);
        this.closeModal();
        this.message.set(`Recepción registrada: ${doc.numero} (${oc.numero_oc ?? oc.id_oc ?? 'OC ' + oc.id}).`);
        this.load();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }

  private validate(oc: RecepcionOrdenCompra): string | null {
    const v = this.form.getRawValue();
    if (!v.fecha) return 'Indique la fecha.';
    if (!v.id_almacen) return 'Seleccione el almacén que recibe.';
    if (!oc.es_soles) {
      const tc = v.tipo_cambio.trim();
      if (!DECIMAL.test(tc) || Number(tc) <= 0) return 'La OC no está en soles: indique un tipo de cambio mayor a 0.';
    }
    let hayCantidad = false;
    for (const [i, l] of v.lineas.entries()) {
      const linea = oc.lineas[i];
      const valor = l.cantidad.trim();
      if (valor === '' || Number(valor) === 0) continue;
      if (!DECIMAL.test(valor)) return `${linea.descripcion}: la cantidad no es válida (hasta 4 decimales).`;
      if (Number(valor) > Number(linea.saldo)) return `${linea.descripcion}: no puede recibir más del saldo (${fmtNum(linea.saldo)}).`;
      hayCantidad = true;
    }
    return hayCantidad ? null : 'Indique la cantidad recibida de al menos un producto.';
  }
}
