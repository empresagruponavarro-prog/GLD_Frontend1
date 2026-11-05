import { Type } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormatoDosierComponent } from './dosier';
import { FormatoFichaObraComponent } from './ficha-obra';
import { FormatoInformeAvanceComponent } from './informe-avance';
import { FormatoPlanosDocumentosComponent } from './planos-documentos';
import { FormatoPresupuestoComercialComponent } from './presupuesto-comercial';
import { FormatoPresupuestoMetaComponent } from './presupuesto-meta';

type Cuerpo = object | string | number | boolean | null;
type Respuestas = (req: HttpRequest<unknown>) => { cuerpo: Cuerpo; status?: number } | undefined;

/**
 * Monta un formato (cada uno pide sus datos con `rxResource`: `whenStable` no termina con peticiones pendientes) y atiende
 * todas las peticiones, también las encadenadas (el dosier arma sus partes después de leer el manifiesto).
 */
async function montar<T>(componente: Type<T>, inputs: Record<string, unknown>, responder: Respuestas) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [componente], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  const fixture = TestBed.createComponent(componente);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  const http = TestBed.inject(HttpTestingController);
  const vistas: string[] = [];
  // `whenStable` no termina mientras haya peticiones pendientes: se atienden todas (incluidas las que nacen al dibujar las
  // partes del dosier) y solo entonces se espera.
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    fixture.detectChanges();
    // Los efectos de `rxResource` lanzan su petición en un microtask posterior al dibujo: se cede un turno antes de buscarlas.
    await new Promise<void>((r) => setTimeout(r, 0));
    fixture.detectChanges();
    const pendientes = http.match(() => true);
    if (pendientes.length === 0) break;
    for (const r of pendientes) {
      vistas.push(r.request.url);
      const resp = responder(r.request);
      if (!resp) r.flush({ message: 'sin respuesta de prueba' }, { status: 404, statusText: 'Not Found' });
      else if (resp.status && resp.status >= 400) r.flush(resp.cuerpo, { status: resp.status, statusText: 'Error' });
      else r.flush(resp.cuerpo);
    }
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, vistas, http };
}

const termina = (url: string, sufijo: string) => url.endsWith(sufijo);

const COMPLETO = {
  id: 1,
  IdPresupuesto: 'PPTO-2026-001',
  Proyecto: 'TIENDA NORTE',
  TipoPpto: 'Principal',
  periodo: 2026,
  estado_ppto: 'APROBADO',
  numero_version: 2,
  aprobado_por: 'ana',
  fecha_aprobacion: '2026-11-01T10:00:00Z',
  GGPorcentaje: 10,
  UtiliPorcentaje: 5,
  CostoDirecto: 1000,
  GastosGenerales: 100,
  Utilidad: 50,
  Viaticos: 20,
  SubTotalSinIGV: 1170,
  IGV: 210.6,
  Total: 1380.6,
  fases: [
    {
      id: 1,
      NombreFase: 'ESTRUCTURA',
      CostoDirecto: '1000.00',
      categorias: [
        { id: 11, Descripcion: 'MATERIALES', CostoDirecto: '600.00', totalItems: 3 },
        { id: 12, Descripcion: 'MANO DE OBRA', CostoDirecto: '400.00', totalItems: 2 },
      ],
    },
  ],
};

const COMERCIAL = {
  id: 1,
  id_presupuesto: 'PPTO-2026-001',
  proyecto: 'TIENDA NORTE',
  id_centro_costo: 10,
  estado_ppto: 'APROBADO',
  fases: [
    { id_fase: 1, nombre_fase: 'ESTRUCTURA', meta: 1000, comercial: 900, fuente: 'COTIZACION', requerimientos: [{ id: 5, numero: 'FUR-000005', estado: 'APROBADO', proveedor: 'CONTRATISTA SAC', monto: 900 }], sin_tipo_cambio: false },
    { id_fase: 2, nombre_fase: 'ACABADOS', meta: 500, comercial: 500, fuente: 'META', requerimientos: [], sin_tipo_cambio: false },
  ],
  total: { meta: 1500, comercial: 1400, diferencia: -100 },
  fases_cotizadas: 1,
};

const COCKPIT = {
  id_centro_costo: 10,
  nombre_obra: 'TIENDA NORTE',
  cabecera: { estado: 'ABIERTO', fecha_inicio: '2026-09-14', fecha_fin_prog: '2026-11-30', empresa: 'GLD SAC', cliente: 'ACME' },
  generales: { id: 1, codigo_obra: '6264', tienda: 'TIENDA NORTE', direccion: 'AV. CENTRAL 450', departamento: 'LIMA', estado_obra: 'EN_EJECUCION', semanas_totales: 12, contacto_cliente_nombre: 'LUIS PAZ' },
  kpis: {},
  cronograma: [],
  residentes: [{ id: null, clave: 'equipo-7-jefe_proyecto', origen: 'equipo', nombre_completo: 'ANA RUIZ', rol_obra: 'Jefe de proyecto', estado_planta: 'En Planta', orden: 0 }],
  planos: [
    { id: 1, codigo_plano: 'ARQ-01', nombre_plano: 'PLANTA', disciplina: 'Arquitectura', version: 'V1', es_vigente: true, estado_aprobacion: 'Aprobado', created_at: '2026-01-01' },
    { id: 2, codigo_plano: 'ARQ-00', nombre_plano: 'PLANTA ANTERIOR', disciplina: 'Arquitectura', version: 'V0', es_vigente: false, estado_aprobacion: 'Obsoleto', created_at: '2025-01-01' },
  ],
  documentos: [{ id: 1, titulo: 'ACTA DE INICIO', categoria: 'Acta', estado: 'Validado', created_at: '2026-09-14' }],
  incidencias: [],
};

const REQUERIDOS = {
  id_centro_costo: 10,
  id_tipo_proyecto: 1,
  tipo_proyecto: 'TAMBO',
  items: [
    { id_tipo_plano: 1, codigo: 'ARQ', nombre: 'ARQUITECTURA', obligatorio: true, entregado: true, entregado_por: 'ana', entregado_en: '2026-11-01' },
    { id_tipo_plano: 2, codigo: 'EST', nombre: 'ESTRUCTURAS', obligatorio: true, entregado: false, entregado_por: null, entregado_en: null },
  ],
  resumen: { total: 2, obligatorios: 2, entregados_obligatorios: 1, faltantes: [{ id_tipo_plano: 2, codigo: 'EST', nombre: 'ESTRUCTURAS' }], completo: false },
};

const CURVA = {
  inicioSemana1: '2026-09-14',
  semanaCorte: 2,
  excede: false,
  semanas: [1, 2, 3].map((s) => ({ semana: s, desde: '2026-09-14', hasta: '2026-09-20', pactado: s * 30, pactadoOriginal: s * 30, real: s <= 2 ? s * 25 : null, diasPausa: 0, semanaEnPausa: false, enCurso: s === 3 })),
};

const CONTROL = {
  id_centro_costo: 10,
  hoy: '2026-10-01',
  configurada: true,
  faltantes: [],
  estado_obra: 'EN_EJECUCION',
  ficha: {},
  resultado: {
    real: 50,
    programado: 60,
    programadoFinSemana: 60,
    desviacion: -10,
    situacion: { clave: 'crit', texto: 'Retrasada' },
    estadoEfectivo: 'EN_EJECUCION',
    sinPartidas: false,
    sinAvance: false,
    semana: { actual: 2, total: 3, texto: 'Semana 2 de 3', tarde: false },
    plazos: { finOriginal: '2026-11-30', finVigente: '2026-12-05', finControl: '2026-12-05', diasReprogramados: 5, diasExternos: 5, diasInternos: 0, enPausa: false, diasFueraDePlazo: 0, diasRetraso: 0, proximoAVencer: false },
    corte: '2026-10-01',
    partidas: [
      {
        item: '01', nombre: 'OBRAS PROVISIONALES', tipo: 'CONTRACTUAL', inicio: '2026-09-14', fin: '2026-09-30', peso: 10, pesoPct: 40, real: 50, programado: 60, programadoFinSemana: 60, desviacion: -10, situacion: { clave: 'crit', texto: 'Retrasada' },
        subpartidas: [{ item: '01.01', nombre: 'CERCO', tipo: 'CONTRACTUAL', inicio: '2026-09-14', fin: '2026-09-20', peso: 5, pesoPct: 20, diasLaborables: 6, metas: [], sinAvance: false, estadoCronograma: { clave: 'good', texto: 'A tiempo' }, real: 50, programado: 60, programadoFinSemana: 60, desviacion: -10, situacion: { clave: 'crit', texto: 'Retrasada' } }],
      },
    ],
    curvaS: CURVA,
    adicionales: null,
    avisos: [],
    postVenta: null,
  },
};

describe('Formatos de impresión (GRP T68, T80)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('presupuesto Meta: cabecera, fases con sus categorías y resumen económico', async () => {
    const { el, vistas } = await montar(FormatoPresupuestoMetaComponent, { presupuesto: 'PPTO-2026-001' }, (r) =>
      termina(r.url, '/presupuestos/PPTO-2026-001/completo') ? { cuerpo: COMPLETO } : undefined,
    );

    expect(vistas).toHaveLength(1);
    const texto = el.textContent ?? '';
    expect(texto).toContain('Presupuesto Meta PPTO-2026-001 · versión 2');
    expect(texto).toContain('TIENDA NORTE');
    expect(texto).toContain('Aprobado');
    expect(texto).toContain('ESTRUCTURA');
    expect(texto).toContain('MATERIALES');
    expect(texto).toContain('MANO DE OBRA');
    expect(el.querySelector('.imp-resumen .imp-total')?.textContent).toContain('1,380.60');
  });

  it('presupuesto Meta: un error del servidor se muestra y no se cae', async () => {
    const { el } = await montar(FormatoPresupuestoMetaComponent, { presupuesto: 'NO-EXISTE' }, () => ({ cuerpo: { message: 'Presupuesto "NO-EXISTE" no encontrado' }, status: 404 }));

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no encontrado');
  });

  it('presupuesto Comercial: monto por fase, su origen y los totales', async () => {
    const { el } = await montar(FormatoPresupuestoComercialComponent, { presupuesto: 'PPTO-2026-001' }, (r) =>
      termina(r.url, '/presupuestos/PPTO-2026-001/comercial') ? { cuerpo: COMERCIAL } : undefined,
    );
    const filas = Array.from(el.querySelectorAll('tbody tr')).map((f) => f.textContent ?? '');

    expect(filas[0]).toContain('Cotización ganadora');
    expect(filas[0]).toContain('FUR-000005 · CONTRATISTA SAC');
    expect(filas[0]).toContain('900.00');
    expect(filas[1]).toContain('Meta (sin cotización)');
    expect(el.querySelector('.imp-resumen .imp-total')?.textContent).toContain('1,400.00');
    expect(el.textContent).toContain('1 de 2');
  });

  it('ficha técnica: datos de la obra, ubicación, contacto y equipo', async () => {
    const { el } = await montar(FormatoFichaObraComponent, { idCentroCosto: 10 }, (r) => (termina(r.url, '/operaciones/obra/10/cockpit') ? { cuerpo: COCKPIT } : undefined));
    const texto = el.textContent ?? '';

    expect(texto).toContain('Ficha técnica · TIENDA NORTE');
    expect(texto).toContain('6264');
    expect(texto).toContain('GLD SAC');
    expect(texto).toContain('En ejecución');
    expect(texto).toContain('AV. CENTRAL 450');
    expect(texto).toContain('LUIS PAZ');
    expect(texto).toContain('ANA RUIZ');
    expect(texto).toContain('Jefe de proyecto');
  });

  it('informe de avance: resumen, partidas con subpartidas y la Curva S en SVG', async () => {
    const { el } = await montar(FormatoInformeAvanceComponent, { idCentroCosto: 10 }, (r) => (termina(r.url, '/operaciones/obra/10/control') ? { cuerpo: CONTROL } : undefined));
    const texto = el.textContent ?? '';

    expect(texto).toContain('Retrasada');
    expect(texto).toContain('OBRAS PROVISIONALES');
    expect(texto).toContain('CERCO');
    expect(texto).toContain('reprogramado 5 d');
    const svg = el.querySelector('svg[data-testid="curva-s"]');
    expect(svg).not.toBeNull();
    expect(svg?.querySelectorAll('path').length).toBe(2); // pactado y real
    expect(svg?.textContent).toContain('S3');
    expect(el.querySelector('[data-testid="frase-curva"]')?.textContent).toContain('semana 2');
  });

  it('informe de avance: una obra fuera del control de avance lo dice', async () => {
    const sinControl = { ...CONTROL, configurada: false, resultado: null };
    const { el } = await montar(FormatoInformeAvanceComponent, { idCentroCosto: 10 }, (r) => (termina(r.url, '/control') ? { cuerpo: sinControl } : undefined));

    expect(el.querySelector('[data-testid="informe-sin-control"]')).not.toBeNull();
    expect(el.querySelector('svg')).toBeNull();
  });

  it('planos y documentos: solo los planos vigentes, la lista de verificación y los documentos', async () => {
    const { el } = await montar(FormatoPlanosDocumentosComponent, { idCentroCosto: 10 }, (r) => {
      if (termina(r.url, '/operaciones/obra/10/cockpit')) return { cuerpo: COCKPIT };
      if (termina(r.url, '/operaciones/obra/10/planos-requeridos')) return { cuerpo: REQUERIDOS };
      return undefined;
    });
    const texto = el.textContent ?? '';

    expect(texto).toContain('1 de 2 planos obligatorios entregados');
    expect(texto).toContain('ARQ-01');
    expect(texto).not.toContain('ARQ-00'); // el plano anterior no se imprime
    expect(texto).toContain('ACTA DE INICIO');
  });
});

describe('Dosier de la obra (GRP T69, SP-17)', () => {
  const planos = { total: 2, obligatorios: 2, entregados_obligatorios: 2, faltantes: [], completo: true };
  const MANIFIESTO = {
    id_centro_costo: 10,
    nombre_obra: 'TIENDA NORTE',
    fecha: '2026-11-05',
    planos,
    secciones: [
      { codigo: 'PRESUPUESTO_META', titulo: 'Presupuesto Meta', disponible: true, referencias: ['PPTO-2026-001', 'PPTO-2026-002'] },
      { codigo: 'PRESUPUESTO_COMERCIAL', titulo: 'Presupuesto Comercial', disponible: true, referencias: ['PPTO-2026-001'] },
      { codigo: 'FICHA_OBRA', titulo: 'Ficha técnica de la obra', disponible: true, referencias: ['10'] },
      { codigo: 'INFORME_AVANCE', titulo: 'Informe de avance', disponible: false, referencias: [], nota: 'La obra no tiene partidas' },
      { codigo: 'PLANOS', titulo: 'Planos', disponible: true, referencias: ['2/2 obligatorios', '1 plano(s) cargado(s)'] },
      { codigo: 'DOCUMENTOS', titulo: 'Documentos técnicos y actas', disponible: true, referencias: ['1 documento(s)'] },
    ],
  };

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const responder: Respuestas = (r) => {
    if (termina(r.url, '/operaciones/obra/10/dosier')) return { cuerpo: MANIFIESTO };
    if (r.url.includes('/presupuestos/') && r.url.endsWith('/completo')) return { cuerpo: { ...COMPLETO, IdPresupuesto: r.url.split('/presupuestos/')[1].split('/')[0] } };
    if (r.url.endsWith('/comercial')) return { cuerpo: COMERCIAL };
    if (termina(r.url, '/cockpit')) return { cuerpo: COCKPIT };
    if (termina(r.url, '/planos-requeridos')) return { cuerpo: REQUERIDOS };
    return undefined;
  };

  it('arma, en el orden del manifiesto, cada parte disponible y salta de página entre ellas', async () => {
    const { el, vistas } = await montar(FormatoDosierComponent, { idCentroCosto: 10 }, responder);

    expect(el.querySelector('[data-testid="dosier-portada"]')?.textContent).toContain('Dosier de la obra · TIENDA NORTE');
    expect(el.querySelectorAll('[data-testid="formato-presupuesto-meta"]')).toHaveLength(2); // Principal y adicional
    expect(el.querySelectorAll('[data-testid="formato-presupuesto-comercial"]')).toHaveLength(1);
    expect(el.querySelector('[data-testid="formato-ficha-obra"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="formato-planos-documentos"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="formato-informe-avance"]')).toBeNull(); // no disponible
    expect(el.querySelectorAll('.imp-salto')).toHaveLength(5);
    // Las partes se piden con el código del presupuesto (no con un id).
    expect(vistas.some((u) => u.endsWith('/presupuestos/PPTO-2026-002/completo'))).toBe(true);
    // Orden: Meta, Meta, Comercial, Ficha, Planos y documentos.
    const orden = Array.from(el.querySelectorAll('.imp-salto > *')).map((n) => n.tagName.toLowerCase());
    expect(orden).toEqual(['app-formato-presupuesto-meta', 'app-formato-presupuesto-meta', 'app-formato-presupuesto-comercial', 'app-formato-ficha-obra', 'app-formato-planos-documentos']);
  });

  it('el índice marca qué entra y el aviso lista lo que falta con su motivo', async () => {
    const { el } = await montar(FormatoDosierComponent, { idCentroCosto: 10 }, responder);

    expect(el.querySelector('[data-seccion="INFORME_AVANCE"]')?.textContent).toContain('No');
    expect(el.querySelector('[data-seccion="FICHA_OBRA"]')?.textContent).toContain('Sí');
    expect(el.querySelector('[data-testid="dosier-faltantes"]')?.textContent).toContain('Informe de avance: La obra no tiene partidas');
  });

  it('con planos obligatorios pendientes el servidor responde 409 y el dosier no se arma', async () => {
    const { el, vistas } = await montar(FormatoDosierComponent, { idCentroCosto: 10 }, (r) =>
      termina(r.url, '/dosier') ? { cuerpo: { message: 'No se puede entregar el dosier: faltan 1 plano(s) obligatorio(s): ESTRUCTURAS' }, status: 409 } : undefined,
    );

    expect(el.querySelector('[data-testid="dosier-bloqueado"]')?.textContent).toContain('faltan 1 plano(s) obligatorio(s)');
    expect(el.querySelector('[data-testid="dosier-portada"]')).toBeNull();
    expect(vistas).toHaveLength(1); // no pidió ninguna parte
  });

  it('si solo hay documentos (sin planos) igual imprime su lista', async () => {
    const solo = { ...MANIFIESTO, secciones: MANIFIESTO.secciones.map((s) => (s.codigo === 'PLANOS' ? { ...s, disponible: false } : s)) };
    const { el } = await montar(FormatoDosierComponent, { idCentroCosto: 10 }, (r) => (termina(r.url, '/dosier') ? { cuerpo: solo } : responder(r)));

    expect(el.querySelectorAll('[data-testid="formato-planos-documentos"]')).toHaveLength(1);
  });
});
