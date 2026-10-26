import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeError } from '@shared/utils/errores-http';
import { Observable } from 'rxjs';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { EquipoQrDialogComponent } from '../equipo-qr-dialog/equipo-qr-dialog';
import { AnexosService } from '../anexos.service';
import { EquiposTrabajadorService } from '../equipos-trabajador.service';
import { AnexoSelect } from '../interfaces/anexos.interface';
import {
  BienCatalogo,
  EquipoAsignado,
  EstadoEquipo,
  LocalOpcion,
  TrabajadorResumen,
} from '../interfaces/equipo-asignado.interface';

const ICONOS_POR_TIPO: readonly (readonly [string, string])[] = [
  ['laptop', 'fa-laptop'],
  ['notebook', 'fa-laptop'],
  ['celular', 'fa-mobile-screen'],
  ['telefono', 'fa-mobile-screen'],
  ['tablet', 'fa-tablet-screen-button'],
  ['monitor', 'fa-desktop'],
  ['impresora', 'fa-print'],
  ['tv', 'fa-tv'],
  ['pc', 'fa-computer'],
  ['computad', 'fa-computer'],
];

const CLASE_ESTADO: Record<EstadoEquipo, string> = {
  Operativo: 'badge-completed',
  'En reparación': 'badge-pending',
  'De baja': 'badge-danger',
};

function hoyISO(): string {
  const d = new Date();
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

@Component({
  selector: 'app-equipos-trabajador-modal',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, ModalComponent, EquipoQrDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipos-trabajador-modal.html',
  styleUrl: './equipos-trabajador-modal.css',
})
export class EquiposTrabajadorModalComponent implements OnInit {
  private readonly service = inject(EquiposTrabajadorService);
  private readonly anexos = inject(AnexosService);
  private readonly fb = inject(FormBuilder);

  readonly trabajador = input.required<TrabajadorResumen>();
  /** Quien puede crear anexos puede asignarles equipos. */
  readonly puedeAsignar = input<boolean>(false);
  /** Quien puede editar anexos puede reasignar o devolver sus equipos. */
  readonly puedeGestionar = input<boolean>(false);
  readonly cerrar = output<void>();

  readonly equipos = signal<EquipoAsignado[]>([]);
  readonly cargando = signal(true);
  readonly errorCarga = signal<string | null>(null);

  readonly catalogo = signal<BienCatalogo[]>([]);
  readonly locales = signal<LocalOpcion[]>([]);
  readonly mostrarForm = signal(false);
  readonly guardando = signal(false);
  readonly errorForm = signal<string | null>(null);
  readonly qrEquipo = signal<EquipoAsignado | null>(null);

  // Reasignar / devolver
  readonly reasignando = signal<EquipoAsignado | null>(null);
  readonly trabajadores = signal<AnexoSelect[]>([]);
  readonly procesandoAccion = signal(false);
  readonly errorAccion = signal<string | null>(null);
  readonly formReasignar = this.fb.nonNullable.group({
    destinoId: [0, Validators.min(1)],
    fechaAsignacion: [hoyISO(), Validators.required],
  });
  readonly destinos = computed(() => this.trabajadores().filter((t) => t.id !== this.trabajador().id));

  readonly caracteristicas = new FormRecord<FormControl<string>>({});

  readonly form = this.fb.nonNullable.group({
    codigoBien: ['', Validators.required],
    serie: [''],
    localId: [0, Validators.min(1)],
    nivelId: [{ value: 0, disabled: true }, Validators.min(1)],
    ambienteId: [{ value: 0, disabled: true }, Validators.min(1)],
    fechaAsignacion: [hoyISO(), Validators.required],
    /** Heredan los valores del catálogo; editar uno solo cambia esa característica en esta unidad. */
    caracteristicas: this.caracteristicas,
  });

  private readonly codigoSel = toSignal(this.form.controls.codigoBien.valueChanges, { initialValue: '' });
  private readonly valoresCaracteristicas = toSignal(this.caracteristicas.valueChanges, {
    initialValue: {} as Record<string, string>,
  });
  private readonly localSel = toSignal(this.form.controls.localId.valueChanges, { initialValue: 0 });
  private readonly nivelSel = toSignal(this.form.controls.nivelId.valueChanges, { initialValue: 0 });

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

  constructor() {
    const c = this.form.controls;
    c.codigoBien.valueChanges.pipe(takeUntilDestroyed()).subscribe((codigo) => {
      const record = this.caracteristicas;
      Object.keys(record.controls).forEach((nombre) => record.removeControl(nombre));
      const bien = this.catalogo().find((b) => b.codigo === codigo);
      for (const [nombre, valor] of Object.entries(bien?.caracteristicas ?? {})) {
        record.addControl(nombre, this.fb.nonNullable.control(valor));
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
  }

  ngOnInit(): void {
    this.service.getEquiposPorAnexo(this.trabajador().id).subscribe({
      next: (equipos) => {
        this.equipos.set(equipos);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.errorCarga.set(mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  /** Esc cierra primero el QR y luego el modal. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.qrEquipo()) this.qrEquipo.set(null);
    else this.cerrar.emit();
  }

  protected abrirForm(): void {
    this.errorForm.set(null);
    this.mostrarForm.set(true);
    if (this.catalogo().length === 0) {
      this.service.getOpciones().subscribe({
        next: (opciones) => {
          this.catalogo.set(opciones.catalogo);
          this.locales.set(opciones.locales);
        },
        error: (err: unknown) => this.errorForm.set(mensajeError(err)),
      });
    }
  }

  protected cancelarForm(): void {
    this.mostrarForm.set(false);
    this.errorForm.set(null);
    this.resetForm();
  }

  protected guardar(): void {
    const v = this.form.getRawValue();
    if (!v.codigoBien) {
      this.errorForm.set('Selecciona un equipo del catálogo.');
      return;
    }
    if (v.localId < 1 || v.nivelId < 1 || v.ambienteId < 1) {
      this.errorForm.set('Selecciona local, nivel y ambiente.');
      return;
    }
    if (!v.fechaAsignacion) {
      this.errorForm.set('Indica la fecha de asignación.');
      return;
    }

    this.errorForm.set(null);
    this.guardando.set(true);
    this.service
      .asignarEquipo(this.trabajador().id, {
        codigoBien: v.codigoBien,
        serie: v.serie.trim() || null,
        fechaAsignacion: v.fechaAsignacion,
        localId: v.localId,
        nivelId: v.nivelId,
        ambienteId: v.ambienteId,
        caracteristicas: v.caracteristicas,
      })
      .subscribe({
        next: (equipo) => {
          this.equipos.update((lista) => [equipo, ...lista]);
          this.guardando.set(false);
          this.mostrarForm.set(false);
          this.resetForm();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.errorForm.set(mensajeError(err));
        },
      });
  }

  protected abrirReasignar(equipo: EquipoAsignado): void {
    this.errorAccion.set(null);
    this.formReasignar.reset({ destinoId: 0, fechaAsignacion: hoyISO() });
    this.reasignando.set(equipo);
    if (this.trabajadores().length === 0) {
      this.anexos.getSelect('Trabajador').subscribe({
        next: (lista) => this.trabajadores.set(lista),
        error: (err: unknown) => this.errorAccion.set(mensajeError(err)),
      });
    }
  }

  protected cancelarReasignar(): void {
    this.reasignando.set(null);
    this.errorAccion.set(null);
  }

  protected confirmarReasignar(): void {
    const equipo = this.reasignando();
    const v = this.formReasignar.getRawValue();
    if (!equipo) return;
    if (v.destinoId < 1) {
      this.errorAccion.set('Selecciona el trabajador que recibe el equipo.');
      return;
    }
    if (!v.fechaAsignacion) {
      this.errorAccion.set('Indica la fecha de asignación.');
      return;
    }
    this.ejecutarAccion(
      this.service.reasignarEquipo(this.trabajador().id, equipo.id, {
        anexoDestinoId: v.destinoId,
        fechaAsignacion: v.fechaAsignacion,
      }),
      equipo.id,
    );
  }

  protected devolver(equipo: EquipoAsignado): void {
    const nombre = `${equipo.tipo} ${equipo.marca} ${equipo.modelo}`.trim();
    if (!confirm(`¿Devolver "${nombre}"? Quedará sin responsable.`)) return;
    this.errorAccion.set(null);
    this.ejecutarAccion(this.service.devolverEquipo(this.trabajador().id, equipo.id), equipo.id);
  }

  /** El equipo deja de pertenecer a este trabajador: sale de la tabla sin recargar. */
  private ejecutarAccion(peticion: Observable<EquipoAsignado>, equipoId: number): void {
    this.procesandoAccion.set(true);
    peticion.subscribe({
      next: () => {
        this.equipos.update((lista) => lista.filter((e) => e.id !== equipoId));
        this.procesandoAccion.set(false);
        this.reasignando.set(null);
      },
      error: (err: unknown) => {
        this.procesandoAccion.set(false);
        this.errorAccion.set(mensajeError(err));
      },
    });
  }

  protected icono(tipo: string): string {
    const t = tipo.toLowerCase();
    return ICONOS_POR_TIPO.find(([clave]) => t.includes(clave))?.[1] ?? 'fa-microchip';
  }

  protected claseEstado(estado: EstadoEquipo): string {
    return CLASE_ESTADO[estado];
  }

  protected resumenCaracteristicas(equipo: EquipoAsignado): string {
    return [...(equipo.color ? [equipo.color] : []), ...Object.values(equipo.caracteristicas)].join(' · ');
  }

  protected restaurar(nombre: string): void {
    const base = this.bienSeleccionado()?.caracteristicas[nombre];
    if (base !== undefined) this.caracteristicas.controls[nombre]?.setValue(base);
  }

  private resetForm(): void {
    this.form.reset({ fechaAsignacion: hoyISO() });
    this.habilitar(this.form.controls.nivelId, false);
    this.habilitar(this.form.controls.ambienteId, false);
  }

  private habilitar(control: AbstractControl, habilitar: boolean): void {
    if (habilitar) control.enable({ emitEvent: false });
    else control.disable({ emitEvent: false });
  }
}
