import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { mensajeError } from '@shared/utils/errores-http';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { AnexosService } from '../anexos/anexos.service';
import { EquipoQrDialogComponent } from '../anexos/equipo-qr-dialog/equipo-qr-dialog';
import { claseDeEstado, descargarBlob, ESTADOS_EQUIPO, hoyISO, iconoDeTipo } from '../anexos/equipo-presentacion';
import { EquiposTrabajadorService } from '../anexos/equipos-trabajador.service';
import { AnexoSelect } from '../anexos/interfaces/anexos.interface';
import { EquipoInventario, EstadoEquipo } from '../anexos/interfaces/equipo-asignado.interface';
import {
  Asignacion,
  destinoDe,
  filtrarEquipos,
  FiltrosEquipos,
  SIN_FILTROS,
  ubicacionDe,
  usoDe,
  UsoEquipo,
  valoresUnicos,
} from '../equipos-dashboard/equipos-dashboard.util';
import { MoverEquipoDialogComponent } from './mover-equipo-dialog/mover-equipo-dialog';
import { RegistroActivoDialogComponent } from './registro-activo-dialog/registro-activo-dialog';

/**
 * Mantenimiento de equipos tecnológicos: registrar, mover, entregar, cambiar de estado y dar de baja.
 * El tablero (`EquiposDashboardComponent`) es solo de lectura.
 */
@Component({
  selector: 'app-equipos-mantenimiento',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, ModalComponent, RegistroActivoDialogComponent, EquipoQrDialogComponent, MoverEquipoDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-scroll' },
  templateUrl: './equipos-mantenimiento.html',
  styleUrl: './equipos-mantenimiento.css',
})
export class EquiposMantenimientoComponent {
  private readonly service = inject(EquiposTrabajadorService);
  private readonly anexos = inject(AnexosService);
  /** Registrar exige crear; mover, entregar y cambiar de estado, editar; dar de baja, eliminar. */
  protected readonly permisos = permisosDePantalla('tecnologia.mantenimiento');

  readonly mostrarRegistro = signal(false);
  readonly qrEquipo = signal<EquipoInventario | null>(null);
  readonly moviendo = signal<EquipoInventario | null>(null);
  readonly asignando = signal<EquipoInventario | null>(null);
  readonly trabajadores = signal<AnexoSelect[]>([]);
  readonly destinoId = signal(0);
  readonly fechaEntrega = signal(hoyISO());
  readonly guardandoEntrega = signal(false);
  readonly errorAccion = signal<string | null>(null);

  readonly equipos = signal<EquipoInventario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly filtros = signal<FiltrosEquipos>({ ...SIN_FILTROS });

  readonly filtrados = computed(() => filtrarEquipos(this.equipos(), this.filtros()));
  readonly hayFiltros = computed(() => Object.values(this.filtros()).some((v) => v !== ''));
  readonly tipos = computed(() => valoresUnicos(this.equipos(), (e) => e.tipo));
  readonly estados: readonly EstadoEquipo[] = ESTADOS_EQUIPO.map((e) => e.valor);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.service.getInventario().subscribe({
      next: (lista) => {
        this.equipos.set(lista);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected alRegistrar(equipo: EquipoInventario): void {
    this.mostrarRegistro.set(false);
    this.cargar();
    this.qrEquipo.set(equipo);
    if (equipo.responsableId !== null && confirm('¿Descargar la hoja de entrega de equipos para imprimir?')) {
      this.descargarActa(equipo);
    }
  }

  /** El equipo ya cambió de lugar: la fila toma lo que devolvió el servidor. */
  protected alMover(movido: EquipoInventario): void {
    this.moviendo.set(null);
    this.equipos.update((lista) => lista.map((e) => (e.id === movido.id ? movido : e)));
  }

  protected abrirAsignar(equipo: EquipoInventario): void {
    this.errorAccion.set(null);
    this.destinoId.set(0);
    this.fechaEntrega.set(hoyISO());
    this.asignando.set(equipo);
    if (this.trabajadores().length === 0) {
      this.anexos.getSelect('Trabajador').subscribe({
        next: (lista) => this.trabajadores.set(lista),
        error: (err: unknown) => this.errorAccion.set(mensajeError(err)),
      });
    }
  }

  protected confirmarAsignar(): void {
    const equipo = this.asignando();
    if (!equipo) return;
    if (this.destinoId() < 1 || !this.fechaEntrega()) {
      this.errorAccion.set('Selecciona al trabajador y la fecha de entrega.');
      return;
    }
    this.errorAccion.set(null);
    this.guardandoEntrega.set(true);
    this.service.asignarActivo(equipo.id, { anexoId: this.destinoId(), fechaAsignacion: this.fechaEntrega() }).subscribe({
      next: (asignado) => {
        this.guardandoEntrega.set(false);
        this.asignando.set(null);
        this.cargar();
        if (confirm('¿Descargar la hoja de entrega de equipos para imprimir?')) this.descargarActa(asignado);
      },
      error: (err: unknown) => {
        this.guardandoEntrega.set(false);
        this.errorAccion.set(mensajeError(err));
      },
    });
  }

  /** Hoja «Entrega de equipos» (.docx) del equipo a nombre de quien lo tiene; no se guarda nada. */
  protected descargarActa(equipo: EquipoInventario): void {
    if (equipo.responsableId === null) return;
    this.errorAccion.set(null);
    this.service.descargarEntrega(equipo.responsableId, [equipo.id], equipo.fechaAsignacion || undefined).subscribe({
      next: (archivo) => descargarBlob(archivo, `ENTREGA DE EQUIPOS - ${equipo.responsable ?? 'trabajador'}.docx`),
      error: (err: unknown) => this.errorAccion.set(mensajeError(err)),
    });
  }

  /** Cambia el estado de un equipo desde la tabla y deja la fila con lo que devuelve el servidor. */
  protected cambiarEstadoEquipo(equipo: EquipoInventario, evento: Event): void {
    const select = evento.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const elegido = ESTADOS_EQUIPO.find((e) => e.valor === select.value);
    if (!elegido || elegido.valor === equipo.estado) return;
    this.errorAccion.set(null);
    this.service.cambiarEstado(equipo.id, elegido.codigo).subscribe({
      next: (actualizado) => this.equipos.update((lista) => lista.map((e) => (e.id === actualizado.id ? actualizado : e))),
      error: (err: unknown) => {
        select.value = equipo.estado;
        this.errorAccion.set(mensajeError(err));
      },
    });
  }

  /** Baja lógica: el equipo conserva su registro e historial, pero sale del inventario y del tablero. */
  protected darDeBaja(equipo: EquipoInventario): void {
    if (equipo.responsableId !== null) return;
    if (!confirm(`¿Dar de baja ${equipo.tipo} ${equipo.codigoActivo}? Dejará de aparecer en el inventario.`)) return;
    this.errorAccion.set(null);
    this.service.darDeBaja(equipo.id).subscribe({
      next: () => this.equipos.update((lista) => lista.filter((e) => e.id !== equipo.id)),
      error: (err: unknown) => this.errorAccion.set(mensajeError(err)),
    });
  }

  protected cambiar<K extends keyof FiltrosEquipos>(clave: K, valor: FiltrosEquipos[K]): void {
    this.filtros.update((f) => ({ ...f, [clave]: valor }));
  }

  protected restablecer(): void {
    this.filtros.set({ ...SIN_FILTROS });
  }

  protected destinoEtiqueta(e: EquipoInventario): string {
    return destinoDe(e);
  }

  protected uso(e: EquipoInventario): UsoEquipo {
    return usoDe(e);
  }

  protected ubicacion(e: EquipoInventario): string {
    return ubicacionDe(e);
  }

  protected icono(tipo: string): string {
    return iconoDeTipo(tipo);
  }

  protected claseEstado(estado: EstadoEquipo): string {
    return claseDeEstado(estado);
  }

  protected cambiarAsignacion(valor: string): void {
    const permitidos: readonly Asignacion[] = ['', 'asignados', 'compartidos', 'disponibles'];
    const elegido = permitidos.find((p) => p === valor);
    this.cambiar('asignacion', elegido ?? '');
  }
}
