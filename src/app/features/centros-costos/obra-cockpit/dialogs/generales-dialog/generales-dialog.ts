import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@shared/utils/errores-http';
import { sinVacios } from '../../obra.calc';
import { ObraDatosGenerales, UpdateGeneralesPayload } from '../../obra.interface';
import { ObraService } from '../../obra.service';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';

@Component({
  selector: 'app-generales-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './generales-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralesDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly nombreObra = input<string>('');
  readonly generales = input<ObraDatosGenerales | undefined>(undefined);
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
  });

  constructor() {
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
    const payload = sinVacios<UpdateGeneralesPayload>({
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
    });
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
