import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '@shared/components/modal/modal';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { fechaCorta } from '../../obra-control.calc';
import { ETIQUETAS_ESTADO_OBRA, MensajeImportacion, VistaPreviaExcel } from '../../obra-control.interface';
import { PermisosObra, SIN_PERMISOS_OBRA } from '../../obra-permisos';
import { ObraService } from '../../obra.service';

const ETIQUETAS_ROL: Readonly<Record<string, string>> = {
  jefe_proyecto: 'Jefe de proyecto',
  coordinador: 'Coordinador',
  residente: 'Residente',
  resp_presupuesto: 'Resp. presupuesto',
  resp_procura: 'Resp. procura',
};

/**
 * Importa el Excel por proyecto (hojas Ficha, Partidas y Reprogramaciones) a esta obra (RF-OP-52).
 * Primero muestra una vista previa con los errores y avisos del archivo; solo se puede confirmar si no
 * hay errores. Importar reemplaza la ficha, la estructura (si no tiene avance) y las reprogramaciones.
 */
@Component({
  selector: 'app-importar-excel-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './importar-excel-dialog.html',
  styleUrl: '../../obra-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportarExcelDialogComponent {
  readonly #service = inject(ObraService);

  readonly isOpen = input(false);
  readonly idCentroCosto = input.required<number>();
  /** Permisos de `obra`: importar exige `editar`. */
  readonly permisos = input<PermisosObra>(SIN_PERMISOS_OBRA);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly fecha = fechaCorta;
  protected readonly estados = ETIQUETAS_ESTADO_OBRA;
  protected readonly roles = ETIQUETAS_ROL;
  protected readonly archivo = signal<File | null>(null);
  protected readonly vista = signal<VistaPreviaExcel | null>(null);
  protected readonly leyendo = signal(false);
  protected readonly importando = signal(false);
  protected readonly formError = signal('');
  protected readonly puedeGuardar = computed(() => this.permisos().editar);
  protected readonly puedeImportar = computed(() => this.puedeGuardar() && !!this.vista()?.importable && !this.importando());

  constructor() {
    effect(() => {
      if (this.isOpen()) this.reiniciar();
    });
  }

  private reiniciar(): void {
    this.archivo.set(null);
    this.vista.set(null);
    this.formError.set('');
    this.leyendo.set(false);
    this.importando.set(false);
  }

  protected elegir(event: Event): void {
    const input = event.target;
    const f = input instanceof HTMLInputElement ? (input.files?.[0] ?? null) : null;
    this.archivo.set(f);
    this.vista.set(null);
    this.formError.set('');
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) {
      this.formError.set('Solo se aceptan archivos .xlsx');
      return;
    }
    this.leyendo.set(true);
    this.#service.previsualizarExcel(this.idCentroCosto(), f).subscribe({
      next: (v) => {
        this.vista.set(v);
        this.leyendo.set(false);
      },
      error: (err: unknown) => {
        this.formError.set(errorMessage(err));
        this.leyendo.set(false);
      },
    });
  }

  protected confirmar(): void {
    const f = this.archivo();
    if (!f || !this.puedeImportar()) return;
    this.importando.set(true);
    this.formError.set('');
    this.#service.importarExcel(this.idCentroCosto(), f).subscribe({
      next: () => {
        this.importando.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.importando.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }

  protected donde(m: MensajeImportacion): string {
    return m.nombre ? `${m.fila} · ${m.nombre}` : m.fila;
  }
}
