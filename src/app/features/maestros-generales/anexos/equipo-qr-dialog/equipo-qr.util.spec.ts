import { EquipoAsignado, TrabajadorResumen } from '../interfaces/equipo-asignado.interface';
import { contenidoQR, escaparHtml, formatearFecha } from './equipo-qr.util';

const EQUIPO: EquipoAsignado = {
  id: 7,
  codigo: 'Laptop01',
  codigoActivo: 'AF-0007',
  tipo: 'Laptop',
  marca: 'Lenovo',
  modelo: 'ThinkPad E14',
  color: null,
  serie: null,
  cantidad: 1,
  estado: 'Operativo',
  fechaAsignacion: '2026-10-26',
  caracteristicas: { RAM: '16 GB' },
  localId: 1,
  local: 'Sede',
  nivelId: 1,
  nivel: 'Piso 1',
  ambienteId: 1,
  ambiente: 'Oficina',
  areaId: 2,
  area: 'Sistemas',
  destino: 'TAMBO PRUEBA',
  destinoTipo: 'CENTRO_COSTO',
  destinoId: 951,
};

const TRABAJADOR: TrabajadorResumen = {
  id: 3,
  anexo: 'Ana Pérez',
  tipoDocumento: 'DNI',
  numeroDocumento: '12345678',
  especialidad: 'Sistemas',
};

describe('equipo-qr.util', () => {
  it('formatea la fecha ISO como dd/MM/yyyy', () => {
    expect(formatearFecha('2026-10-26')).toBe('26/10/2026');
  });

  it('arma el texto del QR con serie vacía, características, ubicación y trabajador', () => {
    const lineas = contenidoQR(EQUIPO, TRABAJADOR).split('\n');
    expect(lineas).toContain('Serie: -');
    expect(lineas).toContain('RAM: 16 GB');
    expect(lineas).toContain('Ubicacion: Sede / Piso 1 / Oficina');
    expect(lineas).toContain('Destino: Centro de costo TAMBO PRUEBA');
    expect(lineas).toContain('Area: Sistemas');
    expect(lineas).toContain('Asignado a: Ana Pérez (DNI 12345678)');
    expect(lineas).toContain('Fecha asignacion: 26/10/2026');
  });

  it('sin trabajador (equipo disponible) no incluye a quién está asignado', () => {
    const texto = contenidoQR({ ...EQUIPO, fechaAsignacion: '' }, null);
    expect(texto).not.toContain('Asignado a');
    expect(texto).not.toContain('Fecha asignacion');
    expect(texto).toContain('Ubicacion: Sede / Piso 1 / Oficina');
    // Un equipo en un centro de costo no tiene ubicación física.
    expect(contenidoQR({ ...EQUIPO, local: '', nivel: '', ambiente: '' }, null)).not.toContain('Ubicacion');
  });

  it('escapa HTML', () => {
    expect(escaparHtml(`<b a="1">&'</b>`)).toBe('&lt;b a=&quot;1&quot;&gt;&amp;&#39;&lt;/b&gt;');
  });
});
