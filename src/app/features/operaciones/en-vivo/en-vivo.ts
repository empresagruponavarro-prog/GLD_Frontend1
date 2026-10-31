import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SituacionChipComponent } from '../../centros-costos/obra-cockpit/components/control-tab/situacion-chip/situacion-chip';
import { diaMes, textoDesviacion } from '../../centros-costos/obra-cockpit/obra-control.calc';
import { cargaPorPersona, distribuir, esVigente, estadoDe, kpisDe, ordenarObras, semaforoDeCarga } from '../operaciones.calc';
import { OperacionesStore } from '../operaciones.store';
import { BarraAvanceComponent } from '../ui/barra-avance/barra-avance';
import { DonaComponent } from '../ui/dona/dona';
import { GanttComponent } from '../ui/gantt/gantt';
import { filasDeObras } from '../ui/gantt/filas';
import { EstadoChipComponent } from '../ui/estado-chip/estado-chip';

/** Colores de cada estado en la dona (los mismos de las donas del modo pantalla). */
export const COLORES_ESTADO: Readonly<Record<string, string>> = {
  EN_EJECUCION: '#16a34a',
  PROXIMO: '#2563eb',
  POST_VENTA: '#7c3aed',
  SUSPENDIDA: '#d97706',
};
export const ETIQUETAS_ESTADO: Readonly<Record<string, string>> = {
  EN_EJECUCION: 'En ejecución',
  PROXIMO: 'Próximos',
  POST_VENTA: 'Post venta',
  SUSPENDIDA: 'Suspendidas',
};

/** Pantalla en vivo: KPI, donas, semáforo de carga, línea de tiempo y bitácora del portafolio (RF-OP-27..29). */
@Component({
  selector: 'app-en-vivo',
  standalone: true,
  imports: [SituacionChipComponent, BarraAvanceComponent, DonaComponent, GanttComponent, EstadoChipComponent],
  templateUrl: './en-vivo.html',
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnVivoComponent {
  protected readonly store = inject(OperacionesStore);
  protected readonly diaMes = diaMes;
  protected readonly desviacion = textoDesviacion;
  protected readonly coloresEstado = COLORES_ESTADO;

  /** Vigentes: lo que se ve en la pantalla en vivo (culminadas y canceladas no). */
  protected readonly vigentes = computed(() => ordenarObras(this.store.obras().filter(esVigente)));
  protected readonly kpis = computed(() => kpisDe(this.store.obras()));
  protected readonly porJefe = computed(() => distribuir(this.vigentes(), (o) => (o.equipo.jefe_proyecto ? { id: String(o.equipo.jefe_proyecto.id), etiqueta: o.equipo.jefe_proyecto.nombre } : null)));
  protected readonly porCoordinador = computed(() => distribuir(this.vigentes(), (o) => (o.equipo.coordinador ? { id: String(o.equipo.coordinador.id), etiqueta: o.equipo.coordinador.nombre } : null)));
  protected readonly porCliente = computed(() => distribuir(this.vigentes(), (o) => (o.cliente ? { id: String(o.cliente.id), etiqueta: o.cliente.nombre } : null)));
  protected readonly porEstado = computed(() => distribuir(this.vigentes(), (o) => ({ id: estadoDe(o), etiqueta: ETIQUETAS_ESTADO[estadoDe(o)] ?? estadoDe(o) })));
  protected readonly semaforoJefes = computed(() => semaforoDeCarga(cargaPorPersona(this.vigentes(), 'jefe')));
  protected readonly semaforoCoordinadores = computed(() => semaforoDeCarga(cargaPorPersona(this.vigentes(), 'coordinador')));
  protected readonly filas = computed(() => filasDeObras(this.vigentes(), this.store.hoy()));

  protected filtrarCliente(clave: string): void {
    this.store.actualizar({ cliente: Number(clave) });
  }
  protected filtrarJefe(clave: string): void {
    this.store.actualizar({ jefe: Number(clave) });
  }
  protected filtrarCoordinador(clave: string): void {
    this.store.actualizar({ coordinador: Number(clave) });
  }
  protected filtrarEstado(clave: string): void {
    if (clave === 'EN_EJECUCION' || clave === 'PROXIMO' || clave === 'POST_VENTA' || clave === 'SUSPENDIDA') this.store.actualizar({ estado: clave });
  }
  protected enfocar(id: string): void {
    const o = this.vigentes().find((x) => `o${x.id_centro_costo}` === id);
    if (o) this.store.enfocarObra(o);
  }
}
