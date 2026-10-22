import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@shared/utils/errores-http';
import { sinVacios } from '../../obra.calc';
import { ESTADOS_PLANTA, ObraResidente, ResidentePayload } from '../../obra.interface';
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
  protected readonly puedeEliminar = computed(() => this.residente() !== null && this.permisos().eliminar);

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
      this.form.reset({
        id_anexo: r?.id_anexo ?? null,
        nombre_completo: r?.nombre_completo ?? '',
        rol_obra: r?.rol_obra ?? '',
        especialidad: r?.especialidad ?? '',
        telefono: r?.telefono ?? '',
        correo: r?.correo ?? '',
        turno: r?.turno ?? 'Lun - Sáb 07:00 - 18:00',
        estado_planta: r?.estado_planta ?? 'En Planta',
        orden: r?.orden ?? null,
      });
      if (this.soloLectura()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
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
    const r = this.residente();
    const req$ = r
      ? this.#service.updateResidente(this.idCentroCosto(), r.id, payload)
      : this.#service.createResidente(this.idCentroCosto(), payload);

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
    if (!r || !this.puedeEliminar() || !confirm(`¿Desasignar a ${r.nombre_completo} de la obra?`)) return;
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
