import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@app/core/auth/auth.service';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { mensajeError } from '@shared/utils/errores-http';
import { UsuariosService } from './usuarios.service';
import { AreaItem, Usuario, UsuarioUpdateDto } from './interfaces';
import { UsuarioPermisosDialogComponent } from './permisos-dialog/usuario-permisos-dialog';
import { CLAVE_MAX, CLAVE_MIN, validarClaveNueva } from './usuarios.validators';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTable } from '../../../shared/interfaces';

export type FiltroEstado = 'todos' | 'activos' | 'inactivos';

/** Acción que espera confirmación dentro de la pantalla. */
export type AccionUsuario = 'desactivar' | 'reactivar' | 'eliminar';

interface ConfirmacionUsuario {
  accion: AccionUsuario;
  usuario: Usuario;
}

const MOTIVO_PROPIO_USUARIO = 'No puedes desactivar tu propio usuario.';

interface UsuarioForm {
  IdUsuario: FormControl<string>;
  Nombres: FormControl<string>;
  Usuario: FormControl<string>;
  Rol: FormControl<string>;
  id_area: FormControl<number | null>;
  cambiarClave: FormControl<boolean>;
  Clave: FormControl<string>;
  ConfirmarClave: FormControl<string>;
}

@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule, RouterLink, DataTableComponent, UsuarioPermisosDialogComponent],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosComponent {
  private usuariosService = inject(UsuariosService);
  readonly #auth = inject(AuthService);
  readonly #document = inject(DOCUMENT);
  readonly #injector = inject(Injector);
  /** Botones de escritura según la matriz: crear (+ Nuevo), editar (editar y activar/desactivar), eliminar. */
  protected readonly permisos = permisosDePantalla('admin.usuarios');
  /** Elemento enfocado antes de abrir la confirmación; recupera el foco al cerrarla. */
  #focoPrevio: HTMLElement | null = null;

  readonly claveMin = CLAVE_MIN;
  readonly claveMax = CLAVE_MAX;

  columns: DataTable[] = [
    { label: 'ID Usuario' },
    { label: 'Nombres Completos' },
    { label: 'Usuario / Login' },
    { label: 'Rol Asignado' },
    { label: 'Área' },
    { label: 'Estado' },
    { label: 'Acciones' }
  ];

  usuarios = signal<Usuario[]>([]);
  /** Filtro por estado de la tabla (Todos / Activos / Inactivos). */
  readonly filtroEstado = new FormControl<FiltroEstado>('todos', { nonNullable: true });
  readonly #filtro = signal<FiltroEstado>('todos');
  readonly usuariosFiltrados = computed(() => {
    const filtro = this.#filtro();
    const lista = this.usuarios();
    if (filtro === 'todos') return lista;
    const activos = filtro === 'activos';
    return lista.filter((u) => u.activo === activos);
  });
  readonly mensajeVacio = computed(() => {
    switch (this.#filtro()) {
      case 'activos':
        return 'No hay usuarios activos.';
      case 'inactivos':
        return 'No hay usuarios inactivos.';
      default:
        return 'No se registraron usuarios aún.';
    }
  });

  /** Confirmación pendiente (desactivar, reactivar o eliminar) dentro de la pantalla. */
  readonly porConfirmar = signal<ConfirmacionUsuario | null>(null);
  readonly confirmando = signal(false);
  /** Error del backend (p. ej. 409) dentro de la confirmación. */
  readonly confirmError = signal<string | null>(null);
  /** Confirmación de la última operación correcta. */
  readonly aviso = signal<string | null>(null);
  private readonly cancelarConfirmBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelarConfirmBtn');
  /** Roles del backend (`GET /administration/usuarios/roles`); sin lista de respaldo inventada. */
  roles = signal<string[]>([]);
  /** Aviso si el catálogo de roles no se pudo cargar o está vacío. */
  rolesError = signal<string | null>(null);

  /** Catálogo de áreas de la empresa para asignación directa al usuario (`id_area`). */
  areas = signal<AreaItem[]>([]);
  areasError = signal<string | null>(null);

  /** Usuario cuyos permisos se están viendo (diálogo rol → área → excepción). */
  usuarioPermisos = signal<Usuario | null>(null);

  showModal = signal<boolean>(false);
  editingId = signal<string | null>(null);
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  /** Error de validación o del backend (400/409) dentro del modal. */
  formError = signal<string | null>(null);
  /** Error de carga/eliminación en la página. */
  pageError = signal<string | null>(null);

  readonly form = new FormGroup<UsuarioForm>({
    /** Solo lectura: el backend asigna el correlativo al crear. */
    IdUsuario: new FormControl({ value: '', disabled: true }, { nonNullable: true }),
    Nombres: new FormControl('', { nonNullable: true }),
    Usuario: new FormControl('', { nonNullable: true }),
    Rol: new FormControl('', { nonNullable: true }),
    id_area: new FormControl<number | null>(null),
    cambiarClave: new FormControl(false, { nonNullable: true }),
    Clave: new FormControl('', { nonNullable: true }),
    ConfirmarClave: new FormControl('', { nonNullable: true }),
  });

  /** Refleja `cambiarClave` en una signal para la plantilla OnPush. */
  readonly cambiarClave = signal(false);

  /** Controla la visibilidad de la contraseña en los inputs */
  readonly mostrarClave = signal(false);
  readonly mostrarConfirmarClave = signal(false);

  toggleMostrarClave(): void {
    this.mostrarClave.update((v) => !v);
  }

  toggleMostrarConfirmarClave(): void {
    this.mostrarConfirmarClave.update((v) => !v);
  }

  constructor() {
    this.filtroEstado.valueChanges.subscribe((v) => this.#filtro.set(v));
    this.form.controls.cambiarClave.valueChanges.subscribe((v) => {
      this.cambiarClave.set(v);
      if (!v) this.form.patchValue({ Clave: '', ConfirmarClave: '' });
    });
    this.loadRoles();
    this.loadAreas();
    this.loadUsuarios();
  }

  loadAreas() {
    this.usuariosService.getAreas().subscribe({
      next: (areas) => {
        const lista = Array.isArray(areas) ? areas : [];
        this.areas.set(lista);
        this.areasError.set(null);
      },
      error: (err: unknown) => {
        this.areasError.set('No se pudieron cargar las áreas: ' + mensajeError(err));
      },
    });
  }

  loadRoles() {
    this.usuariosService.getRoles().subscribe({
      next: (roles) => {
        const lista = Array.isArray(roles) ? roles : [];
        this.roles.set(lista);
        this.rolesError.set(lista.length > 0 ? null : 'No hay roles registrados. Créelos en Administración de Roles.');
      },
      error: (err: unknown) => {
        // Sin catálogo de respaldo: se avisa en el formulario en lugar de inventar la lista.
        this.rolesError.set('No se pudieron cargar los roles: ' + mensajeError(err));
      },
    });
  }

  /** Botón "Actualizar": recarga usuarios, áreas y el catálogo de roles (puede cambiar en Administración de Roles). */
  actualizar() {
    this.loadRoles();
    this.loadAreas();
    this.loadUsuarios();
  }

  loadUsuarios() {
    this.loading.set(true);
    this.pageError.set(null);
    this.usuariosService.getAll().subscribe({
      next: (data) => {
        this.usuarios.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.pageError.set('No se pudieron cargar los usuarios: ' + mensajeError(err));
        this.loading.set(false);
      },
    });
  }

  openModal() {
    if (!this.permisos.crear()) return;
    this.editingId.set(null);
    this.formError.set(null);
    this.mostrarClave.set(false);
    this.mostrarConfirmarClave.set(false);
    this.form.reset({
      IdUsuario: '', Nombres: '', Usuario: '', Rol: this.rolPorDefecto(),
      id_area: null,
      cambiarClave: true, Clave: '', ConfirmarClave: '',
    });
    this.showModal.set(true);
  }

  editModal(item: Usuario) {
    if (!this.permisos.editar()) return;
    this.editingId.set(item.IdUsuario);
    this.formError.set(null);
    this.mostrarClave.set(false);
    this.mostrarConfirmarClave.set(false);
    // Un rol fuera del catálogo (heredado) obliga a elegir uno válido.
    const rol = item.Rol && this.roles().includes(item.Rol) ? item.Rol : '';
    this.form.reset({
      IdUsuario: item.IdUsuario, Nombres: item.Nombres ?? '', Usuario: item.Usuario ?? '', Rol: rol,
      id_area: item.id_area ?? item.area?.id ?? null,
      cambiarClave: false, Clave: '', ConfirmarClave: '',
    });
    this.showModal.set(true);
  }

  /** Abre el diálogo de permisos del usuario (rol → área → excepción). */
  abrirPermisos(item: Usuario) {
    this.usuarioPermisos.set(item);
  }

  cerrarPermisos() {
    this.usuarioPermisos.set(null);
  }

  /** Escape cierra el formulario, salvo mientras se guarda (igual que en "Roles y permisos"). */
  protected cerrarConEscape(): void {
    if (!this.saving()) this.closeModal();
  }

  /** Teclado sobre el fondo del formulario: Escape lo cierra. Va como (keydown) para que el clic del fondo sea accesible. */
  protected teclaEnFormulario(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.cerrarConEscape();
  }

  /** Teclado sobre el fondo de la confirmación: Escape la cancela. */
  protected teclaEnConfirmacion(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.cancelarConfirmacion();
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
    this.mostrarClave.set(false);
    this.mostrarConfirmarClave.set(false);
    this.form.patchValue({ Clave: '', ConfirmarClave: '' });
  }

  saveUsuario() {
    if (this.saving()) return;
    const v = this.form.getRawValue();
    const editId = this.editingId();
    const datos = { Nombres: v.Nombres.trim(), Usuario: v.Usuario.trim(), Rol: v.Rol };

    if (!datos.Nombres || !datos.Usuario) {
      this.formError.set('Por favor complete los campos obligatorios.');
      return;
    }
    if (!datos.Rol || !this.roles().includes(datos.Rol)) {
      this.formError.set('Seleccione un rol válido.');
      return;
    }
    const enviarClave = !editId || v.cambiarClave;
    if (enviarClave) {
      const errorClave = validarClaveNueva(v.Clave, v.ConfirmarClave);
      if (errorClave) {
        this.formError.set(errorClave);
        return;
      }
    }

    this.formError.set(null);
    this.saving.set(true);
    const idAreaRaw = v.id_area;
    const tieneArea = idAreaRaw !== null && idAreaRaw !== undefined && idAreaRaw !== ('' as unknown);
    const idAreaVal = tieneArea ? Number(idAreaRaw) : null;
    const peticion = editId
      ? this.usuariosService.update(editId, {
          ...datos,
          ...(tieneArea ? { id_area: idAreaVal } : {}),
          ...(enviarClave ? { Clave: v.Clave } : {}),
        } satisfies UsuarioUpdateDto)
      : this.usuariosService.create({
          ...datos,
          ...(tieneArea ? { id_area: idAreaVal } : {}),
          Clave: v.Clave,
        });

    peticion.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.loadUsuarios();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set((editId ? 'Error al actualizar: ' : 'Error al crear: ') + mensajeError(err));
      },
    });
  }

  /** Pide confirmación dentro de la pantalla (sin `confirm()`) antes de eliminar. */
  deleteUsuario(item: Usuario) {
    if (!this.permisos.eliminar()) return;
    this.pedirConfirmacion('eliminar', item);
  }

  // ---- Activar / desactivar ----

  /** `true` si la fila es el usuario de la sesión. */
  esUsuarioActual(item: Usuario): boolean {
    return this.#auth.usuario()?.id === item.IdUsuario;
  }

  /** Motivo por el que no se puede desactivar el usuario, o `null` si se puede. */
  motivoNoDesactivar(item: Usuario): string | null {
    return item.activo && this.esUsuarioActual(item) ? MOTIVO_PROPIO_USUARIO : null;
  }

  cambiarEstado(item: Usuario) {
    if (!this.permisos.editar() || this.motivoNoDesactivar(item)) return;
    this.pedirConfirmacion(item.activo ? 'desactivar' : 'reactivar', item);
  }

  cancelarConfirmacion() {
    if (this.confirmando()) return;
    this.porConfirmar.set(null);
    this.confirmError.set(null);
    const previo = this.#focoPrevio;
    this.#focoPrevio = null;
    if (previo?.isConnected) previo.focus();
  }

  confirmar() {
    const pendiente = this.porConfirmar();
    if (!pendiente || this.confirmando()) return;
    const { accion, usuario } = pendiente;
    this.confirmando.set(true);
    this.confirmError.set(null);

    if (accion === 'eliminar') {
      this.usuariosService.delete(usuario.IdUsuario).subscribe({
        next: () => this.terminarConfirmacion(`Usuario "${usuario.Usuario}" eliminado.`, true),
        error: (err: unknown) => this.fallarConfirmacion('Error al eliminar: ', err),
      });
      return;
    }

    this.usuariosService.cambiarEstado(usuario.IdUsuario, accion === 'reactivar').subscribe({
      next: (actualizado) => {
        this.usuarios.update((lista) =>
          lista.map((u) => (u.IdUsuario === actualizado.IdUsuario ? actualizado : u)),
        );
        this.terminarConfirmacion(
          `Usuario "${usuario.Usuario}" ${accion === 'reactivar' ? 'reactivado' : 'desactivado'}.`,
          false,
        );
      },
      error: (err: unknown) =>
        this.fallarConfirmacion(accion === 'reactivar' ? 'Error al reactivar: ' : 'Error al desactivar: ', err),
    });
  }

  /** Clic en el fondo del formulario (no en su contenido): lo cierra. */
  onFormOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.closeModal();
  }

  /** Clic en el fondo de la confirmación (no en su contenido). */
  onConfirmOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.cancelarConfirmacion();
  }

  private pedirConfirmacion(accion: AccionUsuario, usuario: Usuario) {
    const activo = this.#document.activeElement;
    this.#focoPrevio = activo instanceof HTMLElement ? activo : null;
    this.aviso.set(null);
    this.confirmError.set(null);
    this.porConfirmar.set({ accion, usuario });
    afterNextRender(() => this.cancelarConfirmBtn()?.nativeElement.focus(), { injector: this.#injector });
  }

  private terminarConfirmacion(mensaje: string, recargar: boolean) {
    this.confirmando.set(false);
    this.aviso.set(mensaje);
    this.cancelarConfirmacion();
    if (recargar) this.loadUsuarios();
  }

  private fallarConfirmacion(prefijo: string, err: unknown) {
    this.confirmando.set(false);
    this.confirmError.set(prefijo + mensajeError(err));
  }

  private rolPorDefecto(): string {
    const roles = this.roles();
    return roles.includes('Usuario') ? 'Usuario' : (roles[0] ?? '');
  }
}
