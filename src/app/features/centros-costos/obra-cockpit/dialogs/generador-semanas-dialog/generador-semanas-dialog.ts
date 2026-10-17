import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { ObraSemana, SemanaPayload } from '../../obra.interface';
import { ObraService } from '../../obra.service';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';

export interface PreviaSemana {
  numero_semana: number;
  etiqueta_semana: string;
  fecha_inicio: string;
  fecha_fin: string;
  fase_principal: string;
  porcentaje_meta: number;
  incremento_semanal: number;
}

@Component({
  selector: 'app-generador-semanas-dialog',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, ModalComponent],
  templateUrl: './generador-semanas-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneradorSemanasDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  readonly nombreObra = input<string>('');
  readonly fechaInicioSugerida = input<string | undefined>(undefined);
  readonly semanasExistentes = input<readonly ObraSemana[]>([]);
  /** Permisos de `obra`: generar el lote (`POST …/cronograma/lote`) exige `crear`. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<ObraSemana[]>();

  protected readonly isSaving = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeGuardar = computed(() => this.permisos().crear);
  /** Sin permiso de guardar, el formulario se muestra en solo lectura. */
  protected readonly soloLectura = computed(() => !this.puedeGuardar());

  protected readonly form = new FormGroup({
    fecha_inicio: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    cantidad_semanas: new FormControl<number>(12, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(52)] }),
    distribucion: new FormControl<'s_curve' | 'lineal' | 'cero'>('s_curve', { nonNullable: true }),
    fase_defecto: new FormControl('Ejecución de Obra', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    modo: new FormControl<'continuar' | 'reemplazar'>('continuar', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      this.formError.set('');
      this.form.enable({ emitEvent: false });

      const existentes = this.semanasExistentes();
      const sugerida = this.fechaInicioSugerida();
      let fechaIni = '';

      if (existentes.length > 0) {
        // Continuar desde el día siguiente a la última semana
        const ultima = [...existentes].sort((a, b) => b.numero_semana - a.numero_semana)[0];
        if (ultima.fecha_fin) {
          const d = new Date(ultima.fecha_fin);
          d.setDate(d.getDate() + 1);
          fechaIni = d.toISOString().slice(0, 10);
        }
      } else if (sugerida) {
        fechaIni = sugerida.slice(0, 10);
      } else {
        fechaIni = new Date().toISOString().slice(0, 10);
      }

      this.form.reset({
        fecha_inicio: fechaIni,
        cantidad_semanas: 12,
        distribucion: 's_curve',
        fase_defecto: 'Ejecución de Obra',
        modo: existentes.length > 0 ? 'continuar' : 'reemplazar',
      });
      if (this.soloLectura()) this.form.disable({ emitEvent: false });
    });
  }

  // Genera la previsualización de las semanas de forma reactiva
  protected readonly semanasGeneradas = computed<PreviaSemana[]>(() => {
    const raw = this.form.getRawValue();
    const cant = Math.min(Math.max(Number(raw.cantidad_semanas) || 1, 1), 52);
    const iniStr = raw.fecha_inicio;
    if (!iniStr) return [];

    const existentes = this.semanasExistentes();
    const esReemplazar = raw.modo === 'reemplazar';
    const numBase = esReemplazar ? 0 : existentes.reduce((max, s) => Math.max(max, s.numero_semana), 0);

    const resultado: PreviaSemana[] = [];
    const fechaActual = new Date(iniStr);
    let metaAnterior = 0;

    for (let i = 1; i <= cant; i++) {
      const numSemana = numBase + i;
      const etiqueta = `SEM ${numSemana < 10 ? '0' + numSemana : numSemana}`;

      const fIni = new Date(fechaActual);
      const fFin = new Date(fechaActual);
      fFin.setDate(fFin.getDate() + 6); // 7 días (lunes a domingo o bloque de 7)

      // Cálculo de meta acumulada según el tipo de distribución
      let meta: number;
      if (raw.distribucion === 'lineal') {
        meta = Number(((i / cant) * 100).toFixed(2));
      } else if (raw.distribucion === 's_curve') {
        // Smoothstep cúbico: S(t) = 3t^2 - 2t^3
        const t = i / cant;
        const sVal = 3 * Math.pow(t, 2) - 2 * Math.pow(t, 3);
        meta = i === cant ? 100 : Number((sVal * 100).toFixed(2));
      } else {
        meta = 0;
      }

      const incremento = Number(Math.max(0, meta - metaAnterior).toFixed(2));
      metaAnterior = meta;

      resultado.push({
        numero_semana: numSemana,
        etiqueta_semana: etiqueta,
        fecha_inicio: fIni.toISOString().slice(0, 10),
        fecha_fin: fFin.toISOString().slice(0, 10),
        fase_principal: raw.fase_defecto || 'Ejecución de Obra',
        porcentaje_meta: meta,
        incremento_semanal: incremento,
      });

      // Avanzar al día siguiente para la siguiente semana
      fechaActual.setDate(fechaActual.getDate() + 7);
    }

    return resultado;
  });

  protected setCantidad(n: number): void {
    if (this.soloLectura()) return;
    this.form.controls.cantidad_semanas.setValue(n);
  }

  protected setDistribucion(d: 's_curve' | 'lineal' | 'cero'): void {
    if (this.soloLectura()) return;
    this.form.controls.distribucion.setValue(d);
  }

  protected onSubmit(): void {
    if (!this.puedeGuardar()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set('Por favor completa todos los campos requeridos correctamente.');
      return;
    }

    const previas = this.semanasGeneradas();
    if (previas.length === 0) {
      this.formError.set('No se pudieron calcular las semanas. Revisa la fecha de inicio.');
      return;
    }

    const raw = this.form.getRawValue();
    const payloadSemanas: SemanaPayload[] = previas.map((p) => ({
      numero_semana: p.numero_semana,
      etiqueta_semana: p.etiqueta_semana,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin,
      fase_principal: p.fase_principal,
      porcentaje_meta: p.porcentaje_meta,
      porcentaje_real: 0,
      estado: 'Programado',
    }));

    this.isSaving.set(true);
    this.formError.set('');

    this.#service
      .createLoteSemanas(this.idCentroCosto(), {
        semanas: payloadSemanas,
        reemplazar_existentes: raw.modo === 'reemplazar',
      })
      .subscribe({
        next: (creadas) => {
          this.isSaving.set(false);
          this.saved.emit(creadas);
        },
        error: (err: unknown) => {
          this.isSaving.set(false);
          this.formError.set(errorMessage(err));
        },
      });
  }
}
