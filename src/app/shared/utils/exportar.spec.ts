import { generarCsv, generarXlsx } from './exportar';

describe('exportar', () => {
  const datos = {
    nombre: 'Prueba',
    columnas: ['ID', 'Nombre'],
    filas: [
      [1, 'Ñandú "grande"'],
      [2, '=SUMA(A1)'],
      [3, null],
    ],
  };

  it('genera CSV con BOM, comillas escapadas y fórmulas neutralizadas', () => {
    const lineas = generarCsv(datos).split('\r\n');
    expect(lineas[0]).toBe('\uFEFF"ID","Nombre"');
    expect(lineas[1]).toBe('1,"Ñandú ""grande"""');
    expect(lineas[2]).toBe("2,\"'=SUMA(A1)\"");
    expect(lineas[3]).toBe('3,""');
  });

  it('genera un libro xlsx (zip) no vacío', async () => {
    const blob = await generarXlsx(datos);
    const cabecera = new Uint8Array(await blob.arrayBuffer()).slice(0, 2);
    expect(String.fromCharCode(...cabecera)).toBe('PK');
  }, 60000);
});
