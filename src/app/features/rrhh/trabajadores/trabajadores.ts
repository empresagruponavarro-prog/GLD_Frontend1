import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { PermisosService } from '@app/core/auth/permisos.service';
import { mensajeError } from '@shared/utils/errores-http';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { ExportarBotonesComponent } from '../../../shared/components/exportar-botones/exportar-botones';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { DataTable } from '../../../shared/interfaces';
import { traerTodasLasPaginas, type DatosExportacion } from '../../../shared/utils/exportar';
import { EquiposTrabajadorModalComponent } from '../../maestros-generales/anexos/equipos-trabajador-modal/equipos-trabajador-modal';
import { TrabajadorResumen } from '../../maestros-generales/anexos/interfaces/equipo-asignado.interface';
import {
  AreaOpcion,
  OpcionCatalogo,
  OpcionSelect,
  ResumenTrabajadores,
  Situacion,
  Trabajador,
  TrabajadorGuardar,
  TrabajadorQuery,
} from './trabajadores.models';
import { TrabajadoresService } from './trabajadores.service';

/**
 * RR.HH. › Trabajadores: lista y ficha de los trabajadores (identificación, modalidad de contrato, área y
 * contacto personal e institucional). «Ver equipos» solo aparece a quien tiene el módulo de equipos.
 */
@Component({
  selector: 'app-trabajadores',
  standalone: true,
  imports: [ReactiveFormsModule, DataTableComponent, ModalComponent, ExportarBotonesComponent, EquiposTrabajadorModalComponent],
  templateUrl: './trabajadores.html',
  styleUrl: './trabajadores.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrabajadoresComponent {
  private readonly service = inject(TrabajadoresService);
  private readonly permisosService = inject(PermisosService);
  /** Nuevo → crear; Editar (incluye dar de baja) → editar. */
  protected readonly permisos = permisosDePantalla('rrhh.trabajadores');
  /** Permisos del módulo de equipos: deciden «Ver equipos» y qué se puede hacer dentro. */
  protected readonly permisosEquipos = permisosDePantalla('tecnologia.mantenimiento');
  protected readonly verEquipos = computed(() => this.permisosService.puede('tecnologia.mantenimiento', 'ver'));

  protected readonly columnas: DataTable[] = [
    { label: 'N° Documento', width: '160px' },
    { label: 'Nombre' },
    { label: 'Tipo / Modalidad de contrato' },
    { label: 'Área' },
    { label: 'Teléfono' },
    { label: 'Correo' },
    { label: 'Estado', align: 'center', width: '100px' },
    { label: 'Acciones', align: 'center', width: '110px' },
  ];

  // Lista
  protected readonly items = signal<Trabajador[]>([]);
  protected readonly cargando = signal(false);
  protected readonly pagina = signal(1);
  protected readonly tamanoPagina = signal(20);
  protected readonly total = signal(0);
  protected readonly busqueda = signal('');
  protected readonly estadoFiltro = signal<'' | 'true' | 'false'>('');
  protected readonly situacionFiltro = signal<Situacion | ''>('');
  protected readonly tipoFiltro = signal<number | null>(null);
  protected readonly modalidadFiltro = signal<number | null>(null);
  protected readonly areaFiltro = signal<number | null>(null);
  /** Conteos de las tarjetas de arriba (todos los trabajadores). */
  protected readonly resumen = signal<ResumenTrabajadores | null>(null);

  // Catálogos
  protected readonly tiposDoc = signal<OpcionCatalogo[]>([]);
  protected readonly tiposTrabajador = signal<OpcionCatalogo[]>([]);
  protected readonly modalidades = signal<OpcionCatalogo[]>([]);
  protected readonly especialidades = signal<OpcionSelect[]>([]);
  protected readonly areas = signal<AreaOpcion[]>([]);

  // Formulario
  protected readonly modalAbierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly modalError = signal('');
  protected readonly editando = signal<Trabajador | null>(null);
  protected readonly form = new FormGroup({
    idTipoTrabajador: new FormControl<number | null>(null),
    AnexoTipoDocIdeId: new FormControl<number | null>(null),
    NumeroDocIde: new FormControl('', { nonNullable: true }),
    Anexo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    idModalidadContrato: new FormControl<number | null>(null),
    AnexoEspecialidadId: new FormControl<number | null>(null),
    idArea: new FormControl<number | null>(null),
    estado: new FormControl(true, { nonNullable: true }),
    Direccion: new FormControl('', { nonNullable: true }),
    Telefono: new FormControl('', { nonNullable: true }),
    Correo: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    direccionInstitucional: new FormControl('', { nonNullable: true }),
    telefonoInstitucional: new FormControl('', { nonNullable: true }),
    correoInstitucional: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
  });

  /** Opciones de cada catálogo: las activas, más la que ya tiene el trabajador aunque esté desactivada. */
  protected readonly opcionesTipo = computed(() => this.opcionesCon(this.tiposTrabajador(), this.editando()?.idTipoTrabajador));
  protected readonly opcionesModalidad = computed(() => this.opcionesCon(this.modalidades(), this.editando()?.idModalidadContrato));

  private readonly areaElegida = toSignal(this.form.controls.idArea.valueChanges, { initialValue: null });
  /** El jefe del área elegida es el jefe inmediato del trabajador. */
  protected readonly jefeInmediato = computed(() => {
    const id = this.areaElegida();
    if (id === null) return '';
    const area = this.areas().find((a) => a.id === Number(id));
    if (!area) return '';
    return area.jefe ? `Jefe inmediato: ${area.jefe}` : 'Esa área no tiene jefe designado (vacante).';
  });

  // Equipos del trabajador
  protected readonly trabajadorEquipos = signal<TrabajadorResumen | null>(null);

  private temporizadorBusqueda: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.service.getOpciones().subscribe({
      next: (o) => {
        this.tiposDoc.set(o.tiposDocumento);
        this.tiposTrabajador.set(o.tiposTrabajador);
        this.modalidades.set(o.modalidadesContrato);
      },
      error: () => {
        this.tiposDoc.set([]);
        this.tiposTrabajador.set([]);
        this.modalidades.set([]);
      },
    });
    this.service.getEspecialidades().subscribe({ next: (r) => this.especialidades.set(r), error: () => this.especialidades.set([]) });
    this.service.getAreas().subscribe({ next: (r) => this.areas.set(r), error: () => this.areas.set([]) });
    this.cargar();
  }

  protected cargar(): void {
    this.service.getResumen().subscribe({ next: (r) => this.resumen.set(r), error: () => this.resumen.set(null) });
    this.cargando.set(true);
    this.service.getAll(this.consulta()).subscribe({
      next: (r) => {
        this.items.set(r.data);
        this.total.set(r.total);
        this.pagina.set(r.page);
        this.cargando.set(false);
      },
      error: () => {
        this.items.set([]);
        this.total.set(0);
        this.cargando.set(false);
      },
    });
  }

  private consulta(): TrabajadorQuery {
    const estado = this.estadoFiltro();
    return {
      page: this.pagina(),
      pageSize: this.tamanoPagina(),
      busqueda: this.busqueda().trim() || undefined,
      estado: estado === '' ? undefined : estado === 'true',
      situacion: this.situacionFiltro() || undefined,
      idTipoTrabajador: this.tipoFiltro() ?? undefined,
      idModalidadContrato: this.modalidadFiltro() ?? undefined,
      idArea: this.areaFiltro() ?? undefined,
    };
  }

  /** Exporta todos los trabajadores que cumplen los filtros activos (no solo la página visible). */
  protected readonly exportar = async (): Promise<DatosExportacion> => {
    const filtros = this.consulta();
    const filas = await traerTodasLasPaginas((page, pageSize) => this.service.getAll({ ...filtros, page, pageSize }));
    return {
      nombre: 'Trabajadores',
      columnas: [
        'ID', 'Tipo de trabajador', 'Tipo Doc', 'N° Documento', 'Nombre', 'Modalidad de contrato', 'Especialidad', 'Área',
        'Dirección personal', 'Teléfono personal', 'Correo personal',
        'Dirección institucional', 'Teléfono institucional', 'Correo institucional', 'Estado',
      ],
      filas: filas.map((t) => [
        t.id,
        t.tipoTrabajador,
        this.nombreTipoDoc(t.AnexoTipoDocIdeId),
        t.NumeroDocIde,
        t.Anexo,
        t.modalidadContrato,
        this.nombreEspecialidad(t.AnexoEspecialidadId),
        t.area,
        t.Direccion,
        t.Telefono,
        t.Correo,
        t.direccionInstitucional,
        t.telefonoInstitucional,
        t.correoInstitucional,
        t.estado ? 'Activo' : 'De baja',
      ]),
    };
  };

  protected buscar(evento: Event): void {
    const valor = evento.target instanceof HTMLInputElement ? evento.target.value : '';
    this.busqueda.set(valor);
    clearTimeout(this.temporizadorBusqueda);
    this.temporizadorBusqueda = setTimeout(() => {
      this.pagina.set(1);
      this.cargar();
    }, 350);
  }

  protected filtrarEstado(evento: Event): void {
    const valor = evento.target instanceof HTMLSelectElement ? evento.target.value : '';
    this.estadoFiltro.set(valor === 'true' || valor === 'false' ? valor : '');
    this.pagina.set(1);
    this.cargar();
  }

  /** Clic en una tarjeta: muestra solo esa situación (otro clic la quita). */
  protected verSituacion(situacion: Situacion): void {
    this.situacionFiltro.set(this.situacionFiltro() === situacion ? '' : situacion);
    this.pagina.set(1);
    this.cargar();
  }

  protected filtrarSituacion(evento: Event): void {
    const valor = evento.target instanceof HTMLSelectElement ? evento.target.value : '';
    this.situacionFiltro.set(valor === 'ficha-pendiente' || valor === 'documento-pendiente' ? valor : '');
    this.pagina.set(1);
    this.cargar();
  }

  /** Filtros por id (tipo, modalidad, área): vacío = todos. */
  protected filtrarPor(campo: 'tipo' | 'modalidad' | 'area', evento: Event): void {
    const texto = evento.target instanceof HTMLSelectElement ? evento.target.value : '';
    const valor = texto === '' ? null : Number(texto);
    const filtro = campo === 'tipo' ? this.tipoFiltro : campo === 'modalidad' ? this.modalidadFiltro : this.areaFiltro;
    filtro.set(valor !== null && Number.isInteger(valor) ? valor : null);
    this.pagina.set(1);
    this.cargar();
  }

  protected restablecer(): void {
    this.busqueda.set('');
    this.estadoFiltro.set('');
    this.situacionFiltro.set('');
    this.tipoFiltro.set(null);
    this.modalidadFiltro.set(null);
    this.areaFiltro.set(null);
    this.pagina.set(1);
    this.cargar();
  }

  protected cambiarPagina(pagina: number): void {
    this.pagina.set(pagina);
    this.cargar();
  }

  protected cambiarTamano(tamano: number): void {
    this.tamanoPagina.set(tamano);
    this.pagina.set(1);
    this.cargar();
  }

  protected nuevo(): void {
    if (!this.permisos.crear()) return;
    this.editando.set(null);
    this.modalError.set('');
    this.form.reset({
      idTipoTrabajador: null, AnexoTipoDocIdeId: null, NumeroDocIde: '', Anexo: '', idModalidadContrato: null,
      AnexoEspecialidadId: null, idArea: null, estado: true, Direccion: '', Telefono: '', Correo: '',
      direccionInstitucional: '', telefonoInstitucional: '', correoInstitucional: '',
    });
    this.modalAbierto.set(true);
  }

  protected editar(t: Trabajador): void {
    if (!this.permisos.editar()) return;
    this.editando.set(t);
    this.modalError.set('');
    // Un documento «-» (trabajadores antiguos) se muestra vacío para que se corrija.
    const documento = t.NumeroDocIde && !/^-+$/.test(t.NumeroDocIde.trim()) ? t.NumeroDocIde : '';
    this.form.reset({
      idTipoTrabajador: t.idTipoTrabajador,
      AnexoTipoDocIdeId: this.tiposDoc().some((d) => d.id === t.AnexoTipoDocIdeId) ? t.AnexoTipoDocIdeId : null,
      NumeroDocIde: documento,
      Anexo: t.Anexo ?? '',
      idModalidadContrato: t.idModalidadContrato,
      AnexoEspecialidadId: t.AnexoEspecialidadId,
      idArea: t.idArea,
      estado: t.estado,
      Direccion: t.Direccion ?? '',
      Telefono: t.Telefono ?? '',
      Correo: t.Correo ?? '',
      direccionInstitucional: t.direccionInstitucional ?? '',
      telefonoInstitucional: t.telefonoInstitucional ?? '',
      correoInstitucional: t.correoInstitucional ?? '',
    });
    this.modalAbierto.set(true);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  /** Errores que se pueden ver antes de enviar (el servidor vuelve a validar todo). */
  private errores(): string[] {
    const v = this.form.getRawValue();
    const errores: string[] = [];
    if (v.idTipoTrabajador === null) errores.push('Elige el tipo de trabajador.');
    if (v.AnexoTipoDocIdeId === null) errores.push('Elige el tipo de documento.');
    const documento = v.NumeroDocIde.trim();
    if (!documento || /^-+$/.test(documento)) errores.push('Escribe el número de documento.');
    else if (this.nombreTipoDoc(v.AnexoTipoDocIdeId).toUpperCase() === 'DNI' && !/^\d{8}$/.test(documento)) errores.push('El DNI tiene 8 dígitos.');
    if (!v.Anexo.trim()) errores.push('Escribe el nombre completo.');
    if (v.idModalidadContrato === null) errores.push('Elige la modalidad de contrato.');
    if (this.form.controls.Correo.invalid) errores.push('El correo personal no tiene un formato válido.');
    if (this.form.controls.correoInstitucional.invalid) errores.push('El correo institucional no tiene un formato válido.');
    return errores;
  }

  protected guardar(): void {
    const errores = this.errores();
    if (errores.length > 0) {
      this.form.markAllAsTouched();
      return this.modalError.set(errores.join('\n'));
    }
    const v = this.form.getRawValue();
    if (v.idTipoTrabajador === null || v.AnexoTipoDocIdeId === null || v.idModalidadContrato === null) return;
    const opcional = (valor: string) => valor.trim() || null;
    const datos: TrabajadorGuardar = {
      Anexo: v.Anexo.trim(),
      AnexoTipoDocIdeId: v.AnexoTipoDocIdeId,
      NumeroDocIde: v.NumeroDocIde.trim().toUpperCase(),
      AnexoEspecialidadId: v.AnexoEspecialidadId,
      idTipoTrabajador: v.idTipoTrabajador,
      idModalidadContrato: v.idModalidadContrato,
      idArea: v.idArea,
      Direccion: opcional(v.Direccion),
      Telefono: opcional(v.Telefono),
      Correo: opcional(v.Correo),
      direccionInstitucional: opcional(v.direccionInstitucional),
      telefonoInstitucional: opcional(v.telefonoInstitucional),
      correoInstitucional: opcional(v.correoInstitucional),
      estado: v.estado,
    };
    const actual = this.editando();
    this.guardando.set(true);
    this.modalError.set('');
    const peticion$ = actual ? this.service.update(actual.id, datos) : this.service.create(datos);
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

  protected abrirEquipos(t: Trabajador): void {
    if (!this.verEquipos()) return;
    this.trabajadorEquipos.set({
      id: t.id,
      anexo: t.Anexo ?? `ID ${t.id}`,
      tipoDocumento: this.nombreTipoDoc(t.AnexoTipoDocIdeId),
      numeroDocumento: t.NumeroDocIde ?? '—',
      especialidad: this.nombreEspecialidad(t.AnexoEspecialidadId),
    });
  }

  protected cerrarEquipos(): void {
    this.trabajadorEquipos.set(null);
  }

  /** Sin documento o con «-» (trabajadores antiguos): hay que corregirlo. */
  protected documentoPendiente(t: Trabajador): boolean {
    return !t.NumeroDocIde || /^-+$/.test(t.NumeroDocIde.trim());
  }

  protected nombreTipoDoc(id: number | null): string {
    if (id === null) return '—';
    return this.tiposDoc().find((t) => t.id === id)?.nombre ?? '—';
  }

  protected nombreEspecialidad(id: number | null): string {
    if (id === null) return '—';
    return this.especialidades().find((e) => e.id === id)?.nombre ?? `ID ${id}`;
  }

  private opcionesCon(lista: OpcionCatalogo[], actual: number | null | undefined): OpcionCatalogo[] {
    return lista.filter((o) => o.activo || o.id === actual);
  }
}
