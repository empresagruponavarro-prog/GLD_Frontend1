import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { mensajeError } from '@shared/utils/errores-http';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { Catalogo, CatalogosRrhhService, OpcionRrhh } from './catalogos.service';

interface Pestana {
  catalogo: Catalogo;
  titulo: string;
  /** Nombre de una opción en singular, para textos y avisos. */
  singular: string;
}

const TIPOS: Pestana = { catalogo: 'tipos-trabajador', titulo: 'Tipos de trabajador', singular: 'tipo de trabajador' };
const MODALIDADES: Pestana = { catalogo: 'modalidades-contrato', titulo: 'Modalidades de contrato', singular: 'modalidad de contrato' };

/**
 * RR.HH. › Catálogos de RR.HH.: tipos de trabajador y modalidades de contrato que ofrece el formulario de
 * Trabajadores. Una opción en uso no se elimina: se desactiva y quien la tenía la conserva.
 */
@Component({
  selector: 'app-catalogos-rrhh',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './catalogos.html',
  styleUrl: './catalogos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogosRrhhComponent {
  private readonly service = inject(CatalogosRrhhService);
  /** Nueva → crear; renombrar, activar/desactivar y ordenar → editar; eliminar → eliminar. */
  protected readonly permisos = permisosDePantalla('rrhh.catalogos');

  protected readonly pestanas: readonly Pestana[] = [TIPOS, MODALIDADES];
  protected readonly actual = signal<Pestana>(TIPOS);
  protected readonly opciones = signal<OpcionRrhh[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');

  // Pop-up de alta / renombre
  protected readonly modalAbierto = signal(false);
  protected readonly editando = signal<OpcionRrhh | null>(null);
  protected readonly guardando = signal(false);
  protected readonly modalError = signal('');
  protected readonly nombre = new FormControl('', { nonNullable: true });

  constructor() {
    this.cargar();
  }

  protected elegir(p: Pestana): void {
    if (p.catalogo === this.actual().catalogo) return;
    this.actual.set(p);
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.service.listar(this.actual().catalogo).subscribe({
      next: (lista) => {
        this.opciones.set(lista);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.opciones.set([]);
        this.error.set(mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  protected nueva(): void {
    if (!this.permisos.crear()) return;
    this.editando.set(null);
    this.nombre.setValue('');
    this.modalError.set('');
    this.modalAbierto.set(true);
  }

  protected renombrar(o: OpcionRrhh): void {
    if (!this.permisos.editar()) return;
    this.editando.set(o);
    this.nombre.setValue(o.nombre);
    this.modalError.set('');
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  protected guardar(): void {
    const nombre = this.nombre.value.trim();
    if (!nombre) return this.modalError.set(`Escribe el nombre de la ${this.actual().singular}.`);
    const catalogo = this.actual().catalogo;
    const actual = this.editando();
    this.guardando.set(true);
    this.modalError.set('');
    const peticion$ = actual ? this.service.actualizar(catalogo, actual.id, { nombre }) : this.service.crear(catalogo, nombre);
    peticion$.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModal();
        this.cargar();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.modalError.set(mensajeError(err));
      },
    });
  }

  protected cambiarEstado(o: OpcionRrhh): void {
    if (!this.permisos.editar()) return;
    if (o.activo && o.usos > 0) {
      const aviso = `«${o.nombre}» la tienen ${o.usos} trabajador(es). La conservan, pero ya no se podrá elegir. ¿Desactivarla?`;
      if (!confirm(aviso)) return;
    }
    this.error.set('');
    this.service.actualizar(this.actual().catalogo, o.id, { activo: !o.activo }).subscribe({
      next: () => this.cargar(),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  protected mover(o: OpcionRrhh, direccion: 'arriba' | 'abajo'): void {
    if (!this.permisos.editar()) return;
    this.error.set('');
    this.service.mover(this.actual().catalogo, o.id, direccion).subscribe({
      next: (lista) => this.opciones.set(lista),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  protected eliminar(o: OpcionRrhh): void {
    if (!this.permisos.eliminar() || o.usos > 0) return;
    if (!confirm(`¿Eliminar «${o.nombre}»? Esta acción no se puede deshacer.`)) return;
    this.error.set('');
    this.service.eliminar(this.actual().catalogo, o.id).subscribe({
      next: () => this.cargar(),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }
}
