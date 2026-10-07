import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select';
import { DataTable } from '../../../shared/interfaces';
import { AlmacenService } from '../almacen.service';
import {
  CONDICION_LABEL,
  Condicion,
  ESTADO_PLAZO_LABEL,
  EstadoPlazo,
  EstadoPrestamo,
  Prestamo,
  PrestamoQuery,
  RetornoPayload,
  SelectOption,
} from '../almacen.models';
import { errorMessage, fmtNum, plazoBadge, todayISO } from '../almacen.utils';
import { ProductoElegido, ProductoPickerComponent } from '../producto-picker/producto-picker';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;

function lineaGroup() {
  return new FormGroup({
    id_producto: new FormControl<number | null>(null, { validators: [Validators.required] }),
    etiqueta: new FormControl('', { nonNullable: true }),
    disponible: new FormControl('', { nonNullable: true }),
    unidad: new FormControl('', { nonNullable: true }),
    cantidad: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(DECIMAL)] }),
  });
}

function retornoGroup(idDetalle: number, etiqueta: string, pendiente: string) {
  return new FormGroup({
    id_prestamo_detalle: new FormControl(idDetalle, { nonNullable: true }),
    etiqueta: new FormControl(etiqueta, { nonNullable: true }),
    pendiente: new FormControl(pendiente, { nonNullable: true }),
    cantidad: new FormControl('', { nonNullable: true, validators: [Validators.pattern(DECIMAL)] }),
    condicion: new FormControl<Condicion>('OPERATIVO', { nonNullable: true }),
    observaciones: new FormControl('', { nonNullable: true }),
  });
}

type LineaGroup = ReturnType<typeof lineaGroup>;
type RetornoGroup = ReturnType<typeof retornoGroup>;

@Component({
  selector: 'app-prestamos',
  standalone: true,
  imports: [ReactiveFormsModule, DataTableComponent, ModalComponent, SearchSelectComponent, ProductoPickerComponent],
  templateUrl: './prestamos.html',
  styleUrl: './prestamos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrestamosComponent {
  private readonly service = inject(AlmacenService);

  protected readonly plazoLabel = ESTADO_PLAZO_LABEL;
  protected readonly condicionLabel = CONDICION_LABEL;
  protected readonly plazoBadge = plazoBadge;
  protected readonly fmtNum = fmtNum;
  protected readonly plazos = Object.keys(ESTADO_PLAZO_LABEL) as EstadoPlazo[];
  protected readonly condiciones = Object.keys(CONDICION_LABEL) as Condicion[];

  protected readonly columns: DataTable[] = [
    { label: 'Número', width: '110px' },
    { label: 'Fecha', width: '100px' },
    { label: 'Responsable' },
    { label: 'Proyecto' },
    { label: 'Almacén', width: '130px' },
    { label: 'Retorno previsto', width: '120px' },
    { label: 'Días fuera', align: 'center', width: '90px' },
    { label: 'Plazo', align: 'center', width: '170px' },
    { label: 'Estado', align: 'center', width: '100px' },
    { label: 'Acciones', align: 'center', width: '140px' },
  ];

  // Listado
  protected readonly items = signal<Prestamo[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly isLoading = signal(false);
  protected readonly fEstado = signal<EstadoPrestamo | ''>('');
  protected readonly fPlazo = signal<EstadoPlazo | ''>('');
  protected readonly fNumero = signal('');

  // Catálogos
  protected readonly almacenes = signal<SelectOption[]>([]);
  protected readonly trabajadores = signal<SelectOption[]>([]);
  protected readonly centrosCostos = signal<SelectOption[]>([]);

  // Formulario de préstamo
  protected readonly isFormOpen = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly form = new FormGroup({
    fecha_prestamo: new FormControl(todayISO(), { nonNullable: true, validators: [Validators.required] }),
    id_almacen: new FormControl<number | null>(null, { validators: [Validators.required] }),
    id_responsable: new FormControl<number | null>(null, { validators: [Validators.required] }),
    id_centro_costo: new FormControl<number | null>(null),
    documento_referencia: new FormControl('', { nonNullable: true }),
    dias_autorizados: new FormControl(7, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    observaciones: new FormControl('', { nonNullable: true }),
    lineas: new FormArray<LineaGroup>([]),
  });

  // Retorno
  protected readonly isReturnOpen = signal(false);
  protected readonly returnTarget = signal<Prestamo | null>(null);
  protected readonly returnError = signal('');
  protected readonly returnForm = new FormGroup({
    fecha_retorno: new FormControl(todayISO(), { nonNullable: true, validators: [Validators.required] }),
    retornos: new FormArray<RetornoGroup>([]),
  });

  // Detalle
  protected readonly isDetailOpen = signal(false);
  protected readonly detail = signal<Prestamo | null>(null);

  private debounce: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.service.getAlmacenesSelect().subscribe({ next: (r) => this.almacenes.set(r), error: () => this.almacenes.set([]) });
    this.service.getTrabajadoresSelect().subscribe({ next: (r) => this.trabajadores.set(r), error: () => this.trabajadores.set([]) });
    this.service.getCentrosCostosSelect().subscribe({ next: (r) => this.centrosCostos.set(r), error: () => this.centrosCostos.set([]) });
    this.load();
  }

  protected get lineas(): FormArray<LineaGroup> {
    return this.form.controls.lineas;
  }

  protected get retornos(): FormArray<RetornoGroup> {
    return this.returnForm.controls.retornos;
  }

  // ---------------------------------------------------------------- listado
  protected load(): void {
    this.isLoading.set(true);
    const query: PrestamoQuery = {
      page: this.page(),
      pageSize: this.pageSize(),
      estado: this.fEstado() || undefined,
      estado_plazo: this.fPlazo() || undefined,
      numero: this.fNumero().trim() || undefined,
    };
    this.service.getPrestamos(query).subscribe({
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

  protected setEstado(value: string): void {
    this.fEstado.set(value as EstadoPrestamo | '');
    this.applyFilters();
  }

  protected setPlazo(value: string): void {
    this.fPlazo.set(value as EstadoPlazo | '');
    this.applyFilters();
  }

  protected onSearchNumero(value: string): void {
    this.fNumero.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.applyFilters(), 350);
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected resetFilters(): void {
    this.fEstado.set('');
    this.fPlazo.set('');
    this.fNumero.set('');
    this.applyFilters();
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

  // ------------------------------------------------------------ préstamo
  protected openCreate(): void {
    this.form.reset({
      fecha_prestamo: todayISO(),
      id_almacen: null,
      id_responsable: null,
      id_centro_costo: null,
      documento_referencia: '',
      dias_autorizados: 7,
      observaciones: '',
    });
    this.lineas.clear();
    this.addLinea();
    this.formError.set('');
    this.isFormOpen.set(true);
  }

  protected closeForm(): void {
    this.isFormOpen.set(false);
  }

  protected addLinea(): void {
    this.lineas.push(lineaGroup());
  }

  protected removeLinea(index: number): void {
    if (this.lineas.length > 1) this.lineas.removeAt(index);
  }

  protected onEquipoPicked(linea: LineaGroup, p: ProductoElegido): void {
    linea.patchValue({ id_producto: p.id, etiqueta: `${p.codigo} — ${p.descripcion}`, disponible: p.disponible, unidad: p.unidad });
  }

  protected save(): void {
    const v = this.form.getRawValue();
    const error = this.validate(v);
    if (error) {
      this.formError.set(error);
      return;
    }
    this.isSaving.set(true);
    this.formError.set('');
    this.service
      .createPrestamo({
        fecha_prestamo: v.fecha_prestamo,
        id_almacen: v.id_almacen as number,
        id_responsable: v.id_responsable as number,
        id_centro_costo: v.id_centro_costo ?? undefined,
        documento_referencia: v.documento_referencia.trim() || undefined,
        dias_autorizados: Number(v.dias_autorizados),
        observaciones: v.observaciones.trim() || undefined,
        lineas: v.lineas.map((l) => ({ id_producto: l.id_producto as number, cantidad: l.cantidad.trim() })),
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeForm();
          this.load();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.formError.set(errorMessage(err));
        },
      });
  }

  private validate(v: ReturnType<typeof this.form.getRawValue>): string | null {
    if (!v.fecha_prestamo) return 'Indique la fecha del préstamo.';
    if (!v.id_almacen) return 'Seleccione el almacén.';
    if (!v.id_responsable) return 'Seleccione el responsable que recibe los equipos.';
    if (!Number.isInteger(Number(v.dias_autorizados)) || Number(v.dias_autorizados) < 1) return 'Los días autorizados deben ser 1 o más.';
    const vistos = new Set<number>();
    for (const [i, l] of v.lineas.entries()) {
      if (!l.id_producto) return `Línea ${i + 1}: seleccione un equipo.`;
      if (vistos.has(l.id_producto)) return `Línea ${i + 1}: el equipo está repetido.`;
      vistos.add(l.id_producto);
      if (!DECIMAL.test(l.cantidad.trim()) || Number(l.cantidad) <= 0) return `Línea ${i + 1}: la cantidad debe ser mayor a 0.`;
    }
    return null;
  }

  protected anular(item: Prestamo): void {
    if (!confirm(`¿Anular el préstamo ${item.numero}? Los equipos volverán a estar disponibles.`)) return;
    this.service.anularPrestamo(item.id).subscribe({
      next: () => this.load(),
      error: (err) => alert(errorMessage(err)),
    });
  }

  // -------------------------------------------------------------- retorno
  protected openReturn(item: Prestamo): void {
    this.returnError.set('');
    this.service.getPrestamo(item.id).subscribe({
      next: (full) => {
        this.returnTarget.set(full);
        this.returnForm.controls.fecha_retorno.setValue(todayISO());
        this.retornos.clear();
        for (const l of full.lineas ?? []) {
          if (Number(l.cantidad_pendiente) > 0) {
            this.retornos.push(retornoGroup(l.id, `${l.codigo} — ${l.descripcion}`, l.cantidad_pendiente));
          }
        }
        this.isReturnOpen.set(true);
      },
      error: (err) => alert(errorMessage(err)),
    });
  }

  protected closeReturn(): void {
    this.isReturnOpen.set(false);
    this.returnTarget.set(null);
  }

  protected returnAll(group: RetornoGroup): void {
    group.controls.cantidad.setValue(group.controls.pendiente.value);
  }

  protected saveReturn(): void {
    const target = this.returnTarget();
    if (!target) return;
    const v = this.returnForm.getRawValue();
    if (!v.fecha_retorno) {
      this.returnError.set('Indique la fecha de retorno.');
      return;
    }
    const filas: RetornoPayload['retornos'] = [];
    for (const r of v.retornos) {
      const cantidad = r.cantidad.trim();
      if (cantidad === '' || Number(cantidad) === 0) continue;
      if (!DECIMAL.test(cantidad)) {
        this.returnError.set(`Cantidad no válida en ${r.etiqueta}.`);
        return;
      }
      if (Number(cantidad) > Number(r.pendiente)) {
        this.returnError.set(`${r.etiqueta}: solo quedan ${r.pendiente} pendientes.`);
        return;
      }
      filas.push({
        id_prestamo_detalle: r.id_prestamo_detalle,
        cantidad,
        condicion: r.condicion,
        observaciones: r.observaciones.trim() || undefined,
      });
    }
    if (filas.length === 0) {
      this.returnError.set('Indique la cantidad devuelta de al menos un equipo.');
      return;
    }
    this.isSaving.set(true);
    this.returnError.set('');
    this.service.registrarRetorno(target.id, { fecha_retorno: v.fecha_retorno, retornos: filas }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeReturn();
        this.load();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.returnError.set(errorMessage(err));
      },
    });
  }

  // -------------------------------------------------------------- detalle
  protected openDetail(item: Prestamo): void {
    this.detail.set(item);
    this.isDetailOpen.set(true);
    this.service.getPrestamo(item.id).subscribe({
      next: (full) => this.detail.set(full),
      error: (err) => alert(errorMessage(err)),
    });
  }

  protected closeDetail(): void {
    this.isDetailOpen.set(false);
    this.detail.set(null);
  }

  protected canReturn(item: Prestamo): boolean {
    return item.estado === 'ABIERTO' || item.estado === 'PARCIAL';
  }
}
