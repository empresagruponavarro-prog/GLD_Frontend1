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
import { Observable, forkJoin } from 'rxjs';
import {
  ACCIONES,
  Accion,
  ETIQUETAS_ACCION,
  GrupoCatalogo,
  MatrizPermisosRol,
  ModuloCatalogo,
} from '@app/core/auth/permisos.models';
import { mensajeError } from '@shared/utils/errores-http';
import { RolActualizar, RolAdmin, RolCrear, RolesService } from './roles.service';
import { PermisosAdminService } from './permisos-admin.service';
import { PantallaConCambiosPendientes } from './roles.guard';
import { AuthService } from '@app/core/auth/auth.service';
import { PermisosService } from '@app/core/auth/permisos.service';
import {
  EstadoColumna,
  MapaPermisos,
  admiteAccion,
  aplicarAGrupo,
  aplicarAccion,
  contarCambios,
  estadoColumna,
  filasParaGuardar,
  mapaDesdeMatriz,
  permisosDe,
} from './permisos.calc';
import {
  ROL_DESCRIPCION_MAX,
  ROL_NOMBRE_MAX,
  ROL_NOMBRE_MIN,
  validarDescripcionRol,
  validarNombreRol,
} from './roles.validators';

interface RolForm {
  nombre: FormControl<string>;
  descripcion: FormControl<string>;
}

/** Acción que espera la confirmación de "cambios sin guardar". */
type AccionPendiente =
  | { tipo: 'cambiar-rol'; rolId: number }
  | { tipo: 'actualizar' }
  | { tipo: 'salir'; resolver: (salir: boolean) => void };

type Modal = 'form' | 'delete' | 'pendiente';

interface CeldaVista {
  accion: Accion;
  admite: boolean;
  valor: boolean;
  ariaLabel: string;
}

interface FilaVista {
  modulo: ModuloCatalogo;
  celdas: CeldaVista[];
  cambiada: boolean;
}

interface ColumnaGrupoVista {
  accion: Accion;
  estado: EstadoColumna;
  ariaLabel: string;
}

interface GrupoVista {
  grupo: GrupoCatalogo;
  columnas: ColumnaGrupoVista[];
  filas: FilaVista[];
}

const MAPA_VACIO: MapaPermisos = new Map();

/**
 * Roles y permisos (`/admin/roles`): elige un rol, edita su matriz de permisos por módulo
 * (Ver | Crear | Editar | Eliminar | Aprobar | Anular) y la guarda completa. También crea,
 * edita y elimina roles. El Administrador se muestra en solo lectura con todo permitido.
 * Los modales se cierran con Cancelar, la X, Escape o clic en el fondo, salvo con una operación en curso.
 */
@Component({
  selector: 'app-roles',
  imports: [ReactiveFormsModule],
  templateUrl: './roles.html',
  // Reutiliza los estilos del modal rediseñado de usuarios para mantener la misma familia visual.
  styleUrls: ['../usuarios/usuarios.css', './roles.css'],
  // La matriz es larga: el scroll va dentro de .content-body, no en el documento (ver .page-scroll en styles.css).
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesComponent implements PantallaConCambiosPendientes {
  readonly #rolesService = inject(RolesService);
  readonly #permisosService = inject(PermisosAdminService);
  /** Permisos de la sesión: se recargan al guardar la matriz del rol del propio usuario. */
  readonly #permisosSesion = inject(PermisosService);
  readonly #auth = inject(AuthService);
  readonly #document = inject(DOCUMENT);
  readonly #injector = inject(Injector);
  /** Elemento enfocado antes de abrir un modal; recupera el foco al cerrarlo. */
  #focoPrevio: HTMLElement | null = null;

  protected readonly nombreMin = ROL_NOMBRE_MIN;
  protected readonly nombreMax = ROL_NOMBRE_MAX;
  protected readonly descripcionMax = ROL_DESCRIPCION_MAX;
  protected readonly acciones = ACCIONES;
  protected readonly etiquetas = ETIQUETAS_ACCION;

  // ---- Datos ----
  protected readonly roles = signal<RolAdmin[]>([]);
  protected readonly catalogo = signal<GrupoCatalogo[]>([]);
  /** Rol cuya matriz se muestra. */
  protected readonly rolId = signal<number | null>(null);
  protected readonly matriz = signal<MatrizPermisosRol | null>(null);
  /** Permisos guardados del rol (para contar y descartar cambios). */
  readonly #original = signal<MapaPermisos>(MAPA_VACIO);
  /** Permisos en edición. */
  readonly #actual = signal<MapaPermisos>(MAPA_VACIO);

  /** Selector de rol: solo cambia `rolId` tras confirmar si hay cambios sin guardar. */
  protected readonly rolControl = new FormControl<number | null>(null);

  protected readonly isLoadingListas = signal(false);
  protected readonly isLoadingMatriz = signal(false);
  protected readonly isLoading = computed(() => this.isLoadingListas() || this.isLoadingMatriz());
  protected readonly isSaving = signal(false);

  /** Error de carga (roles, catálogo o matriz). */
  protected readonly pageError = signal<string | null>(null);
  /** Error al guardar la matriz (400/409). */
  protected readonly guardarError = signal<string | null>(null);
  /** Confirmación de la última operación correcta. */
  protected readonly aviso = signal<string | null>(null);

  protected readonly rolSeleccionado = computed(() => this.roles().find((r) => r.id === this.rolId()) ?? null);
  /** Matriz de solo lectura (Administrador). */
  protected readonly bloqueado = computed(() => this.matriz()?.bloqueado ?? false);
  protected readonly cambios = computed(() =>
    this.bloqueado() ? 0 : contarCambios(this.catalogo(), this.#original(), this.#actual()),
  );
  protected readonly puedeGuardar = computed(
    () => this.matriz() !== null && !this.bloqueado() && this.cambios() > 0 && !this.isSaving(),
  );
  protected readonly casillasDeshabilitadas = computed(
    () => this.bloqueado() || this.isSaving() || this.isLoadingMatriz(),
  );

  /** Matriz lista para la plantilla: grupos con su fila de "marcar todos" y sus módulos. */
  protected readonly vista = computed<GrupoVista[]>(() => {
    const actual = this.#actual();
    const original = this.#original();
    return this.catalogo().map((grupo) => ({
      grupo,
      columnas: ACCIONES.map((accion) => ({
        accion,
        estado: estadoColumna(actual, grupo, accion),
        ariaLabel: `${ETIQUETAS_ACCION[accion]} en todo el grupo ${grupo.grupo}`,
      })),
      filas: grupo.modulos.map((modulo) => {
        const ahora = permisosDe(actual, modulo.clave);
        const antes = permisosDe(original, modulo.clave);
        return {
          modulo,
          cambiada: ACCIONES.some((a) => admiteAccion(modulo, a) && ahora[a] !== antes[a]),
          celdas: ACCIONES.map((accion) => ({
            accion,
            admite: admiteAccion(modulo, accion),
            valor: ahora[accion],
            ariaLabel: `${ETIQUETAS_ACCION[accion]} en ${modulo.nombre}`,
          })),
        };
      }),
    }));
  });

  // ---- Cambios sin guardar ----
  protected readonly pendiente = signal<AccionPendiente | null>(null);

  // ---- Modal de formulario (crear / editar) ----
  protected readonly showModal = signal(false);
  /** Rol en edición; `null` = el modal crea un rol nuevo. */
  protected readonly editando = signal<RolAdmin | null>(null);
  protected readonly isSavingRol = signal(false);
  /** Error del backend (400/409) o "sin cambios" dentro del modal. */
  protected readonly formError = signal<string | null>(null);
  /** Los errores de campo se muestran tras el primer intento de guardar. */
  protected readonly intentoGuardar = signal(false);
  protected readonly nombreError = signal<string | null>(null);
  protected readonly descripcionError = signal<string | null>(null);

  // ---- Modal de confirmación de eliminación ----
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
  private readonly cancelarPendienteBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelarPendienteBtn');

  constructor() {
    this.form.valueChanges.subscribe(() => this.validar());
    this.rolControl.valueChanges.subscribe((id) => {
      if (id !== null) this.solicitarCambioRol(id, true);
    });
    this.cargarTodo();
  }

  // ---- Carga ----

  /** Botón "Actualizar": recarga roles, catálogo y la matriz del rol (pide confirmación si hay cambios). */
  actualizar(): void {
    if (this.cambios() > 0) this.abrirPendiente({ tipo: 'actualizar' });
    else this.cargarTodo();
  }

  private cargarTodo(preferido: number | null = this.rolId()): void {
    this.isLoadingListas.set(true);
    this.pageError.set(null);
    forkJoin({ roles: this.#rolesService.listarRoles(), catalogo: this.#permisosService.catalogo() }).subscribe({
      next: ({ roles, catalogo }) => {
        this.isLoadingListas.set(false);
        this.roles.set(roles);
        this.catalogo.set(catalogo);
        const id = roles.some((r) => r.id === preferido) ? preferido : rolPorDefecto(roles);
        if (id === null) {
          this.rolId.set(null);
          this.rolControl.setValue(null, { emitEvent: false });
          this.limpiarMatriz();
        } else {
          this.seleccionarRol(id);
        }
      },
      error: (err: unknown) => {
        this.isLoadingListas.set(false);
        this.pageError.set('No se pudieron cargar los roles y permisos: ' + mensajeError(err));
      },
    });
  }

  /** Recarga solo la lista de roles (tras crear, editar o eliminar). */
  private recargarRoles(seleccionar: number | null): void {
    this.#rolesService.listarRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        const actual = this.rolId();
        if (seleccionar !== null && roles.some((r) => r.id === seleccionar)) {
          this.solicitarCambioRol(seleccionar);
        } else if (actual === null || !roles.some((r) => r.id === actual)) {
          const id = rolPorDefecto(roles);
          if (id !== null) this.seleccionarRol(id);
          else this.limpiarMatriz();
        } else {
          // Mantiene la selección; reajusta el select por si cambió la lista.
          this.rolControl.setValue(actual, { emitEvent: false });
        }
      },
      error: (err: unknown) => this.pageError.set('No se pudieron cargar los roles: ' + mensajeError(err)),
    });
  }

  private seleccionarRol(id: number): void {
    this.rolId.set(id);
    this.rolControl.setValue(id, { emitEvent: false });
    this.guardarError.set(null);
    this.limpiarMatriz();
    this.isLoadingMatriz.set(true);
    this.#permisosService.matriz(id).subscribe({
      next: (matriz) => {
        if (this.rolId() !== id) return; // Respuesta de un rol que ya no está seleccionado.
        this.isLoadingMatriz.set(false);
        this.aplicarMatriz(matriz);
      },
      error: (err: unknown) => {
        if (this.rolId() !== id) return;
        this.isLoadingMatriz.set(false);
        this.pageError.set('No se pudieron cargar los permisos del rol: ' + mensajeError(err));
      },
    });
  }

  private aplicarMatriz(matriz: MatrizPermisosRol): void {
    const mapa = mapaDesdeMatriz(matriz);
    this.matriz.set(matriz);
    this.#original.set(mapa);
    this.#actual.set(mapa);
  }

  private limpiarMatriz(): void {
    this.matriz.set(null);
    this.#original.set(MAPA_VACIO);
    this.#actual.set(MAPA_VACIO);
  }

  // ---- Matriz ----

  protected alternar(modulo: ModuloCatalogo, accion: Accion, valor: boolean): void {
    if (this.casillasDeshabilitadas()) return;
    this.aviso.set(null);
    this.#actual.update((mapa) => {
      const siguiente = new Map(mapa);
      siguiente.set(modulo.clave, aplicarAccion(permisosDe(mapa, modulo.clave), modulo, accion, valor));
      return siguiente;
    });
  }

  protected alternarGrupo(grupo: GrupoCatalogo, accion: Accion, valor: boolean): void {
    if (this.casillasDeshabilitadas()) return;
    this.aviso.set(null);
    this.#actual.update((mapa) => aplicarAGrupo(mapa, grupo, accion, valor));
  }

  descartarCambios(): void {
    if (this.isSaving()) return;
    this.#actual.set(this.#original());
    this.guardarError.set(null);
  }

  guardarPermisos(alTerminar?: () => void, alFallar?: () => void): void {
    const id = this.rolId();
    const rol = this.rolSeleccionado();
    if (id === null || !this.puedeGuardar()) {
      alFallar?.();
      return;
    }
    this.isSaving.set(true);
    this.guardarError.set(null);
    this.aviso.set(null);
    this.#permisosService.guardar(id, { permisos: filasParaGuardar(this.catalogo(), this.#actual()) }).subscribe({
      next: (matriz) => {
        this.isSaving.set(false);
        if (this.rolId() === id) this.aplicarMatriz(matriz);
        this.aviso.set(`Permisos del rol "${rol?.nombre ?? matriz.rol}" guardados.`);
        // Si es el rol de la sesión, el menú y las rutas se actualizan al momento.
        if (matriz.rol === this.#auth.usuario()?.rol) void this.#permisosSesion.recargar();
        alTerminar?.();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.guardarError.set('No se pudieron guardar los permisos: ' + mensajeError(err));
        alFallar?.();
      },
    });
  }

  // ---- Cambio de rol con cambios sin guardar ----

  /** Cambia al rol `id`, pidiendo confirmación si hay cambios sin guardar. */
  private solicitarCambioRol(id: number, limpiarAviso = false): void {
    if (id === this.rolId()) {
      this.rolControl.setValue(id, { emitEvent: false });
      return;
    }
    if (this.cambios() > 0) {
      // El select vuelve al rol actual hasta que se confirme.
      this.rolControl.setValue(this.rolId(), { emitEvent: false });
      this.abrirPendiente({ tipo: 'cambiar-rol', rolId: id });
      return;
    }
    if (limpiarAviso) this.aviso.set(null);
    this.seleccionarRol(id);
  }

  private abrirPendiente(accion: AccionPendiente): void {
    this.guardarFoco();
    this.pendiente.set(accion);
    this.enfocar(this.cancelarPendienteBtn);
  }

  cancelarPendiente(): void {
    const accion = this.pendiente();
    if (this.isSaving()) return;
    this.pendiente.set(null);
    if (accion?.tipo === 'salir') accion.resolver(false);
    this.restaurarFoco();
  }

  descartarYContinuar(): void {
    const accion = this.pendiente();
    if (!accion || this.isSaving()) return;
    this.#actual.set(this.#original());
    this.pendiente.set(null);
    this.#focoPrevio = null;
    this.ejecutar(accion);
  }

  guardarYContinuar(): void {
    const accion = this.pendiente();
    if (!accion || this.isSaving()) return;
    this.guardarPermisos(
      () => this.ejecutar(accion),
      () => {
        if (accion.tipo === 'salir') accion.resolver(false);
      },
    );
    // Si el guardado falla, se cierra la confirmación y el error queda visible en la pantalla.
    this.pendiente.set(null);
    this.#focoPrevio = null;
  }

  private ejecutar(accion: AccionPendiente): void {
    if (accion.tipo === 'cambiar-rol') {
      this.seleccionarRol(accion.rolId);
    } else if (accion.tipo === 'salir') {
      accion.resolver(true);
    } else {
      this.cargarTodo();
    }
  }

  // ---- Salida de la ruta con cambios sin guardar (canDeactivate) ----

  tieneCambiosPendientes(): boolean {
    return this.cambios() > 0;
  }

  /** Muestra la confirmación Guardar / Descartar / Cancelar; resuelve `true` si se puede salir. */
  confirmarSalida(): Promise<boolean> {
    // Una confirmación anterior aún abierta se da por cancelada.
    const previa = this.pendiente();
    if (previa?.tipo === 'salir') previa.resolver(false);
    if (this.isSaving()) return Promise.resolve(false);
    return new Promise<boolean>((resolver) => this.abrirPendiente({ tipo: 'salir', resolver }));
  }

  // ---- Crear / editar rol ----

  openModal(): void {
    this.abrirFormulario(null);
  }

  editarSeleccionado(): void {
    const rol = this.rolSeleccionado();
    if (rol) this.abrirFormulario(rol);
  }

  closeModal(): void {
    if (this.isSavingRol()) return;
    this.showModal.set(false);
    this.editando.set(null);
    this.restaurarFoco();
  }

  saveRol(): void {
    if (this.isSavingRol()) return;
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
    this.isSavingRol.set(true);
    peticion.subscribe({
      next: (guardado) => {
        this.isSavingRol.set(false);
        this.aviso.set(rol ? `Rol "${nombre}" actualizado.` : `Rol "${nombre}" creado.`);
        this.closeModal();
        // Un rol nuevo pasa a ser el seleccionado (con confirmación si hay cambios sin guardar).
        this.recargarRoles(rol ? null : guardado.id);
      },
      error: (err: unknown) => {
        this.isSavingRol.set(false);
        this.formError.set((rol ? 'Error al actualizar: ' : 'Error al crear: ') + mensajeError(err));
      },
    });
  }

  // ---- Eliminar rol ----

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
        if (this.rolId() === rol.id) {
          // Los cambios sin guardar eran de un rol que ya no existe.
          this.rolId.set(null);
          this.limpiarMatriz();
        }
        this.recargarRoles(null);
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

  protected cambiosTexto(n: number): string {
    return n === 1 ? '1 cambio sin guardar' : `${n} cambios sin guardar`;
  }

  /** Estado `checked` de una casilla a partir de su evento `change`. */
  protected marcado(event: Event): boolean {
    return event.target instanceof HTMLInputElement && event.target.checked;
  }

  /** Clic en el fondo del modal (no en su contenido). */
  protected onOverlayClick(event: MouseEvent, modal: Modal): void {
    if (event.target !== event.currentTarget) return;
    if (modal === 'form') this.closeModal();
    else if (modal === 'delete') this.cancelDelete();
    else this.cancelarPendiente();
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

/** Primer rol editable (no de sistema) o, si no hay, el primero de la lista. */
function rolPorDefecto(roles: readonly RolAdmin[]): number | null {
  return (roles.find((r) => !r.es_sistema) ?? roles[0])?.id ?? null;
}
