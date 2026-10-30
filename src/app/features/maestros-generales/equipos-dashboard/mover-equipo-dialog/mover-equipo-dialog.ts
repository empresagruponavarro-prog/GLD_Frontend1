import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject, input, output, signal } from '@angular/core';
import { mensajeError } from '@shared/utils/errores-http';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { hoyISO } from '../../anexos/equipo-presentacion';
import { EquiposTrabajadorService } from '../../anexos/equipos-trabajador.service';
import { AreaOpcion, EquipoInventario, LocalOpcion, OpcionDestino } from '../../anexos/interfaces/equipo-asignado.interface';
import { UbicacionDestinoComponent } from '../../anexos/ubicacion-destino/ubicacion-destino';
import { cuerpoDestino, DESTINO_VACIO, DestinoSeleccionado, errorDestino } from '../../anexos/ubicacion-destino/ubicacion-destino.util';
import { destinoDe, ubicacionDe } from '../equipos-dashboard.util';

/** Cambia a un equipo de empresa / centro de costo, ambiente o área (con o sin responsable); queda en su historial. */
@Component({
  selector: 'app-mover-equipo-dialog',
  standalone: true,
  imports: [ModalComponent, UbicacionDestinoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mover-equipo-dialog.html',
  styleUrl: './mover-equipo-dialog.css',
})
export class MoverEquipoDialogComponent implements OnInit {
  private readonly service = inject(EquiposTrabajadorService);

  readonly equipo = input.required<EquipoInventario>();
  readonly cerrar = output<void>();
  readonly movido = output<EquipoInventario>();

  readonly locales = signal<LocalOpcion[]>([]);
  readonly areas = signal<AreaOpcion[]>([]);
  readonly empresas = signal<OpcionDestino[]>([]);
  readonly centrosCosto = signal<OpcionDestino[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly destino = signal<DestinoSeleccionado>(DESTINO_VACIO);

  ngOnInit(): void {
    this.service.getOpciones().subscribe({
      next: (opciones) => {
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
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cerrar.emit();
  }

  protected actual(): string {
    const e = this.equipo();
    return [destinoDe(e), ubicacionDe(e), e.area].filter(Boolean).join(' · ');
  }

  protected guardar(): void {
    const falta = errorDestino(this.destino());
    if (falta) {
      this.error.set(falta);
      return;
    }
    this.error.set(null);
    this.guardando.set(true);
    this.service.moverEquipo(this.equipo().id, { ...cuerpoDestino(this.destino()), fecha: hoyISO() }).subscribe({
      next: (equipo) => {
        this.guardando.set(false);
        this.movido.emit(equipo);
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }
}
