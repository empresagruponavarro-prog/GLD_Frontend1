import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UsuariosService } from './usuarios.service';
import { Usuario, UsuarioUpdateDto } from './interfaces';
import { CLAVE_MAX, CLAVE_MIN, validarClaveNueva } from './usuarios.validators';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { DataTable } from '../../../shared/interfaces';

interface UsuarioForm {
  IdUsuario: FormControl<string>;
  Nombres: FormControl<string>;
  Usuario: FormControl<string>;
  Rol: FormControl<string>;
  cambiarClave: FormControl<boolean>;
  Clave: FormControl<string>;
  ConfirmarClave: FormControl<string>;
}

@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule, DataTableComponent],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosComponent {
  private usuariosService = inject(UsuariosService);

  readonly claveMin = CLAVE_MIN;
  readonly claveMax = CLAVE_MAX;

  columns: DataTable[] = [
    { label: 'ID Usuario' },
    { label: 'Nombres Completos' },
    { label: 'Usuario / Login' },
    { label: 'Rol Asignado' },
    { label: 'Acciones' }
  ];

  usuarios = signal<Usuario[]>([]);
  /** Roles del backend (`GET /administration/usuarios/roles`); sin lista de respaldo inventada. */
  roles = signal<string[]>([]);
  /** Aviso si el catálogo de roles no se pudo cargar o está vacío. */
  rolesError = signal<string | null>(null);
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
    this.form.controls.cambiarClave.valueChanges.subscribe((v) => {
      this.cambiarClave.set(v);
      if (!v) this.form.patchValue({ Clave: '', ConfirmarClave: '' });
    });
    this.loadRoles();
    this.loadUsuarios();
  }

  loadRoles() {
    this.usuariosService.getRoles().subscribe({
      next: (roles) => {
        const lista = Array.isArray(roles) ? roles : [];
        this.roles.set(lista);
        this.rolesError.set(lista.length > 0 ? null : 'No hay roles registrados. Créelos en Administración de Roles.');
      },
      error: (err) => {
        // Sin catálogo de respaldo: se avisa en el formulario en lugar de inventar la lista.
        this.rolesError.set('No se pudieron cargar los roles: ' + this.mensajeError(err));
      },
    });
  }

  /** Botón "Actualizar": recarga usuarios y el catálogo de roles (puede cambiar en Administración de Roles). */
  actualizar() {
    this.loadRoles();
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
      error: (err) => {
        this.pageError.set('No se pudieron cargar los usuarios: ' + this.mensajeError(err));
        this.loading.set(false);
      },
    });
  }

  openModal() {
    this.editingId.set(null);
    this.formError.set(null);
    this.mostrarClave.set(false);
    this.mostrarConfirmarClave.set(false);
    this.form.reset({
      IdUsuario: '', Nombres: '', Usuario: '', Rol: this.rolPorDefecto(),
      cambiarClave: true, Clave: '', ConfirmarClave: '',
    });
    this.showModal.set(true);
  }

  editModal(item: Usuario) {
    this.editingId.set(item.IdUsuario);
    this.formError.set(null);
    this.mostrarClave.set(false);
    this.mostrarConfirmarClave.set(false);
    // Un rol fuera del catálogo (heredado) obliga a elegir uno válido.
    const rol = item.Rol && this.roles().includes(item.Rol) ? item.Rol : '';
    this.form.reset({
      IdUsuario: item.IdUsuario, Nombres: item.Nombres ?? '', Usuario: item.Usuario ?? '', Rol: rol,
      cambiarClave: false, Clave: '', ConfirmarClave: '',
    });
    this.showModal.set(true);
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
    const peticion = editId
      ? this.usuariosService.update(editId, { ...datos, ...(enviarClave ? { Clave: v.Clave } : {}) } satisfies UsuarioUpdateDto)
      : this.usuariosService.create({ ...datos, Clave: v.Clave });

    peticion.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.loadUsuarios();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set((editId ? 'Error al actualizar: ' : 'Error al crear: ') + this.mensajeError(err));
      },
    });
  }

  deleteUsuario(id: string) {
    if (confirm(`¿Eliminar el usuario "${id}"? Esta acción no se puede deshacer.`)) {
      this.usuariosService.delete(id).subscribe({
        next: () => this.loadUsuarios(),
        error: (err) => this.pageError.set('Error al eliminar: ' + this.mensajeError(err)),
      });
    }
  }

  private rolPorDefecto(): string {
    const roles = this.roles();
    return roles.includes('Usuario') ? 'Usuario' : (roles[0] ?? '');
  }

  /** Mensaje legible: el del backend (string o lista de validaciones), el del error HTTP o un texto genérico. */
  private mensajeError(err: unknown): string {
    const e = err as { error?: { message?: unknown }; message?: unknown } | null;
    const msg = e?.error?.message ?? e?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    return typeof msg === 'string' && msg ? msg : 'Error desconocido';
  }
}
