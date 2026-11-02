import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeError } from '@shared/utils/errores-http';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { AnexosService } from '../../anexos/anexos.service';
import { ESTADOS_EQUIPO, hoyISO } from '../../anexos/equipo-presentacion';
import { EquiposTrabajadorService } from '../../anexos/equipos-trabajador.service';
import { AnexoSelect } from '../../anexos/interfaces/anexos.interface';
import {
  AreaOpcion,
  BienCatalogo,
  CodigoEstadoEquipo,
  EquipoInventario,
  LocalOpcion,
  OpcionDestino,
} from '../../anexos/interfaces/equipo-asignado.interface';
import { UbicacionDestinoComponent } from '../../anexos/ubicacion-destino/ubicacion-destino';
import {
  DESTINO_VACIO,
  DestinoSeleccionado,
  cuerpoDestino,
  errorDestino,
} from '../../anexos/ubicacion-destino/ubicacion-destino.util';

/** Registro de un activo fijo en el inventario: bien del catálogo, serie, destino y, si se desea, quien lo recibe. */
@Component({
  selector: 'app-registro-activo-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, UbicacionDestinoComponent],
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
  readonly empresas = signal<OpcionDestino[]>([]);
  readonly centrosCosto = signal<OpcionDestino[]>([]);
  readonly trabajadores = signal<AnexoSelect[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  /** A dónde va: una empresa (con nivel, ambiente y área) o un centro de costo. */
  readonly ubicacion = signal<DestinoSeleccionado>(DESTINO_VACIO);

  /** Heredan los valores del catálogo; editar uno solo cambia esa característica en este equipo. */
  readonly caracteristicas = new FormRecord<FormControl<string>>({});

  readonly form = this.fb.nonNullable.group({
    codigoBien: ['', Validators.required],
    serie: [''],
    estado: ['OPERATIVO' as CodigoEstadoEquipo],
    entregar: [false],
    anexoId: [0],
    fechaAsignacion: [hoyISO()],
    caracteristicas: this.caracteristicas,
  });

  private readonly codigoSel = toSignal(this.form.controls.codigoBien.valueChanges, { initialValue: '' });
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
  readonly entregar = computed(() => this.entregarSel());
  protected readonly estadosEquipo = ESTADOS_EQUIPO;

  constructor() {
    this.form.controls.codigoBien.valueChanges.pipe(takeUntilDestroyed()).subscribe((codigo) => {
      Object.keys(this.caracteristicas.controls).forEach((nombre) => this.caracteristicas.removeControl(nombre));
      const bien = this.catalogo().find((b) => b.codigo === codigo);
      for (const [nombre, valor] of Object.entries(bien?.caracteristicas ?? {})) {
        this.caracteristicas.addControl(nombre, this.fb.nonNullable.control(valor));
      }
    });
  }

  ngOnInit(): void {
    this.service.getOpciones().subscribe({
      next: (opciones) => {
        this.catalogo.set(opciones.catalogo);
        this.locales.set(opciones.locales);
        this.areas.set(opciones.areas);
        this.empresas.set(opciones.empresas);
        this.centrosCosto.set(opciones.centrosCosto);
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
    const errorUbicacion = errorDestino(this.ubicacion());
    if (errorUbicacion) {
      this.error.set(errorUbicacion);
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
        estado: v.estado,
        ...cuerpoDestino(this.ubicacion()),
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
}
