import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { SearchSelectComponent } from '@shared/components/search-select/search-select';
import { AnexosService } from '@app/features/maestros-generales/anexos/anexos.service';
import { AnexoSelect } from '@app/features/maestros-generales/anexos/interfaces/anexos.interface';
import { sinVacios } from '../../obra.calc';
import { ObraCabecera, ObraDatosGenerales, UpdateGeneralesPayload } from '../../obra.interface';
import { ObraService } from '../../obra.service';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';

@Component({
  selector: 'app-generales-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, SearchSelectComponent],
  templateUrl: './generales-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralesDialogComponent {
  readonly #service = inject(ObraService);
  readonly #anexos = inject(AnexosService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly nombreObra = input<string>('');
  readonly generales = input<ObraDatosGenerales | undefined>(undefined);
  /** Inicio y fin programado de la obra (viven en el centro de costo). */
  readonly cabecera = input<ObraCabecera | undefined>(undefined);
  /** Permisos de `obra`: guardar la ficha (`PATCH …/generales`) exige `editar`. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly departamentosComunes = [
    'Lima', 'Callao', 'Arequipa', 'Cusco', 'La Libertad', 'Piura', 'Ica', 'Junín', 'Lambayeque', 'Ancash', 'San Martín', 'Loreto', 'Tacna', 'Puno'
  ];

  protected readonly turnosComunes = [
    'Diurno (07:30 - 17:00)',
    'Nocturno (22:00 - 06:00)',
    'Mixto / Doble Turno',
    'Continuo 24/7'
  ];

  protected abrirGoogleMaps(): void {
    const lat = this.form.controls.latitud.value;
    const lng = this.form.controls.longitud.value;
    if (lat && lng) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank', 'noopener');
    } else {
      const dir = this.form.controls.direccion.value;
      const dist = this.form.controls.distrito.value;
      if (dir) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dir}, ${dist}, Lima, Peru`)}`, '_blank', 'noopener');
      }
    }
  }

  /** Trabajadores para elegir el equipo de la obra (jefe, coordinador, residente, presupuesto, procura). */
  protected readonly trabajadores = signal<AnexoSelect[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeGuardar = computed(() => this.permisos().editar);
  /** Sin permiso de guardar, el formulario se muestra en solo lectura. */
  protected readonly soloLectura = computed(() => !this.puedeGuardar());

  protected readonly form = new FormGroup({
    expediente_codigo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    direccion: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    departamento: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    provincia: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    distrito: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    ubigeo_cod: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(10)] }),
    latitud: new FormControl<number | null>(null, { validators: [Validators.min(-90), Validators.max(90)] }),
    longitud: new FormControl<number | null>(null, { validators: [Validators.min(-180), Validators.max(180)] }),
    semanas_totales: new FormControl<number | null>(null, { validators: [Validators.min(1)] }),
    personal_activo_promedio: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    turno_trabajo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    contacto_cliente_nombre: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
    contacto_cliente_telefono: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    contacto_cliente_correo: new FormControl('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(150)] }),
    // Ficha operativa del control de avance
    codigo_obra: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
    tienda: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
    fecha_inicio: new FormControl('', { nonNullable: true }),
    fecha_fin_prog: new FormControl('', { nonNullable: true }),
    avance_general: new FormControl<number | null>(null, { validators: [Validators.min(0), Validators.max(100)] }),
    comentario: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    plazo_postventa_dias: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    observaciones_postventa: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    id_jefe_proyecto: new FormControl<number | null>(null),
    id_coordinador: new FormControl<number | null>(null),
    id_residente: new FormControl<number | null>(null),
    id_resp_presupuesto: new FormControl<number | null>(null),
    id_resp_procura: new FormControl<number | null>(null),
  });

  constructor() {
    this.#anexos.getSelect('Trabajador').subscribe((res) => this.trabajadores.set(res));
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      const g = this.generales();
      this.form.reset({
        expediente_codigo: g?.expediente_codigo ?? '',
        direccion: g?.direccion ?? '',
        departamento: g?.departamento ?? 'Lima',
        provincia: g?.provincia ?? 'Lima',
        distrito: g?.distrito ?? '',
        ubigeo_cod: g?.ubigeo_cod ?? '',
        latitud: g?.latitud ?? null,
        longitud: g?.longitud ?? null,
        semanas_totales: g?.semanas_totales ?? null,
        personal_activo_promedio: g?.personal_activo_promedio ?? null,
        turno_trabajo: g?.turno_trabajo ?? 'Diurno',
        contacto_cliente_nombre: g?.contacto_cliente_nombre ?? '',
        contacto_cliente_telefono: g?.contacto_cliente_telefono ?? '',
        contacto_cliente_correo: g?.contacto_cliente_correo ?? '',
        codigo_obra: g?.codigo_obra ?? '',
        tienda: g?.tienda ?? '',
        fecha_inicio: this.cabecera()?.fecha_inicio?.slice(0, 10) ?? '',
        fecha_fin_prog: this.cabecera()?.fecha_fin_prog?.slice(0, 10) ?? '',
        avance_general: g?.avance_general ?? null,
        comentario: g?.comentario ?? '',
        plazo_postventa_dias: g?.plazo_postventa_dias ?? null,
        observaciones_postventa: g?.observaciones_postventa ?? '',
        id_jefe_proyecto: g?.equipo?.jefe_proyecto?.id ?? null,
        id_coordinador: g?.equipo?.coordinador?.id ?? null,
        id_residente: g?.equipo?.residente?.id ?? null,
        id_resp_presupuesto: g?.equipo?.resp_presupuesto?.id ?? null,
        id_resp_procura: g?.equipo?.resp_procura?.id ?? null,
      });
      if (this.soloLectura()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });
  }

  protected onSubmit(): void {
    if (!this.puedeGuardar()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Revisa los valores: coordenadas válidas, números positivos y correo correcto.');
      return;
    }
    const v = this.form.getRawValue();
    if (v.fecha_inicio && v.fecha_fin_prog && v.fecha_fin_prog < v.fecha_inicio) {
      this.formError.set('El fin programado no puede ser anterior al inicio.');
      return;
    }
    const base = sinVacios<UpdateGeneralesPayload>({
      expediente_codigo: v.expediente_codigo.trim(),
      direccion: v.direccion.trim(),
      departamento: v.departamento.trim(),
      provincia: v.provincia.trim(),
      distrito: v.distrito.trim(),
      ubigeo_cod: v.ubigeo_cod.trim(),
      latitud: v.latitud ?? undefined,
      longitud: v.longitud ?? undefined,
      semanas_totales: v.semanas_totales ?? undefined,
      personal_activo_promedio: v.personal_activo_promedio ?? undefined,
      turno_trabajo: v.turno_trabajo.trim(),
      contacto_cliente_nombre: v.contacto_cliente_nombre.trim(),
      contacto_cliente_telefono: v.contacto_cliente_telefono.trim(),
      contacto_cliente_correo: v.contacto_cliente_correo.trim(),
      codigo_obra: v.codigo_obra.trim(),
      tienda: v.tienda.trim(),
      fecha_inicio: v.fecha_inicio,
      fecha_fin_prog: v.fecha_fin_prog,
    });
    // Estos campos sí se pueden vaciar: se envía `null` para borrarlos.
    const payload: UpdateGeneralesPayload = {
      ...base,
      avance_general: v.avance_general,
      comentario: v.comentario.trim() || null,
      plazo_postventa_dias: v.plazo_postventa_dias,
      observaciones_postventa: v.observaciones_postventa.trim() || null,
      id_jefe_proyecto: v.id_jefe_proyecto,
      id_coordinador: v.id_coordinador,
      id_residente: v.id_residente,
      id_resp_presupuesto: v.id_resp_presupuesto,
      id_resp_procura: v.id_resp_procura,
    };
    this.isSaving.set(true);
    this.#service.updateGenerales(this.idCentroCosto(), payload).subscribe({
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
