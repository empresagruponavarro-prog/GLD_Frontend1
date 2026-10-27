import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AreaOpcion, LocalOpcion, OpcionDestino } from '../interfaces/equipo-asignado.interface';
import { DESTINO_VACIO, DestinoSeleccionado, TipoDestino } from './ubicacion-destino.util';

/**
 * Selector de a dónde va un equipo. Empresa: se elige la empresa y luego nivel, ambiente y área
 * (el local se toma solo si la empresa tiene uno). Centro de costo: solo se escribe y selecciona el centro.
 */
@Component({
  selector: 'app-ubicacion-destino',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ubicacion-destino.html',
  styleUrl: './ubicacion-destino.css',
})
export class UbicacionDestinoComponent {
  readonly locales = input.required<LocalOpcion[]>();
  readonly empresas = input.required<OpcionDestino[]>();
  readonly centrosCosto = input.required<OpcionDestino[]>();
  readonly areas = input.required<AreaOpcion[]>();
  /** Prefijo de los ids de los campos (varios selectores pueden convivir en una pantalla). */
  readonly prefijo = input('ud');
  readonly cambio = output<DestinoSeleccionado>();

  protected readonly tipo = signal<TipoDestino | null>(null);
  protected readonly empresaId = signal(0);
  protected readonly localId = signal(0);
  protected readonly nivelId = signal(0);
  protected readonly ambienteId = signal(0);
  protected readonly areaId = signal(0);
  protected readonly centroId = signal(0);
  protected readonly centroTexto = signal('');

  protected readonly localesEmpresa = computed(() =>
    this.locales().filter((l) => l.destinoTipo === 'EMPRESA' && l.destinoId === this.empresaId()),
  );
  protected readonly niveles = computed(() => this.locales().find((l) => l.id === this.localId())?.niveles ?? []);
  protected readonly ambientes = computed(() => this.niveles().find((n) => n.id === this.nivelId())?.ambientes ?? []);

  protected readonly valor = computed<DestinoSeleccionado>(() => ({
    ...DESTINO_VACIO,
    tipo: this.tipo(),
    destinoId: this.tipo() === 'CENTRO_COSTO' ? this.centroId() : this.tipo() === 'EMPRESA' ? this.empresaId() : 0,
    localId: this.tipo() === 'EMPRESA' ? this.localId() : 0,
    nivelId: this.tipo() === 'EMPRESA' ? this.nivelId() : 0,
    ambienteId: this.tipo() === 'EMPRESA' ? this.ambienteId() : 0,
    areaId: this.tipo() === 'EMPRESA' ? this.areaId() : 0,
  }));

  private numero(evento: Event): number {
    const valor = (evento.target as HTMLSelectElement).value;
    return valor ? Number(valor) : 0;
  }

  private emitir(): void {
    this.cambio.emit(this.valor());
  }

  protected elegirTipo(tipo: TipoDestino): void {
    this.tipo.set(tipo);
    this.emitir();
  }

  protected elegirEmpresa(evento: Event): void {
    const id = this.numero(evento);
    this.empresaId.set(id);
    this.nivelId.set(0);
    this.ambienteId.set(0);
    this.areaId.set(0);
    // Si la empresa tiene un solo local, se toma sin preguntar.
    const locales = this.locales().filter((l) => l.destinoTipo === 'EMPRESA' && l.destinoId === id);
    this.localId.set(locales.length === 1 && locales[0] ? locales[0].id : 0);
    this.emitir();
  }

  protected elegirLocal(evento: Event): void {
    this.localId.set(this.numero(evento));
    this.nivelId.set(0);
    this.ambienteId.set(0);
    this.areaId.set(0);
    this.emitir();
  }

  protected elegirNivel(evento: Event): void {
    this.nivelId.set(this.numero(evento));
    this.ambienteId.set(0);
    this.areaId.set(0);
    this.emitir();
  }

  protected elegirAmbiente(evento: Event): void {
    const id = this.numero(evento);
    this.ambienteId.set(id);
    // El área por defecto es la de esa ubicación; se puede cambiar.
    this.areaId.set(this.ambientes().find((a) => a.id === id)?.areaId ?? 0);
    this.emitir();
  }

  protected elegirArea(evento: Event): void {
    this.areaId.set(this.numero(evento));
    this.emitir();
  }

  /** Se escribe el nombre del centro de costo; queda elegido cuando coincide con uno de la lista. */
  protected escribirCentro(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    this.centroTexto.set(texto);
    const buscado = texto.trim().toLowerCase();
    this.centroId.set(this.centrosCosto().find((c) => c.nombre.trim().toLowerCase() === buscado)?.id ?? 0);
    this.emitir();
  }
}
