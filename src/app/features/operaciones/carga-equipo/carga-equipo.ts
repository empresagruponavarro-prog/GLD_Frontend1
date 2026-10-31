import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { cargaPorPersona, CargaPersona, referenciaDe, RolCarga, semaforoDeCarga } from '../operaciones.calc';
import { OperacionesStore } from '../operaciones.store';
import { SituacionChipComponent } from '../../centros-costos/obra-cockpit/components/control-tab/situacion-chip/situacion-chip';
import { EstadoChipComponent } from '../ui/estado-chip/estado-chip';

/**
 * Carga de jefes de proyecto (referencia 10) o de coordinadores (referencia 5): barras apiladas
 * ejecución · próximos · post venta, con retraso y holgura (RF-OP-42, 43; RC-20). El rol viene de
 * `data.rol` de la ruta.
 */
@Component({
  selector: 'app-carga-equipo',
  standalone: true,
  imports: [SituacionChipComponent, EstadoChipComponent],
  templateUrl: './carga-equipo.html',
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CargaEquipoComponent {
  protected readonly store = inject(OperacionesStore);
  protected readonly rol: RolCarga = inject(ActivatedRoute).snapshot.data['rol'] === 'coordinador' ? 'coordinador' : 'jefe';
  protected readonly titulo = this.rol === 'jefe' ? 'Jefes de proyecto' : 'Coordinadores';
  protected readonly companeroEtiqueta = this.rol === 'jefe' ? 'Coordinadores' : 'Jefes';
  protected readonly referencia = referenciaDe(this.rol);

  protected readonly cargas = computed(() => cargaPorPersona(this.store.obras(), this.rol));
  protected readonly semaforo = computed(() => semaforoDeCarga(this.cargas()));
  /** Escala de las barras: lo mayor entre la referencia y la persona con más carga. */
  protected readonly maximo = computed(() => Math.max(this.referencia, ...this.cargas().map((c) => c.total)));
  protected readonly abierta = signal<number | null>(null);

  protected ancho(n: number): number {
    return (n / this.maximo()) * 100;
  }

  protected alternar(c: CargaPersona): void {
    this.abierta.update((a) => (a === c.persona.id ? null : c.persona.id));
  }

  protected filtrar(c: CargaPersona): void {
    this.store.actualizar(this.rol === 'jefe' ? { jefe: c.persona.id } : { coordinador: c.persona.id });
  }
}
