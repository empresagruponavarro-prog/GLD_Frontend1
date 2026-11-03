import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { sinVacios } from '../../obra.calc';
import { DatosEquipoDirectorioPayload, ESTADOS_PLANTA, ObraResidente, ResidentePayload } from '../../obra.interface';
import { AnexosService } from '@app/features/maestros-generales/anexos/anexos.service';
import { AnexoSelect, SelectOption } from '@app/features/maestros-generales/anexos/interfaces/anexos.interface';
import { ObraService } from '../../obra.service';
import { PermisosObra, SIN_PERMISOS_OBRA, puedeGuardarObra } from '../../obra-permisos';

@Component({
  selector: 'app-residente-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './residente-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResidenteDialogComponent {
  readonly #service = inject(ObraService);
  readonly #anexosService = inject(AnexosService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly residente = input<ObraResidente | null>(null);
  /** Permisos de `obra`: guardar exige `crear` (alta) o `editar` (ficha); Desasignar, `eliminar`. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly estadosPlanta = ESTADOS_PLANTA;
  protected readonly trabajadores = signal<AnexoSelect[]>([]);
  protected readonly especialidades = signal<SelectOption[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeGuardar = computed(() => puedeGuardarObra(this.permisos(), this.residente() !== null));
  /** Sin permiso de guardar, el formulario se muestra en solo lectura. */
  protected readonly soloLectura = computed(() => !this.puedeGuardar());
  /** Persona del equipo de la ficha técnica: nombre y cargo vienen de allí; aquí solo sus datos de obra. */
  protected readonly esEquipo = computed(() => this.residente()?.origen === 'equipo');
  /** Al equipo de la ficha se le quita desde la ficha, no desde el directorio. */
  protected readonly puedeEliminar = computed(() => this.residente() !== null && !this.esEquipo() && this.permisos().eliminar);
  protected readonly telefonoSugerido = computed(() => (this.esEquipo() ? this.residente()?.telefono_trabajador : undefined) ?? '987654321');
  protected readonly correoSugerido = computed(() => (this.esEquipo() ? this.residente()?.correo_trabajador : undefined) ?? 'usuario@gld.com.pe');

  protected readonly form = new FormGroup({
    id_anexo: new FormControl<number | null>(null),
    nombre_completo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    rol_obra: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    especialidad: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^\d{9}$/)] }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(150)] }),
    turno: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    estado_planta: new FormControl<string>('En Planta', { nonNullable: true }),
    orden: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
  });

  constructor() {
    this.#anexosService.getSelect('Trabajador').subscribe(res => this.trabajadores.set(res));
    this.#anexosService.getEspecialidadesSelect().subscribe(res => this.especialidades.set(res));

    this.form.controls.id_anexo.valueChanges.subscribe(id => {
      if (id) {
        this.#anexosService.getById(id).subscribe(anexo => {
          const especialidadStr = this.especialidades().find(e => e.id === anexo.AnexoEspecialidadId)?.nombre || '';
          this.form.patchValue({
            nombre_completo: anexo.Anexo || anexo.NombreComercial || '',
            rol_obra: especialidadStr,
            telefono: anexo.Telefono || '',
            correo: anexo.Correo || '',
            especialidad: especialidadStr
          });
        });
      }
    });

    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const r = this.residente();
      const equipo = this.esEquipo();
      // Sin emitir: elegir un anexo autocompleta, pero abrir una ficha no debe pisar lo guardado.
      this.form.reset({
        id_anexo: r?.id_anexo ?? null,
        nombre_completo: r?.nombre_completo ?? '',
        rol_obra: r?.rol_obra ?? '',
        especialidad: r?.especialidad ?? '',
        // Equipo de la ficha: solo el dato propio de la obra; el de Trabajadores se ve como sugerencia.
        telefono: (equipo ? r?.telefono_obra : r?.telefono) ?? '',
        correo: (equipo ? r?.correo_obra : r?.correo) ?? '',
        turno: r?.turno ?? 'Lun - Sáb 07:00 - 18:00',
        estado_planta: r?.estado_planta ?? 'En Planta',
        orden: r?.orden ?? null,
      }, { emitEvent: false });
      if (this.soloLectura()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
      if (equipo) {
        for (const c of [this.form.controls.id_anexo, this.form.controls.nombre_completo, this.form.controls.rol_obra, this.form.controls.orden]) c.disable({ emitEvent: false });
      }
    });
  }

  protected get isEdit(): boolean {
    return this.residente() !== null;
  }

  protected onSubmit(): void {
    if (!this.puedeGuardar()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Completa nombre y rol; verifica el formato del correo y teléfono.');
      return;
    }
    const v = this.form.getRawValue();
    const r = this.residente();
    if (r?.origen === 'equipo' && r.id_anexo !== undefined) {
      const datos: DatosEquipoDirectorioPayload = {
        especialidad: v.especialidad.trim() || null,
        telefono: v.telefono.trim() || null,
        correo: v.correo.trim() || null,
        turno: v.turno.trim() || null,
        estado_planta: v.estado_planta,
      };
      this.#guardar(this.#service.guardarDatosEquipo(this.idCentroCosto(), r.id_anexo, datos));
      return;
    }
    const payload = sinVacios<ResidentePayload>({
      id_anexo: v.id_anexo ?? undefined,
      nombre_completo: v.nombre_completo.trim(),
      rol_obra: v.rol_obra.trim(),
      especialidad: v.especialidad.trim(),
      telefono: v.telefono.trim(),
      correo: v.correo.trim(),
      turno: v.turno.trim(),
      estado_planta: v.estado_planta,
      orden: v.orden ?? undefined,
    });
    this.#guardar(
      r?.id != null ? this.#service.updateResidente(this.idCentroCosto(), r.id, payload) : this.#service.createResidente(this.idCentroCosto(), payload),
    );
  }

  #guardar(req$: Observable<ObraResidente>): void {
    this.isSaving.set(true);
    req$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }

  protected onDelete(): void {
    const r = this.residente();
    if (!r || r.id === null || !this.puedeEliminar() || !confirm(`¿Desasignar a ${r.nombre_completo} de la obra?`)) return;
    this.isSaving.set(true);
    this.#service.deleteResidente(this.idCentroCosto(), r.id).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }
}
