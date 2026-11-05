import { toSignal } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { MapaPuntoComponent, PuntoMapa } from '@shared/components/mapa-punto/mapa-punto';
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
  imports: [ReactiveFormsModule, ModalComponent, SearchSelectComponent, MapaPuntoComponent],
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
  /**
   * La obra ya inició (en ejecución, entregada, culminada o con avance): inicio, fin programado y semanas no se editan;
   * una variación se registra como reprogramación en «Control de avance» (GRP S-02).
   */
  readonly plazoBloqueado = input(false);

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

  /** Código y tienda vienen del centro de costo: no se escriben en la ficha. */
  protected readonly codigoObra = computed(() => `CC-${this.idCentroCosto()}`);
  protected readonly tiendaObra = computed(() => this.nombreObra() || '—');

  protected readonly latitudMapa = toSignal(this.form.controls.latitud.valueChanges, { initialValue: this.form.controls.latitud.value });
  protected readonly longitudMapa = toSignal(this.form.controls.longitud.valueChanges, { initialValue: this.form.controls.longitud.value });

  /** El punto elegido en el mapa llena latitud y longitud. */
  protected elegirPunto(punto: PuntoMapa): void {
    this.form.patchValue({ latitud: punto.latitud, longitud: punto.longitud });
    this.form.markAsDirty();
  }

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
      if (this.plazoBloqueado()) {
        for (const c of [this.form.controls.fecha_inicio, this.form.controls.fecha_fin_prog, this.form.controls.semanas_totales]) c.disable({ emitEvent: false });
      }
    });
  }

  /** Imprime la ficha con sus datos actuales (también los aún no guardados) en una hoja limpia, sin el modal. */
  protected imprimir(): void {
    const v = this.form.getRawValue();
    const esc = (t: string): string =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const valor = (x: string | number | null): string => {
      const t = x === null || x === '' ? '' : String(x);
      return t === '' ? '—' : esc(t);
    };
    const persona = (id: number | null): string => valor(this.trabajadores().find((t) => t.id === id)?.nombre ?? null);
    const campo = (etiqueta: string, x: string | number | null, ancho = ''): string =>
      `<div class="c ${ancho}"><span>${etiqueta}</span><p>${valor(x)}</p></div>`;
    const seccion = (titulo: string, campos: string[]): string =>
      `<section><h2>${titulo}</h2><div class="g">${campos.join('')}</div></section>`;

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ficha técnica CC-${this.idCentroCosto()}</title><style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #1f2321; font-size: 11px; margin: 0; }
      header { border-bottom: 2px solid #5a9e80; padding-bottom: 8px; margin-bottom: 12px; }
      header small { color: #3b7a5e; font-weight: 700; letter-spacing: .06em; }
      header h1 { font-size: 17px; margin: 3px 0 2px; }
      header p { margin: 0; color: #64748b; }
      section { margin-bottom: 12px; break-inside: avoid; }
      h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #3b7a5e; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin: 0 0 6px; }
      .g { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 12px; }
      .c.x2 { grid-column: span 2; } .c.x4 { grid-column: 1 / -1; }
      .c span { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; }
      .c p { margin: 1px 0 0; padding-bottom: 2px; border-bottom: 1px dotted #cbd5e1; min-height: 14px; }
      footer { margin-top: 10px; color: #94a3b8; font-size: 9px; text-align: right; }
    </style></head><body>
      <header><small>SISTEMA GLD</small><h1>Ficha técnica &amp; datos operativos de la obra</h1>
      <p>CC-${this.idCentroCosto()}: ${esc(this.nombreObra() || 'Obra')}</p></header>
      ${seccion('Expediente &amp; ubicación', [
        campo('Código de expediente', v.expediente_codigo, 'x2'),
        campo('Dirección de la obra', v.direccion, 'x2'),
        campo('Departamento', v.departamento),
        campo('Provincia', v.provincia),
        campo('Distrito', v.distrito),
        campo('Ubigeo INEI', v.ubigeo_cod),
        campo('Latitud GPS', v.latitud, 'x2'),
        campo('Longitud GPS', v.longitud, 'x2'),
      ])}
      ${seccion('Régimen de operación', [
        campo('Semanas totales', v.semanas_totales),
        campo('Personal operativo promedio', v.personal_activo_promedio),
        campo('Régimen / turno de trabajo', v.turno_trabajo, 'x2'),
      ])}
      ${seccion('Contacto del cliente', [
        campo('Nombre', v.contacto_cliente_nombre, 'x2'),
        campo('Teléfono', v.contacto_cliente_telefono),
        campo('Correo', v.contacto_cliente_correo),
      ])}
      ${seccion('Control de avance &amp; equipo', [
        campo('Código de obra', this.codigoObra()),
        campo('Tienda', this.tiendaObra(), 'x2'),
        campo('Avance general (%)', v.avance_general),
        campo('Inicio programado', v.fecha_inicio),
        campo('Fin programado', v.fecha_fin_prog),
        campo('Plazo post venta (días)', v.plazo_postventa_dias, 'x2'),
        campo('Jefe de proyecto', persona(v.id_jefe_proyecto), 'x2'),
        campo('Coordinador', persona(v.id_coordinador), 'x2'),
        campo('Residente', persona(v.id_residente), 'x2'),
        campo('Resp. presupuesto', persona(v.id_resp_presupuesto), 'x2'),
        campo('Resp. procura', persona(v.id_resp_procura), 'x4'),
        campo('Comentario de la obra', v.comentario, 'x4'),
        campo('Observaciones de post venta', v.observaciones_postventa, 'x4'),
      ])}
      <footer>Impreso el ${esc(new Date().toLocaleString('es-PE'))}</footer>
    </body></html>`;

    const marco = document.createElement('iframe');
    marco.setAttribute('aria-hidden', 'true');
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(marco);
    const ventana = marco.contentWindow;
    if (!ventana) {
      marco.remove();
      return;
    }
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
    ventana.addEventListener('afterprint', () => marco.remove());
    ventana.focus();
    ventana.print();
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
    const plazo = this.plazoBloqueado()
      ? {}
      : { semanas_totales: v.semanas_totales ?? undefined, fecha_inicio: v.fecha_inicio, fecha_fin_prog: v.fecha_fin_prog };
    const base = sinVacios<UpdateGeneralesPayload>({
      expediente_codigo: v.expediente_codigo.trim(),
      direccion: v.direccion.trim(),
      departamento: v.departamento.trim(),
      provincia: v.provincia.trim(),
      distrito: v.distrito.trim(),
      ubigeo_cod: v.ubigeo_cod.trim(),
      latitud: v.latitud ?? undefined,
      longitud: v.longitud ?? undefined,
      personal_activo_promedio: v.personal_activo_promedio ?? undefined,
      turno_trabajo: v.turno_trabajo.trim(),
      contacto_cliente_nombre: v.contacto_cliente_nombre.trim(),
      contacto_cliente_telefono: v.contacto_cliente_telefono.trim(),
      contacto_cliente_correo: v.contacto_cliente_correo.trim(),
      ...plazo,
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
