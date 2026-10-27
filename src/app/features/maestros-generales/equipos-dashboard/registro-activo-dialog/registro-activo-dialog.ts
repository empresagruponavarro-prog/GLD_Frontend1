import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeError } from '@shared/utils/errores-http';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { AnexosService } from '../../anexos/anexos.service';
import { hoyISO } from '../../anexos/equipo-presentacion';
import { EquiposTrabajadorService } from '../../anexos/equipos-trabajador.service';
import { AnexoSelect } from '../../anexos/interfaces/anexos.interface';
import {
  AreaOpcion,
  BienCatalogo,
  EquipoInventario,
  LocalOpcion,
} from '../../anexos/interfaces/equipo-asignado.interface';

/** Registro de un activo fijo en el inventario: bien del catálogo, serie, ubicación y, si se desea, quien lo recibe. */
@Component({
  selector: 'app-registro-activo-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registro-activo-dialog.html',
  styleUrl: './registro-activo-dialog.css',
})
export class RegistroActivoDialogComponent implements OnInit {
  private readonly service = inject(EquiposTrabajadorService);
  private readonly anexos = inject(AnexosService);
  private readonly fb = inject(FormBuilder);

  readonly cerrar = output<void>();
  readonly registrado = output<EquipoInventario>();

  readonly catalogo = signal<BienCatalogo[]>([]);
  readonly locales = signal<LocalOpcion[]>([]);
  readonly areas = signal<AreaOpcion[]>([]);
  readonly trabajadores = signal<AnexoSelect[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  /** Heredan los valores del catálogo; editar uno solo cambia esa característica en este equipo. */
  readonly caracteristicas = new FormRecord<FormControl<string>>({});

  readonly form = this.fb.nonNullable.group({
    codigoBien: ['', Validators.required],
    serie: [''],
    localId: [0],
    nivelId: [{ value: 0, disabled: true }],
    ambienteId: [{ value: 0, disabled: true }],
    areaId: [0],
    entregar: [false],
    anexoId: [0],
    fechaAsignacion: [hoyISO()],
    caracteristicas: this.caracteristicas,
  });

  private readonly codigoSel = toSignal(this.form.controls.codigoBien.valueChanges, { initialValue: '' });
  private readonly localSel = toSignal(this.form.controls.localId.valueChanges, { initialValue: 0 });
  private readonly nivelSel = toSignal(this.form.controls.nivelId.valueChanges, { initialValue: 0 });
  private readonly entregarSel = toSignal(this.form.controls.entregar.valueChanges, { initialValue: false });
  private readonly valoresCaracteristicas = toSignal(this.caracteristicas.valueChanges, {
    initialValue: {} as Record<string, string>,
  });

  readonly equiposPorTipo = computed(() => {
    const porTipo = new Map<string, BienCatalogo[]>();
    for (const bien of this.catalogo()) porTipo.set(bien.tipo, [...(porTipo.get(bien.tipo) ?? []), bien]);
    return [...porTipo.entries()];
  });
  readonly bienSeleccionado = computed(() => this.catalogo().find((b) => b.codigo === this.codigoSel()));
  readonly filasCaracteristicas = computed(() => {
    const valores = this.valoresCaracteristicas();
    return Object.entries(this.bienSeleccionado()?.caracteristicas ?? {}).map(([nombre, base]) => ({
      nombre,
      personalizada: (valores[nombre] ?? base) !== base,
    }));
  });
  readonly niveles = computed(() => this.locales().find((l) => l.id === this.localSel())?.niveles ?? []);
  readonly ambientes = computed(() => this.niveles().find((n) => n.id === this.nivelSel())?.ambientes ?? []);
  readonly entregar = computed(() => this.entregarSel());

  constructor() {
    const c = this.form.controls;
    c.codigoBien.valueChanges.pipe(takeUntilDestroyed()).subscribe((codigo) => {
      Object.keys(this.caracteristicas.controls).forEach((nombre) => this.caracteristicas.removeControl(nombre));
      const bien = this.catalogo().find((b) => b.codigo === codigo);
      for (const [nombre, valor] of Object.entries(bien?.caracteristicas ?? {})) {
        this.caracteristicas.addControl(nombre, this.fb.nonNullable.control(valor));
      }
    });
    c.localId.valueChanges.pipe(takeUntilDestroyed()).subscribe((local) => {
      c.nivelId.setValue(0);
      this.habilitar(c.nivelId, local > 0);
    });
    c.nivelId.valueChanges.pipe(takeUntilDestroyed()).subscribe((nivel) => {
      c.ambienteId.setValue(0);
      this.habilitar(c.ambienteId, nivel > 0);
    });
    c.ambienteId.valueChanges.pipe(takeUntilDestroyed()).subscribe((ambiente) => {
      c.areaId.setValue(this.areaDeAmbiente(c.localId.value, c.nivelId.value, ambiente));
    });
  }

  ngOnInit(): void {
    this.service.getOpciones().subscribe({
      next: (opciones) => {
        this.catalogo.set(opciones.catalogo);
        this.locales.set(opciones.locales);
        this.areas.set(opciones.areas);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeError(err));
        this.cargando.set(false);
      },
    });
    this.anexos.getSelect('Trabajador').subscribe({
      next: (lista) => this.trabajadores.set(lista),
      error: () => this.trabajadores.set([]),
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cerrar.emit();
  }

  protected restaurar(nombre: string): void {
    const base = this.bienSeleccionado()?.caracteristicas[nombre];
    if (base !== undefined) this.caracteristicas.controls[nombre]?.setValue(base);
  }

  protected guardar(): void {
    const v = this.form.getRawValue();
    if (!v.codigoBien) {
      this.error.set('Selecciona un bien del catálogo.');
      return;
    }
    if (v.localId < 1 || v.nivelId < 1 || v.ambienteId < 1) {
      this.error.set('Selecciona local, nivel y ambiente.');
      return;
    }
    if (v.entregar && (v.anexoId < 1 || !v.fechaAsignacion)) {
      this.error.set('Selecciona al trabajador y la fecha de entrega.');
      return;
    }

    this.error.set(null);
    this.guardando.set(true);
    this.service
      .registrarActivo({
        codigoBien: v.codigoBien,
        serie: v.serie.trim() || null,
        localId: v.localId,
        nivelId: v.nivelId,
        ambienteId: v.ambienteId,
        ...(v.areaId > 0 ? { areaId: v.areaId } : {}),
        caracteristicas: v.caracteristicas,
        ...(v.entregar ? { anexoId: v.anexoId, fechaAsignacion: v.fechaAsignacion } : {}),
      })
      .subscribe({
        next: (equipo) => {
          this.guardando.set(false);
          this.registrado.emit(equipo);
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.error.set(mensajeError(err));
        },
      });
  }

  /** Área por defecto de la ubicación elegida (0 = sin área). */
  private areaDeAmbiente(localId: number, nivelId: number, ambienteId: number): number {
    const nivel = this.locales()
      .find((l) => l.id === localId)
      ?.niveles.find((n) => n.id === nivelId);
    return nivel?.ambientes.find((a) => a.id === ambienteId)?.areaId ?? 0;
  }

  private habilitar(control: AbstractControl, habilitar: boolean): void {
    if (habilitar) control.enable({ emitEvent: false });
    else control.disable({ emitEvent: false });
  }
}
