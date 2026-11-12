import { HttpTestingController } from '@angular/common/http/testing';
import { hayBoton } from '@app/core/auth/pantalla.testing';
import { DisciplinaPlano, ObraPlano } from '../../obra.interface';
import { PermisosObra } from '../../obra-permisos';
import { TODOS_PERMISOS_OBRA, camposEditables, montarConCarga, permisosObra } from '../../obra-cockpit.testing';
import { ModoPlano, PlanoDialogComponent, generarSiguienteCodigoPlano } from './plano-dialog';

/** Disciplinas de la obra (columna «Disciplina» de los tipos de plano de su tipo de proyecto). */
const DISCIPLINAS: DisciplinaPlano[] = [
  { nombre: 'ARQUITECTURA', prefijo: 'ARQ' },
  { nombre: 'INSTALACIONES ELÉCTRICAS', prefijo: 'IE' },
];
const responderDisciplinas = (http: HttpTestingController) =>
  http.match((r) => r.method === 'GET' && r.url.endsWith('/operaciones/obra/10/planos/disciplinas')).forEach((r) => r.flush(DISCIPLINAS));
const montar = (componente: typeof PlanoDialogComponent, inputs: Readonly<Record<string, unknown>>) =>
  montarConCarga(componente, inputs, responderDisciplinas);

const PLANO: ObraPlano = {
  id: 9,
  codigo_plano: 'ARQ-01',
  nombre_plano: 'Planta general',
  disciplina: 'ARQUITECTURA',
  version: 'v1.0',
  es_vigente: true,
  estado_aprobacion: 'En Revisión',
  formato_peso: 'PDF (1.2 MB)',
  archivo_url: 'obras/10/planos/ab12cd34_arq.pdf',
  created_at: '2026-01-01',
};

const abrir = (modo: ModoPlano, permisos: PermisosObra) =>
  montar(PlanoDialogComponent, { isOpen: true, idCentroCosto: 10, modo, plano: modo === 'crear' ? null : PLANO, permisos });

const guardar = (el: HTMLElement) => el.querySelector('#btn-plano-guardar');
const eliminar = (el: HTMLElement) => el.querySelector('#btn-plano-eliminar');

describe('PlanoDialogComponent: permisos (obra)', () => {
  it('editar sin permiso de editar: solo lectura, sin Guardar, Subir, Quitar ni Eliminar', async () => {
    const { el, http } = await abrir('editar', permisosObra({ crear: true }));

    expect(camposEditables(el)).toHaveLength(0);
    expect(guardar(el)).toBeNull();
    expect(eliminar(el)).toBeNull();
    expect(hayBoton(el, 'Subir archivo')).toBe(false);
    expect(hayBoton(el, 'Quitar')).toBe(false);
    expect(el.textContent).toContain('arq.pdf');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it('alta: Guardar y Subir archivo exigen crear; sin crear no se puede regenerar el código', async () => {
    const sinCrear = await abrir('crear', permisosObra({ editar: true }));
    expect(guardar(sinCrear.el)).toBeNull();
    expect(hayBoton(sinCrear.el, 'Subir archivo')).toBe(false);
    expect(sinCrear.el.querySelector('[title="Regenerar código autoincrementable"]')).toBeNull();

    const conCrear = await abrir('crear', permisosObra({ crear: true }));
    expect(guardar(conCrear.el)?.textContent).toContain('Guardar Plano');
    expect(hayBoton(conCrear.el, 'Subir archivo')).toBe(true);
    expect(conCrear.el.querySelector('[title="Regenerar código autoincrementable"]')).not.toBeNull();
  });

  it('editar con solo editar: guarda los datos pero no sube archivos (POST …/archivo exige crear)', async () => {
    const { el } = await abrir('editar', permisosObra({ editar: true }));

    expect(camposEditables(el).length).toBeGreaterThan(0);
    expect(guardar(el)).not.toBeNull();
    expect(hayBoton(el, 'Quitar')).toBe(true);
    expect(hayBoton(el, 'Subir archivo')).toBe(false);
    expect(eliminar(el)).toBeNull();
  });

  it('nueva versión exige editar (@Accion editar en el backend)', async () => {
    const sinEditar = await abrir('version', permisosObra({ crear: true }));
    expect(guardar(sinEditar.el)).toBeNull();

    const conEditar = await abrir('version', permisosObra({ editar: true }));
    expect(guardar(conEditar.el)?.textContent).toContain('Emitir versión');
  });

  it('desde la lista de planos requeridos: código, nombre y disciplina del catálogo; código y disciplina fijos', async () => {
    const { el } = await montar(PlanoDialogComponent, {
      isOpen: true,
      idCentroCosto: 10,
      modo: 'crear',
      plano: null,
      permisos: TODOS_PERMISOS_OBRA,
      inicial: { codigo_plano: 'IE01', nombre_plano: 'PLANO DE LUMINARIAS', disciplina: 'INSTALACIONES ELÉCTRICAS' },
    });

    expect(el.textContent).toContain('Subir plano IE01');
    const codigo = el.querySelector<HTMLInputElement>('#pla-codigo')!;
    expect(codigo.value).toBe('IE01');
    expect(codigo.disabled).toBe(true);
    expect(el.querySelector<HTMLInputElement>('#pla-nombre')!.value).toBe('PLANO DE LUMINARIAS');
    const disciplina = el.querySelector<HTMLSelectElement>('#pla-disciplina')!;
    expect(disciplina.value).toBe('INSTALACIONES ELÉCTRICAS');
    expect(disciplina.disabled).toBe(true);
    expect(el.querySelector('[title="Regenerar código autoincrementable"]')).toBeNull();
    expect(el.textContent).toContain('De la lista de la obra');
  });

  it('desde la lista de planos requeridos no se guarda sin archivo (el check lo exige)', async () => {
    const { el, http, render } = await montar(PlanoDialogComponent, {
      isOpen: true,
      idCentroCosto: 10,
      modo: 'crear',
      plano: null,
      permisos: TODOS_PERMISOS_OBRA,
      inicial: { codigo_plano: 'A01', nombre_plano: 'PLANO DE DISTRIBUCIÓN', disciplina: 'ARQUITECTURA' },
    });

    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await render();

    http.expectNone((r) => r.method === 'POST');
    expect(el.textContent).toContain('Adjunta el archivo o el enlace del plano');
  });

  it('el desplegable muestra las disciplinas de la obra; al crear elige la primera y sugiere su código', async () => {
    const otros: ObraPlano[] = [{ ...PLANO, codigo_plano: 'ARQ-03' }, { ...PLANO, id: 2, codigo_plano: 'IE-01' }];
    const { el, render } = await montar(PlanoDialogComponent, { isOpen: true, idCentroCosto: 10, modo: 'crear', plano: null, permisos: TODOS_PERMISOS_OBRA, planosExistentes: otros });

    const disciplina = el.querySelector<HTMLSelectElement>('#pla-disciplina')!;
    expect([...disciplina.options].map((o) => o.textContent?.trim())).toEqual(['ARQUITECTURA (ARQ)', 'INSTALACIONES ELÉCTRICAS (IE)']);
    expect(disciplina.value).toBe('ARQUITECTURA');
    expect(el.querySelector<HTMLInputElement>('#pla-codigo')!.value).toBe('ARQ-04');

    disciplina.value = 'INSTALACIONES ELÉCTRICAS';
    disciplina.dispatchEvent(new Event('change'));
    await render();
    expect(el.querySelector<HTMLInputElement>('#pla-codigo')!.value).toBe('IE-02');
  });

  it('al editar, la disciplina que ya tiene el plano se conserva aunque no sea del tipo de proyecto', async () => {
    const { el } = await montar(PlanoDialogComponent, { isOpen: true, idCentroCosto: 10, modo: 'editar', plano: { ...PLANO, disciplina: 'DETALLES CONSTRUCTIVOS' }, permisos: TODOS_PERMISOS_OBRA });

    const disciplina = el.querySelector<HTMLSelectElement>('#pla-disciplina')!;
    expect(disciplina.value).toBe('DETALLES CONSTRUCTIVOS');
    expect(disciplina.options).toHaveLength(3);
  });

  it('generarSiguienteCodigoPlano sigue el correlativo del prefijo', () => {
    expect(generarSiguienteCodigoPlano('GAS', [])).toBe('GAS-01');
    expect(generarSiguienteCodigoPlano('ARQ', [{ ...PLANO, codigo_plano: 'arq-09' }])).toBe('ARQ-10');
  });

  it('Eliminar exige eliminar; con todos los permisos aparece todo', async () => {
    expect(eliminar((await abrir('editar', permisosObra({ eliminar: true }))).el)).not.toBeNull();

    const { el } = await abrir('editar', TODOS_PERMISOS_OBRA);
    expect(guardar(el)).not.toBeNull();
    expect(eliminar(el)).not.toBeNull();
    expect(hayBoton(el, 'Subir archivo')).toBe(true);
    expect(hayBoton(el, 'Quitar')).toBe(true);
  });
});
