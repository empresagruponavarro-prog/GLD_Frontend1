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
import { claseDeEstado, iconoDeTipo } from '../equipo-presentacion';
import { EquipoQrDialogComponent } from '../equipo-qr-dialog/equipo-qr-dialog';
import { AnexosService } from '../anexos.service';
import { EquiposTrabajadorService } from '../equipos-trabajador.service';
import { AnexoSelect } from '../interfaces/anexos.interface';
import {
  AreaOpcion,
  BienCatalogo,
  EquipoAsignado,
  EstadoEquipo,
  LocalOpcion,
  MovimientoEquipo,
  TrabajadorResumen,
} from '../interfaces/equipo-asignado.interface';

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
  readonly areas = signal<AreaOpcion[]>([]);
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
    cambiarUbicacion: [false],
    localId: [0],
    nivelId: [{ value: 0, disabled: true }],
    ambienteId: [{ value: 0, disabled: true }],
    areaId: [0],
  });

  // Historial de movimientos de un equipo
  readonly historialDe = signal<EquipoAsignado | null>(null);
  readonly historial = signal<MovimientoEquipo[]>([]);
  readonly cargandoHistorial = signal(false);
  private readonly reLocalSel = toSignal(this.formReasignar.controls.localId.valueChanges, { initialValue: 0 });
  private readonly reNivelSel = toSignal(this.formReasignar.controls.nivelId.valueChanges, { initialValue: 0 });
  private readonly reCambiar = toSignal(this.formReasignar.controls.cambiarUbicacion.valueChanges, {
    initialValue: false,
  });
  readonly cambiaUbicacion = computed(() => this.reCambiar());
  readonly reNiveles = computed(() => this.locales().find((l) => l.id === this.reLocalSel())?.niveles ?? []);
  readonly reAmbientes = computed(() => this.reNiveles().find((n) => n.id === this.reNivelSel())?.ambientes ?? []);
  readonly destinos = computed(() => this.trabajadores().filter((t) => t.id !== this.trabajador().id));

  readonly caracteristicas = new FormRecord<FormControl<string>>({});

  readonly form = this.fb.nonNullable.group({
    codigoBien: ['', Validators.required],
    serie: [''],
    localId: [0, Validators.min(1)],
    nivelId: [{ value: 0, disabled: true }, Validators.min(1)],
    ambienteId: [{ value: 0, disabled: true }, Validators.min(1)],
    areaId: [0],
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

    c.ambienteId.valueChanges.pipe(takeUntilDestroyed()).subscribe((ambiente) => {
      c.areaId.setValue(this.areaDeAmbiente(c.localId.value, c.nivelId.value, ambiente));
    });

    // Misma cascada Local → Nivel → Ambiente en el panel de reasignación.
    const r = this.formReasignar.controls;
    r.localId.valueChanges.pipe(takeUntilDestroyed()).subscribe((local) => {
      r.nivelId.setValue(0);
      this.habilitar(r.nivelId, local > 0);
    });
    r.nivelId.valueChanges.pipe(takeUntilDestroyed()).subscribe((nivel) => {
      r.ambienteId.setValue(0);
      this.habilitar(r.ambienteId, nivel > 0);
    });
    r.ambienteId.valueChanges.pipe(takeUntilDestroyed()).subscribe((ambiente) => {
      if (ambiente > 0) r.areaId.setValue(this.areaDeAmbiente(r.localId.value, r.nivelId.value, ambiente));
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
    this.cargarOpciones((err) => this.errorForm.set(err));
  }

  /** Área por defecto de la ubicación elegida (0 = sin área). */
  private areaDeAmbiente(localId: number, nivelId: number, ambienteId: number): number {
    const local = this.locales().find((l) => l.id === localId);
    const nivel = local?.niveles.find((n) => n.id === nivelId);
    return nivel?.ambientes.find((a) => a.id === ambienteId)?.areaId ?? 0;
  }

  private cargarOpciones(alFallar: (mensaje: string) => void): void {
    if (this.catalogo().length > 0) return;
    this.service.getOpciones().subscribe({
      next: (opciones) => {
        this.catalogo.set(opciones.catalogo);
        this.locales.set(opciones.locales);
        this.areas.set(opciones.areas);
      },
      error: (err: unknown) => alFallar(mensajeError(err)),
    });
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
        ...(v.areaId > 0 ? { areaId: v.areaId } : {}),
        caracteristicas: v.caracteristicas,
      })
      .subscribe({
        next: (equipo) => {
          this.equipos.update((lista) => [equipo, ...lista]);
          this.guardando.set(false);
          this.mostrarForm.set(false);
          this.resetForm();
          this.ofrecerEntrega(this.trabajador().id, this.trabajador().anexo, equipo);
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.errorForm.set(mensajeError(err));
        },
      });
  }

  protected abrirReasignar(equipo: EquipoAsignado): void {
    this.errorAccion.set(null);
    this.formReasignar.reset({ destinoId: 0, fechaAsignacion: hoyISO(), cambiarUbicacion: false, localId: 0, areaId: 0 });
    this.habilitar(this.formReasignar.controls.nivelId, false);
    this.habilitar(this.formReasignar.controls.ambienteId, false);
    this.reasignando.set(equipo);
    this.cargarOpciones((mensaje) => this.errorAccion.set(mensaje));
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
    if (v.cambiarUbicacion && (v.localId < 1 || v.nivelId < 1 || v.ambienteId < 1)) {
      this.errorAccion.set('Selecciona local, nivel y ambiente de la nueva ubicación.');
      return;
    }
    const destino = this.trabajadores().find((t) => t.id === v.destinoId);
    this.ejecutarAccion(
      this.service.reasignarEquipo(this.trabajador().id, equipo.id, {
        anexoDestinoId: v.destinoId,
        fechaAsignacion: v.fechaAsignacion,
        ...(v.cambiarUbicacion ? { localId: v.localId, nivelId: v.nivelId, ambienteId: v.ambienteId } : {}),
        ...(v.areaId > 0 ? { areaId: v.areaId } : {}),
      }),
      equipo.id,
      (movido) => this.ofrecerEntrega(v.destinoId, destino?.nombre ?? 'trabajador', movido),
    );
  }

  protected devolver(equipo: EquipoAsignado): void {
    const nombre = `${equipo.tipo} ${equipo.marca} ${equipo.modelo}`.trim();
    if (!confirm(`¿Devolver "${nombre}"? Quedará sin responsable.`)) return;
    this.errorAccion.set(null);
    this.ejecutarAccion(this.service.devolverEquipo(this.trabajador().id, equipo.id, hoyISO()), equipo.id);
  }

  /** El equipo deja de pertenecer a este trabajador: sale de la tabla sin recargar. */
  private ejecutarAccion(
    peticion: Observable<EquipoAsignado>,
    equipoId: number,
    despues?: (equipo: EquipoAsignado) => void,
  ): void {
    this.procesandoAccion.set(true);
    peticion.subscribe({
      next: (resultado) => {
        this.equipos.update((lista) => lista.filter((e) => e.id !== equipoId));
        this.procesandoAccion.set(false);
        this.reasignando.set(null);
        despues?.(resultado);
      },
      error: (err: unknown) => {
        this.procesandoAccion.set(false);
        this.errorAccion.set(mensajeError(err));
      },
    });
  }

  /** Descarga la hoja de entrega (.docx) para imprimirla y firmarla. */
  protected descargarEntrega(anexoId: number, nombre: string, equipo: EquipoAsignado): void {
    this.errorAccion.set(null);
    this.service.descargarEntrega(anexoId, [equipo.id], equipo.fechaAsignacion || undefined).subscribe({
      next: (archivo) => {
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `ENTREGA DE EQUIPOS - ${nombre}.docx`;
        enlace.click();
        URL.revokeObjectURL(url);
      },
      error: (err: unknown) => this.errorAccion.set(mensajeError(err)),
    });
  }

  private ofrecerEntrega(anexoId: number, nombre: string, equipo: EquipoAsignado): void {
    if (confirm('¿Descargar la hoja de entrega de equipos para imprimir?')) this.descargarEntrega(anexoId, nombre, equipo);
  }

  protected abrirHistorial(equipo: EquipoAsignado): void {
    this.errorAccion.set(null);
    this.historialDe.set(equipo);
    this.historial.set([]);
    this.cargandoHistorial.set(true);
    this.service.getHistorial(equipo.id).subscribe({
      next: (lista) => {
        this.historial.set(lista);
        this.cargandoHistorial.set(false);
      },
      error: (err: unknown) => {
        this.cargandoHistorial.set(false);
        this.errorAccion.set(mensajeError(err));
      },
    });
  }

  protected cerrarHistorial(): void {
    this.historialDe.set(null);
  }

  protected icono(tipo: string): string {
    return iconoDeTipo(tipo);
  }

  protected claseEstado(estado: EstadoEquipo): string {
    return claseDeEstado(estado);
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
