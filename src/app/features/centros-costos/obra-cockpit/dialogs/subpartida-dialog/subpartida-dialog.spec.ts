import { TODOS_PERMISOS_OBRA, montar, permisosObra } from '../../obra-cockpit.testing';
import { ObraPartida, ObraSubpartida } from '../../obra-control.interface';
import { SubpartidaDialogComponent } from './subpartida-dialog';

const poner = (el: HTMLElement, selector: string, valor: string) => {
  const c = el.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  c.value = valor;
  c.dispatchEvent(new Event(c instanceof HTMLSelectElement ? 'change' : 'input'));
};

const subpartidas: ObraSubpartida[] = [];
const partida: ObraPartida = { id: 3, item: '03', nombre: 'Fachada', tipo: 'CONTRACTUAL', orden: 3, id_ppto_detalle_fase: null, subpartidas };

const existente: ObraSubpartida = {
  id: 8,
  id_partida: 3,
  item: '03.01',
  nombre: 'Pintura',
  tipo: 'CONTRACTUAL',
  tipo_propio: null,
  fecha_inicio: '2026-09-21',
  fecha_fin: '2026-10-03',
  orden: 1,
  observacion: null,
  id_ppto_detalle_categoria: 77,
  monto: '900.00',
  metas_manuales: Array<null>(10).fill(null),
  tiene_avance: false,
};

const abrirAlta = (permisos = TODOS_PERMISOS_OBRA) =>
  montar(SubpartidaDialogComponent, { isOpen: true, idCentroCosto: 10, partida, itemSugerido: '03.01', inicioObra: '2026-09-21', finObra: '2026-10-24', permisos });
const abrirEdicion = () =>
  montar(SubpartidaDialogComponent, { isOpen: true, idCentroCosto: 10, partida, subpartida: existente, inicioObra: '2026-09-21', finObra: '2026-10-24', permisos: TODOS_PERMISOS_OBRA });
const guardar = (el: HTMLElement) => el.querySelector('form')?.dispatchEvent(new Event('submit'));

describe('SubpartidaDialogComponent · monto (GRP S-02)', () => {
  it('el alta lleva el monto y lo envía junto con las demás fechas', async () => {
    const { el, http, render } = await abrirAlta();
    poner(el, '#sub-nombre', 'Pintura');
    poner(el, '#sub-monto', '250.5');
    await render();
    guardar(el);
    const req = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/partidas/3/subpartidas'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ item: '03.01', nombre: 'Pintura', monto: 250.5, fecha_inicio: '2026-09-21', fecha_fin: '2026-10-24' });
  });

  it('el monto es opcional: sin monto se envía null (la obra se pesa por duración si falta alguno)', async () => {
    const { el, http, render } = await abrirAlta();
    poner(el, '#sub-nombre', 'Pintura');
    await render();
    guardar(el);
    expect(http.expectOne((r) => r.url.endsWith('/subpartidas')).request.body).toMatchObject({ monto: null });
  });

  it('un monto negativo no se envía', async () => {
    const { el, http, render } = await abrirAlta();
    poner(el, '#sub-nombre', 'Pintura');
    poner(el, '#sub-monto', '-5');
    await render();
    guardar(el);
    await render();
    http.expectNone((r) => r.url.endsWith('/subpartidas'));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no puede ser negativo');
  });

  it('al editar muestra el monto que salió del presupuesto y lo avisa', async () => {
    const { el, http, render } = await abrirEdicion();
    expect(el.querySelector<HTMLInputElement>('#sub-monto')?.value).toBe('900');
    expect(el.textContent).toContain('Salió del presupuesto aprobado');
    poner(el, '#sub-monto', '950');
    await render();
    guardar(el);
    const req = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/subpartidas/8'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toMatchObject({ monto: 950 });
  });

  it('si la obra pesa por monto y falta el monto, muestra el mensaje del servidor', async () => {
    const { el, http, render } = await abrirAlta();
    poner(el, '#sub-nombre', 'Pintura');
    await render();
    guardar(el);
    http.expectOne((r) => r.url.endsWith('/subpartidas')).flush({ message: 'La obra pesa su avance por monto: indique el monto de la subpartida' }, { status: 400, statusText: 'Bad Request' });
    await render();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('pesa su avance por monto');
  });

  it('solo ver: el monto queda bloqueado y no hay botón de guardar', async () => {
    const { el } = await abrirAlta(permisosObra());
    expect(el.querySelector<HTMLInputElement>('#sub-monto')?.disabled).toBe(true);
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Crear subpartida'))).toBe(false);
  });
});
