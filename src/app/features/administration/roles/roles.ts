import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { RolActualizar, RolAdmin, RolCrear, RolesService } from './roles.service';
import {
  ROL_DESCRIPCION_MAX,
  ROL_NOMBRE_MAX,
  ROL_NOMBRE_MIN,
  validarDescripcionRol,
  validarNombreRol,
} from './roles.validators';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTable } from '../../../shared/interfaces';

interface RolForm {
  nombre: FormControl<string>;
  descripcion: FormControl<string>;
}

/**
 * Administración de roles (`/admin/roles`): lista, crea, edita y elimina roles del catálogo.
 * Mismo diseño que la pantalla de usuarios; los modales se cierran con Cancelar, la X, Escape
 * o clic en el fondo, salvo con una operación en curso.
 */
@Component({
  selector: 'app-roles',
  imports: [ReactiveFormsModule, DataTableComponent],
  templateUrl: './roles.html',
  // Reutiliza los estilos del modal rediseñado de usuarios para mantener la misma familia visual.
  styleUrls: ['../usuarios/usuarios.css', './roles.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesComponent {
  readonly #rolesService = inject(RolesService);
  readonly #document = inject(DOCUMENT);
  readonly #injector = inject(Injector);
  /** Elemento enfocado antes de abrir un modal; recupera el foco al cerrarlo. */
  #focoPrevio: HTMLElement | null = null;

  protected readonly nombreMin = ROL_NOMBRE_MIN;
  protected readonly nombreMax = ROL_NOMBRE_MAX;
  protected readonly descripcionMax = ROL_DESCRIPCION_MAX;

  protected readonly columns: DataTable[] = [
    { label: 'Rol' },
    { label: 'Descripción' },
    { label: 'Usuarios' },
    { label: 'Tipo' },
    { label: 'Acciones' },
  ];

  protected readonly roles = signal<RolAdmin[]>([]);
  protected readonly isLoading = signal(false);
  /** Error de carga en la página. */
  protected readonly pageError = signal<string | null>(null);
  /** Confirmación de la última operación correcta. */
  protected readonly aviso = signal<string | null>(null);

  // Modal de formulario (crear / editar)
  protected readonly showModal = signal(false);
  /** Rol en edición; `null` = el modal crea un rol nuevo. */
  protected readonly editando = signal<RolAdmin | null>(null);
  protected readonly isSaving = signal(false);
  /** Error del backend (400/409) o "sin cambios" dentro del modal. */
  protected readonly formError = signal<string | null>(null);
  /** Los errores de campo se muestran tras el primer intento de guardar. */
  protected readonly intentoGuardar = signal(false);
  protected readonly nombreError = signal<string | null>(null);
  protected readonly descripcionError = signal<string | null>(null);

  // Modal de confirmación de eliminación
  protected readonly porEliminar = signal<RolAdmin | null>(null);
  protected readonly isDeleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly form = new FormGroup<RolForm>({
    nombre: new FormControl('', { nonNullable: true }),
    descripcion: new FormControl('', { nonNullable: true }),
  });

  private readonly nombreInput = viewChild<ElementRef<HTMLInputElement>>('nombreInput');
  private readonly descripcionInput = viewChild<ElementRef<HTMLInputElement>>('descripcionInput');
  private readonly cancelarEliminarBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelarEliminarBtn');

  constructor() {
    this.form.valueChanges.subscribe(() => this.validar());
    this.loadRoles();
  }

  loadRoles(): void {
    this.isLoading.set(true);
    this.pageError.set(null);
    this.#rolesService.listarRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.pageError.set('No se pudieron cargar los roles: ' + mensajeError(err));
        this.isLoading.set(false);
      },
    });
  }

  // ---- Crear / editar ----

  openModal(): void {
    this.abrirFormulario(null);
  }

  editModal(rol: RolAdmin): void {
    this.abrirFormulario(rol);
  }

  closeModal(): void {
    if (this.isSaving()) return;
    this.showModal.set(false);
    this.editando.set(null);
    this.restaurarFoco();
  }

  saveRol(): void {
    if (this.isSaving()) return;
    this.intentoGuardar.set(true);
    if (this.validar()) return;

    const v = this.form.getRawValue();
    const nombre = v.nombre.trim();
    const descripcion = v.descripcion.trim();
    const rol = this.editando();
    const cambiaNombre = !rol || (!rol.es_sistema && nombre !== rol.nombre);

    if (cambiaNombre && this.nombreDuplicado(nombre, rol?.id)) {
      this.nombreError.set(`Ya existe un rol llamado "${nombre}".`);
      return;
    }

    let peticion: Observable<RolAdmin>;
    if (rol) {
      const cambios: RolActualizar = {};
      if (cambiaNombre) cambios.nombre = nombre;
      if (descripcion !== (rol.descripcion ?? '')) cambios.descripcion = descripcion;
      if (Object.keys(cambios).length === 0) {
        this.formError.set('No hay cambios que guardar.');
        return;
      }
      peticion = this.#rolesService.actualizarRol(rol.id, cambios);
    } else {
      const nuevo: RolCrear = { nombre, ...(descripcion ? { descripcion } : {}) };
      peticion = this.#rolesService.crearRol(nuevo);
    }

    this.formError.set(null);
    this.isSaving.set(true);
    peticion.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.aviso.set(rol ? `Rol "${nombre}" actualizado.` : `Rol "${nombre}" creado.`);
        this.closeModal();
        this.loadRoles();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.formError.set((rol ? 'Error al actualizar: ' : 'Error al crear: ') + mensajeError(err));
      },
    });
  }

  // ---- Eliminar ----

  /** Motivo por el que el rol no se puede eliminar, o `null` si se puede. */
  motivoNoEliminar(rol: RolAdmin): string | null {
    if (rol.es_sistema) return 'Rol de sistema: no se puede eliminar.';
    if (rol.usuarios > 0) {
      return `Asignado a ${usuariosTexto(rol.usuarios)}: reasígnelos antes de eliminarlo.`;
    }
    return null;
  }

  askDelete(rol: RolAdmin): void {
    if (this.motivoNoEliminar(rol)) return;
    this.guardarFoco();
    this.deleteError.set(null);
    this.porEliminar.set(rol);
    this.enfocar(this.cancelarEliminarBtn);
  }

  cancelDelete(): void {
    if (this.isDeleting()) return;
    this.porEliminar.set(null);
    this.deleteError.set(null);
    this.restaurarFoco();
  }

  confirmDelete(): void {
    const rol = this.porEliminar();
    if (!rol || this.isDeleting()) return;
    this.isDeleting.set(true);
    this.deleteError.set(null);
    this.#rolesService.eliminarRol(rol.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.aviso.set(`Rol "${rol.nombre}" eliminado.`);
        this.cancelDelete();
        this.loadRoles();
      },
      error: (err: unknown) => {
        this.isDeleting.set(false);
        this.deleteError.set('Error al eliminar: ' + mensajeError(err));
      },
    });
  }

  // ---- Helpers de plantilla ----

  protected usuariosTexto(n: number): string {
    return usuariosTexto(n);
  }

  /** Clic en el fondo del modal (no en su contenido). */
  protected onOverlayClick(event: MouseEvent, modal: 'form' | 'delete'): void {
    if (event.target !== event.currentTarget) return;
    if (modal === 'form') this.closeModal();
    else this.cancelDelete();
  }

  // ---- Privados ----

  private abrirFormulario(rol: RolAdmin | null): void {
    this.guardarFoco();
    this.editando.set(rol);
    this.formError.set(null);
    this.intentoGuardar.set(false);
    this.aviso.set(null);
    if (rol?.es_sistema) this.form.controls.nombre.disable({ emitEvent: false });
    else this.form.controls.nombre.enable({ emitEvent: false });
    this.form.reset({ nombre: rol?.nombre ?? '', descripcion: rol?.descripcion ?? '' });
    this.showModal.set(true);
    this.enfocar(rol?.es_sistema ? this.descripcionInput : this.nombreInput);
  }

  /** Recalcula los errores de campo. Devuelve `true` si hay alguno. */
  private validar(): boolean {
    const v = this.form.getRawValue();
    this.nombreError.set(this.form.controls.nombre.disabled ? null : validarNombreRol(v.nombre));
    this.descripcionError.set(validarDescripcionRol(v.descripcion));
    return !!(this.nombreError() || this.descripcionError());
  }

  private nombreDuplicado(nombre: string, exceptoId?: number): boolean {
    const buscado = nombre.toLocaleLowerCase('es');
    return this.roles().some((r) => r.id !== exceptoId && r.nombre.toLocaleLowerCase('es') === buscado);
  }

  private guardarFoco(): void {
    const activo = this.#document.activeElement;
    this.#focoPrevio = activo instanceof HTMLElement ? activo : null;
  }

  private restaurarFoco(): void {
    const previo = this.#focoPrevio;
    this.#focoPrevio = null;
    if (previo?.isConnected) previo.focus();
  }

  private enfocar(objetivo: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => objetivo()?.nativeElement.focus(), { injector: this.#injector });
  }
}

function usuariosTexto(n: number): string {
  return n === 1 ? '1 usuario' : `${n} usuarios`;
}

/** Mensaje legible: el del backend (string o lista de validaciones), el del error HTTP o un texto genérico. */
function mensajeError(err: unknown): string {
  const e = err as { error?: { message?: unknown }; message?: unknown } | null;
  const msg = e?.error?.message ?? e?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return typeof msg === 'string' && msg ? msg : 'Error desconocido';
}
