import {
  clampPct,
  filtrarDocumentos,
  formatearBytes,
  hoyLimaIso,
  iconoArchivo,
  nombreArchivoDocumento,
  normalizarTexto,
  sinVacios,
} from './obra.calc';
import { ObraDocumento } from './obra.interface';

const doc = (over: Partial<ObraDocumento>): ObraDocumento => ({
  id: 1,
  titulo: 'Acta',
  categoria: 'Acta',
  estado: 'Validado',
  created_at: '2026-01-01',
  ...over,
});

describe('obra.calc', () => {
  describe('formatearBytes', () => {
    it.each([
      [0, '1 KB'],
      [512, '1 KB'],
      [2048, '2 KB'],
      [1024 * 1024 - 1, '1024 KB'],
      [1024 * 1024, '1.0 MB'],
      [3.8 * 1024 * 1024, '3.8 MB'],
      [50 * 1024 * 1024, '50.0 MB'],
      [null, ''],
      [undefined, ''],
      [-5, ''],
      [Number.NaN, ''],
    ])('%j -> %j', (bytes, esperado) => {
      expect(formatearBytes(bytes)).toBe(esperado);
    });
  });

  describe('iconoArchivo', () => {
    it.each([
      ['ACTA firmada.PDF', 'picture_as_pdf', 'PDF'],
      ['memoria.docx', 'description', 'DOCX'],
      ['metrado.xlsx', 'table_chart', 'XLSX'],
      ['presentacion.pptx', 'slideshow', 'PPTX'],
      ['foto.JPG', 'image', 'JPG'],
      ['planos.zip', 'folder_zip', 'ZIP'],
      ['sin-extension', 'draft', ''],
      ['archivo.raro', 'draft', 'RARO'],
      ['', 'draft', ''],
      [null, 'draft', ''],
    ])('%j -> %s / %s', (nombre, icono, extension) => {
      expect(iconoArchivo(nombre)).toMatchObject({ icono, extension });
    });
  });

  describe('hoyLimaIso', () => {
    it.each([
      ['2026-10-14T04:59:59Z', '2026-10-13'], // 23:59:59 en Lima
      ['2026-10-14T05:00:00Z', '2026-10-14'], // medianoche en Lima
      ['2026-01-01T03:00:00Z', '2025-12-31'], // cambio de año
      ['2026-03-01T12:00:00Z', '2026-03-01'],
    ])('%s -> %s', (instante, esperado) => {
      expect(hoyLimaIso(new Date(instante))).toBe(esperado);
    });
  });

  describe('normalizarTexto', () => {
    it.each([
      ['Licencia Municipal', 'licencia municipal'],
      ['  Póliza CAR ', 'poliza car'],
      ['ÑANDÚ', 'nandu'],
      ['', ''],
      [null, ''],
      [undefined, ''],
    ])('normaliza %j', (entrada, esperado) => {
      expect(normalizarTexto(entrada)).toBe(esperado);
    });
  });

  describe('filtrarDocumentos', () => {
    const docs = [
      doc({ id: 1, titulo: 'Acta de entrega de terreno', categoria: 'Acta', estado: 'Validado', nro_registro: 'AC-001' }),
      doc({ id: 2, titulo: 'Licencia de edificación', subtitulo: 'Municipalidad de Lima', categoria: 'Permiso', estado: 'Pendiente', nro_registro: 'LIC-77' }),
      doc({ id: 3, titulo: 'Póliza CAR', categoria: 'Seguridad', estado: 'Vencido' }),
    ];
    const ids = (r: ObraDocumento[]) => r.map((d) => d.id);

    it.each([
      ['sin filtros', {}, [1, 2, 3]],
      ['texto vacío', { texto: '   ' }, [1, 2, 3]],
      ['texto en título', { texto: 'acta' }, [1]],
      ['mayúsculas', { texto: 'ACTA' }, [1]],
      ['sin tilde encuentra con tilde (título)', { texto: 'edificacion' }, [2]],
      ['con tilde encuentra sin tilde', { texto: 'póliza' }, [3]],
      ['texto en subtítulo', { texto: 'lima' }, [2]],
      ['texto en nro_registro', { texto: 'lic-77' }, [2]],
      ['sin coincidencias', { texto: 'zzz' }, []],
      ['categoría', { categoria: 'Permiso' }, [2]],
      ['estado', { estado: 'Vencido' }, [3]],
      ['categoría y estado incompatibles', { categoria: 'Acta', estado: 'Vencido' }, []],
      ['texto + categoría', { texto: 'terreno', categoria: 'Acta' }, [1]],
      ['categoría vacía equivale a todas', { categoria: '' }, [1, 2, 3]],
    ])('%s', (_nombre, filtro, esperado) => {
      expect(ids(filtrarDocumentos(docs, filtro))).toEqual(esperado);
    });

    it('tolera campos opcionales ausentes y no muta la entrada', () => {
      const copia = [...docs];
      expect(filtrarDocumentos([doc({ id: 9 })], { texto: 'x' })).toEqual([]);
      filtrarDocumentos(docs, { texto: 'a' });
      expect(docs).toEqual(copia);
    });
  });

  describe('nombreArchivoDocumento', () => {
    it.each([
      ['obra/7/documentos/ab12cd34_acta final.pdf', 'acta final.pdf'],
      ['ab12cd34_acta.pdf', 'acta.pdf'],
      ['AB12CD34_Acta.PDF', 'Acta.PDF'],
      ['carpeta/sin-prefijo.pdf', 'sin-prefijo.pdf'],
      ['carpeta/zz12cd34_no-hex.pdf', 'zz12cd34_no-hex.pdf'],
      ['https://drive.google.com/file/d/123/view', 'drive.google.com'],
      ['http://servidor.local:8080/x.pdf', 'servidor.local:8080'],
      ['HTTPS://Ejemplo.com/a', 'ejemplo.com'],
      ['https://', 'Enlace externo'],
      [null, ''],
      [undefined, ''],
      ['', ''],
    ])('%j -> %j', (entrada, esperado) => {
      expect(nombreArchivoDocumento(entrada)).toBe(esperado);
    });
  });

  describe('sinVacios', () => {
    it('quita cadenas vacías, null y undefined', () => {
      expect(sinVacios({ a: '', b: null, c: undefined, d: 'x' })).toEqual({ d: 'x' });
    });

    it('conserva 0 y false', () => {
      expect(sinVacios({ n: 0, ok: false, t: '' })).toEqual({ n: 0, ok: false });
    });
  });

  describe('clampPct', () => {
    it.each([
      [50, 50],
      [0, 0],
      [100, 100],
      [-5, 0],
      [140, 100],
      [null, 0],
      [undefined, 0],
      [Number.NaN, 0],
    ])('%j -> %j', (entrada, esperado) => {
      expect(clampPct(entrada)).toBe(esperado);
    });
  });
});
