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
import { FormBuilder, FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeError } from '@shared/utils/errores-http';
import { Observable } from 'rxjs';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { claseDeEstado, etiquetaDestino, iconoDeTipo } from '../equipo-presentacion';
import { EquipoQrDialogComponent } from '../equipo-qr-dialog/equipo-qr-dialog';
import { AnexosService } from '../anexos.service';
import { EquiposTrabajadorService } from '../equipos-trabajador.service';
import { AnexoSelect } from '../interfaces/anexos.interface';
import { UbicacionDestinoComponent } from '../ubicacion-destino/ubicacion-destino';
import { DESTINO_VACIO, DestinoSeleccionado, cuerpoDestino, errorDestino } from '../ubicacion-destino/ubicacion-destino.util';
import {
  AreaOpcion,
  BienCatalogo,
  EquipoAsignado,
  EstadoEquipo,
  LocalOpcion,
  MovimientoEquipo,
  OpcionDestino,
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
  imports: [ReactiveFormsModule, DatePipe, ModalComponent, EquipoQrDialogComponent, UbicacionDestinoComponent],
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
  readonly empresas = signal<OpcionDestino[]>([]);
  readonly centrosCosto = signal<OpcionDestino[]>([]);
  /** A dónde va el equipo que se está asignando / reasignando (empresa con ubicación, o centro de costo). */
  readonly ubicacionAsignar = signal<DestinoSeleccionado>(DESTINO_VACIO);
  readonly ubicacionReasignar = signal<DestinoSeleccionado>(DESTINO_VACIO);
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
  });

  // Historial de movimientos de un equipo
  readonly historialDe = signal<EquipoAsignado | null>(null);
  readonly historial = signal<MovimientoEquipo[]>([]);
  readonly cargandoHistorial = signal(false);
  private readonly reCambiar = toSignal(this.formReasignar.controls.cambiarUbicacion.valueChanges, {
    initialValue: false,
  });
  readonly cambiaUbicacion = computed(() => this.reCambiar());
  readonly destinos = computed(() => this.trabajadores().filter((t) => t.id !== this.trabajador().id));

  readonly caracteristicas = new FormRecord<FormControl<string>>({});

  readonly form = this.fb.nonNullable.group({
    codigoBien: ['', Validators.required],
    serie: [''],
    fechaAsignacion: [hoyISO(), Validators.required],
    /** Heredan los valores del catálogo; editar uno solo cambia esa característica en esta unidad. */
    caracteristicas: this.caracteristicas,
  });

  private readonly codigoSel = toSignal(this.form.controls.codigoBien.valueChanges, { initialValue: '' });
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

  private cargarOpciones(alFallar: (mensaje: string) => void): void {
    if (this.catalogo().length > 0) return;
    this.service.getOpciones().subscribe({
      next: (opciones) => {
        this.catalogo.set(opciones.catalogo);
        this.locales.set(opciones.locales);
        this.areas.set(opciones.areas);
        this.empresas.set(opciones.empresas);
        this.centrosCosto.set(opciones.centrosCosto);
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
    const errorUbicacion = errorDestino(this.ubicacionAsignar());
    if (errorUbicacion) {
      this.errorForm.set(errorUbicacion);
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
        ...cuerpoDestino(this.ubicacionAsignar()),
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
    this.formReasignar.reset({ destinoId: 0, fechaAsignacion: hoyISO(), cambiarUbicacion: false });
    this.ubicacionReasignar.set(DESTINO_VACIO);
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
    const errorUbicacion = v.cambiarUbicacion ? errorDestino(this.ubicacionReasignar()) : null;
    if (errorUbicacion) {
      this.errorAccion.set(errorUbicacion);
      return;
    }
    const destino = this.trabajadores().find((t) => t.id === v.destinoId);
    this.ejecutarAccion(
      this.service.reasignarEquipo(this.trabajador().id, equipo.id, {
        anexoDestinoId: v.destinoId,
        fechaAsignacion: v.fechaAsignacion,
        ...(v.cambiarUbicacion ? cuerpoDestino(this.ubicacionReasignar()) : {}),
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

  protected destino(destino: string | null, tipo: 'EMPRESA' | 'CENTRO_COSTO' | null): string {
    return etiquetaDestino(destino, tipo);
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
    this.ubicacionAsignar.set(DESTINO_VACIO);
  }

}
