import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { ACCIONES, Accion, ETIQUETAS_ACCION, Permisos } from '@app/core/auth/permisos.models';
import { PermisosService } from '@app/core/auth/permisos.service';
import { mensajeError } from '@shared/utils/errores-http';
import { marcadoDeEvento, valorDeEvento } from '@shared/utils/eventos';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import {
  EstadoAreaModulo,
  OrigenPermiso,
  PermisoUsuarioModulo,
  PermisosUsuario,
  Usuario,
} from '../interfaces';
import { UsuariosService } from '../usuarios.service';

/** Excepciones en edición: clave del módulo → permisos que tendrá el usuario en él. */
type MapaExcepciones = ReadonlyMap<string, Permisos>;

interface GrupoVista {
  nombre: string;
  modulos: PermisoUsuarioModulo[];
}

const SIN_ACCESO = 'Sin acceso';

const ETIQUETA_AREA: Readonly<Record<EstadoAreaModulo, string>> = {
  sin_restriccion: '—',
  no: 'No lo tiene',
  solo_ver: 'Solo ver',
  completo: 'Completo',
};

const ETIQUETA_ORIGEN: Readonly<Record<OrigenPermiso, string>> = {
  rol: 'Rol',
  area: 'Recortado por el área',
  excepcion: 'Excepción',
};

/** Los módulos de Administración solo se dan por el rol (la API rechaza excepciones en ellos). */
const esAdministracion = (clave: string): boolean => clave.startsWith('admin.');

function mismosPermisos(a: Permisos, b: Permisos): boolean {
  return ACCIONES.every((accion) => a[accion] === b[accion]);
}

function conAccion(p: Permisos, accion: Accion, valor: boolean): Permisos {
  return { ...p, [accion]: valor };
}

/**
 * Permisos de un usuario (plan 08): para cada módulo muestra lo que da su rol, cómo lo recorta su área,
 * su excepción propia (si la tiene) y lo que de verdad puede hacer, con su origen. Solo el Administrador
 * puede crear, cambiar o quitar excepciones; los demás ven la tabla en solo lectura.
 */
@Component({
  selector: 'app-usuario-permisos-dialog',
  imports: [ModalComponent],
  templateUrl: './usuario-permisos-dialog.html',
  styleUrl: './usuario-permisos-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuarioPermisosDialogComponent implements OnInit {
  readonly usuario = input.required<Usuario>();
  readonly closed = output<void>();
  /** Se emite tras guardar o restablecer, para que la lista actualice la marca "Permisos personalizados". */
  readonly cambiado = output<void>();

  readonly #service = inject(UsuariosService);
  /** Solo el Administrador gestiona excepciones (la API lo exige igual). */
  protected readonly puedeEditar = inject(PermisosService).esAdministrador;

  protected readonly acciones = ACCIONES;
  protected readonly etiquetasAccion = ETIQUETAS_ACCION;
  protected readonly valorEvento = valorDeEvento;

  protected readonly datos = signal<PermisosUsuario | null>(null);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly filtro = signal('');
  readonly #edicion = signal<MapaExcepciones>(new Map());

  protected readonly grupos = computed<GrupoVista[]>(() => {
    const texto = this.filtro().trim().toLowerCase();
    const grupos = new Map<string, PermisoUsuarioModulo[]>();
    for (const m of this.datos()?.modulos ?? []) {
      if (texto && !`${m.nombre} ${m.clave} ${m.grupo}`.toLowerCase().includes(texto)) continue;
      const lista = grupos.get(m.grupo) ?? [];
      lista.push(m);
      grupos.set(m.grupo, lista);
    }
    return [...grupos].map(([nombre, modulos]) => ({ nombre, modulos }));
  });

  /** Hay cambios en las excepciones respecto de lo guardado. */
  protected readonly sucio = computed(() => {
    const d = this.datos();
    if (!d) return false;
    const guardadas = d.modulos.filter((m) => m.excepcion !== null);
    const edicion = this.#edicion();
    if (guardadas.length !== edicion.size) return true;
    return guardadas.some((m) => {
      const nueva = edicion.get(m.clave);
      return nueva === undefined || m.excepcion === null || !mismosPermisos(nueva, m.excepcion);
    });
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.#service.getPermisos(this.usuario().IdUsuario).subscribe({
      next: (d) => {
        this.aplicar(d);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.error.set(`No se pudieron cargar los permisos: ${mensajeError(err)}`);
      },
    });
  }

  private aplicar(d: PermisosUsuario): void {
    this.datos.set(d);
    this.#edicion.set(new Map(d.modulos.flatMap((m): [string, Permisos][] => (m.excepcion ? [[m.clave, m.excepcion]] : []))));
  }

  // ---- Presentación ----

  /** "Ver, Crear, Editar" o "Sin acceso". */
  protected resumen(p: Permisos): string {
    const activas = ACCIONES.filter((a) => p[a]).map((a) => ETIQUETAS_ACCION[a]);
    return activas.length > 0 ? activas.join(', ') : SIN_ACCESO;
  }

  protected etiquetaArea(estado: EstadoAreaModulo): string {
    return ETIQUETA_AREA[estado];
  }

  protected etiquetaOrigen(origen: OrigenPermiso): string {
    return ETIQUETA_ORIGEN[origen];
  }

  /** ¿Se puede personalizar este módulo? No los de Administración ni siendo Administrador el usuario. */
  protected personalizable(m: PermisoUsuarioModulo): boolean {
    return !esAdministracion(m.clave) && this.datos()?.es_administrador === false;
  }

  protected tieneExcepcion(clave: string): boolean {
    return this.#edicion().has(clave);
  }

  protected valorDe(clave: string, accion: Accion): boolean {
    return this.#edicion().get(clave)?.[accion] ?? false;
  }

  /** ¿El módulo admite esta acción? Aprobar y anular solo donde el catálogo lo permite. */
  protected admite(m: PermisoUsuarioModulo, accion: Accion): boolean {
    if (accion === 'aprobar') return m.admite_aprobar;
    if (accion === 'anular') return m.admite_anular;
    return true;
  }

  // ---- Edición ----

  /** Activa o quita la excepción de un módulo; al activarla parte de lo que la persona puede hoy. */
  protected alternar(m: PermisoUsuarioModulo, event: Event): void {
    if (!this.puedeEditar() || this.guardando() || !this.personalizable(m)) return;
    const activar = marcadoDeEvento(event);
    this.#edicion.update((mapa) => {
      const nuevo = new Map(mapa);
      if (activar) nuevo.set(m.clave, m.efectivo);
      else nuevo.delete(m.clave);
      return nuevo;
    });
    this.aviso.set(null);
  }

  protected cambiarAccion(m: PermisoUsuarioModulo, accion: Accion, event: Event): void {
    if (!this.puedeEditar() || this.guardando()) return;
    const valor = marcadoDeEvento(event);
    this.#edicion.update((mapa) => {
      const actual = mapa.get(m.clave);
      if (!actual) return mapa;
      let siguiente = conAccion(actual, accion, valor);
      // Sin Ver no hay nada más; marcar cualquier acción exige Ver.
      if (accion === 'ver' && !valor) {
        siguiente = { ver: false, crear: false, editar: false, eliminar: false, aprobar: false, anular: false };
      } else if (accion !== 'ver' && valor) {
        siguiente = conAccion(siguiente, 'ver', true);
      }
      return new Map(mapa).set(m.clave, siguiente);
    });
    this.aviso.set(null);
  }

  protected descartar(): void {
    const d = this.datos();
    if (d) this.aplicar(d);
    this.aviso.set(null);
  }

  // ---- Guardado ----

  protected guardar(): void {
    if (!this.puedeEditar() || this.guardando() || !this.sucio()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    const excepciones = [...this.#edicion()].map(([clave, p]) => ({ clave, ...p }));
    this.#service.guardarExcepciones(this.usuario().IdUsuario, { excepciones }).subscribe({
      next: (d) => {
        this.aplicar(d);
        this.guardando.set(false);
        this.aviso.set('Permisos personalizados guardados.');
        this.cambiado.emit();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.error.set(`No se pudieron guardar los permisos: ${mensajeError(err)}`);
      },
    });
  }

  protected restablecer(): void {
    if (!this.puedeEditar() || this.guardando()) return;
    if (!confirm('¿Quitar todas las excepciones? El usuario volverá a tener solo lo que dan su rol y su área.')) return;
    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.#service.restablecerPermisos(this.usuario().IdUsuario).subscribe({
      next: (d) => {
        this.aplicar(d);
        this.guardando.set(false);
        this.aviso.set('Permisos restablecidos a los de su rol y su área.');
        this.cambiado.emit();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.error.set(`No se pudieron restablecer los permisos: ${mensajeError(err)}`);
      },
    });
  }

  protected cerrar(): void {
    if (this.guardando()) return;
    if (this.sucio() && !confirm('Hay cambios sin guardar. ¿Cerrar y descartarlos?')) return;
    this.closed.emit();
  }
}
