import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env';
import { PartidaItemsDialogComponent, posicionarLista } from './partida-items-dialog';
import { PartidaItemsResponse } from '@app/features/presupuestos/presupuestos.service';

const API = `${environment.apiUrl}/presupuestos`;

describe('PartidaItemsDialogComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PartidaItemsDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('carga los ítems de la partida y calcula los totales iniciales', async () => {
    const fixture = TestBed.createComponent(PartidaItemsDialogComponent);
    const cmp = fixture.componentInstance;
    cmp.partida = {
      id: 20,
      IdpptoFaseCategoria: 'C01',
      NombreCategoria: 'Cimentación',
      NombreFase: 'Obras Civiles',
    };

    fixture.detectChanges();

    // 1. Petición de unidades de medida
    const reqUnidades = http.expectOne(`${environment.apiUrl}/maestros/unidad-medida/select`);
    reqUnidades.flush([{ id: 1, nombre: 'UND' }, { id: 2, nombre: 'M2' }]);
    http.expectOne(`${environment.apiUrl}/maestros/categoria/select`).flush([{ id: 1, nombre: 'Materiales' }]);

    // 2. Petición de ítems
    const respuestaMock: PartidaItemsResponse = {
      id_plantilla_categoria: 20,
      costoTotal: 250,
      ventaTotal: 300,
      items: [
        {
          id: 101,
          id_plantilla_categoria: 20,
          id_producto: 5,
          id_unidad_medida: 1,
          Item: '1.01',
          Cantidad: 10,
          CostoUnitario: 25,
          PrecioVenta: 30,
          CostoTotal: 250,
          VentaTotal: 300,
          producto: {
            id: 5,
            codigo: 'PROD-005',
            descripcion: 'Cemento Portland Tipo I',
            tipo_producto: 'PRODUCTO',
            id_categoria: 1,
          },
          unidad: {
            id: 1,
            codigo: 'UND',
            descripcion: 'Unidad',
            simbolo: 'und',
          },
        },
      ],
    };

    const reqItems = http.expectOne(`${API}/plantillas/categorias/20/items`);
    reqItems.flush(respuestaMock);

    fixture.detectChanges();

    expect(cmp.cargando()).toBe(false);
    expect(cmp.filas().length).toBe(1);
    expect(cmp.totales().costoTotal).toBe(250);
  });

  it('permite añadir una nueva fila y recalcula subtotales en tiempo real', () => {
    const fixture = TestBed.createComponent(PartidaItemsDialogComponent);
    const cmp = fixture.componentInstance;
    cmp.partida = { id: 20, IdpptoFaseCategoria: 'C01' };

    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/maestros/unidad-medida/select`).flush([]);
    http.expectOne(`${environment.apiUrl}/maestros/categoria/select`).flush([]);
    http.expectOne(`${API}/plantillas/categorias/20/items`).flush({ id_plantilla_categoria: 20, items: [], costoTotal: 0, ventaTotal: 0 });

    cmp.agregarFila();
    expect(cmp.filas().length).toBe(1);

    const fila = cmp.filas()[0];
    fila.Cantidad = 5;
    fila.CostoUnitario = 10;
    fila.PrecioVenta = 15;
    cmp.recalcularFila(fila);

    expect(fila.CostoTotal).toBe(50);
    expect(fila.VentaTotal).toBe(75);
    expect(cmp.totales().costoTotal).toBe(50);
  });

  it('solo lectura: campos y select de categoría deshabilitados, sin agregar ni guardar', async () => {
    const fixture = TestBed.createComponent(PartidaItemsDialogComponent);
    const cmp = fixture.componentInstance;
    cmp.partida = { id: 20, IdpptoFaseCategoria: 'C01' };
    cmp.soloLectura = true;

    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/maestros/unidad-medida/select`).flush([{ id: 1, nombre: 'UND' }]);
    http.expectOne(`${environment.apiUrl}/maestros/categoria/select`).flush([{ id: 1, nombre: 'Materiales' }]);
    http.expectOne(`${API}/plantillas/categorias/20/items`).flush({
      id_plantilla_categoria: 20,
      costoTotal: 50,
      ventaTotal: 0,
      items: [
        {
          id: 101, id_plantilla_categoria: 20, id_producto: 5, id_unidad_medida: 1, Item: '1.01',
          Cantidad: 5, CostoUnitario: 10, PrecioVenta: 0, CostoTotal: 50, VentaTotal: 0,
          producto: { id: 5, codigo: 'PROD-005', descripcion: 'Cemento', tipo_producto: 'PRODUCTO', id_categoria: 1 },
          unidad: { id: 1, codigo: 'UND', descripcion: 'Unidad', simbolo: 'und' },
        },
      ],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement;
    const controles = Array.from(el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('tbody input, tbody select'));
    expect(controles.length).toBeGreaterThan(0);
    expect(controles.every((c) => c.disabled)).toBe(true);
    const textos = Array.from(el.querySelectorAll('button')).map((b) => b.textContent ?? '');
    expect(textos.some((t) => t.includes('Guardar Ítems'))).toBe(false);

    cmp.agregarFila();
    expect(cmp.filas().length).toBe(1);
  });
});

describe('posicionarLista (lista de resultados del buscador de productos)', () => {
  const ventana = { ancho: 1366, alto: 768 };
  const campo = (top: number, left = 400, width = 232): DOMRect => ({ top, bottom: top + 30, left, right: left + width, width, height: 30, x: left, y: top, toJSON: () => ({}) });

  it('se abre debajo del campo cuando hay lugar', () => {
    const p = posicionarLista(campo(200), ventana);
    expect(p.top).toBe(234);
    expect(p.bottom).toBeNull();
    expect(p.maxHeight).toBe(240);
  });

  it('se abre hacia arriba cuando abajo no cabe y arriba hay más lugar', () => {
    const p = posicionarLista(campo(660), ventana);
    expect(p.top).toBeNull();
    expect(p.bottom).toBe(768 - 660 + 4);
    expect(p.maxHeight).toBe(240);
  });

  it('si no cabe ni arriba ni abajo usa el lado con más espacio y se acorta', () => {
    const p = posicionarLista(campo(110), { ancho: 1366, alto: 300 });
    expect(p.top).toBe(144);
    expect(p.maxHeight).toBe(300 - 140 - 8 - 4);
  });

  it('es más ancha que un campo angosto y no se sale por la derecha', () => {
    const p = posicionarLista(campo(200, 1300, 120), ventana);
    expect(p.width).toBe(340);
    expect(p.left + p.width).toBeLessThanOrEqual(1366 - 8);
  });
});

describe('PartidaItemsDialogComponent: lista de resultados al frente', () => {
  it('al enfocar el campo coloca la lista junto a él, y al mover el scroll de la tabla la cierra', async () => {
    TestBed.configureTestingModule({ imports: [PartidaItemsDialogComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PartidaItemsDialogComponent);
    const cmp = fixture.componentInstance;
    cmp.partida = { id: 20, IdpptoFaseCategoria: 'C01' };
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/maestros/unidad-medida/select`).flush([{ id: 1, nombre: 'UND' }]);
    http.expectOne(`${environment.apiUrl}/maestros/categoria/select`).flush([{ id: 1, nombre: 'Materiales' }]);
    http.expectOne(`${API}/plantillas/categorias/20/items`).flush({ id_plantilla_categoria: 20, costoTotal: 0, ventaTotal: 0, items: [] });
    cmp.agregarFila();
    fixture.detectChanges();

    const campo = fixture.nativeElement.querySelector('tbody input[placeholder^="Buscar"]') as HTMLInputElement;
    vi.spyOn(campo, 'getBoundingClientRect').mockReturnValue({ top: 400, bottom: 430, left: 300, right: 532, width: 232, height: 30, x: 300, y: 400, toJSON: () => ({}) });
    campo.dispatchEvent(new Event('focus'));
    cmp.resultadosBusqueda.set([{ id: 1, codigo: 'P-1', descripcion: 'TEMPLE CONSTRUCTOR', tipo_producto: 'PRODUCTO' } as never]);
    cmp.mostrarResultados.set(true);
    fixture.detectChanges();

    const lista = (Array.from(fixture.nativeElement.querySelectorAll('tbody div.fixed')) as HTMLElement[])[0] ?? null;
    expect(lista).not.toBeNull();
    expect(lista?.textContent).toContain('TEMPLE CONSTRUCTOR');
    expect(lista?.style.left).toBe('300px');
    expect(lista?.style.top).toBe('434px');

    (fixture.nativeElement.querySelector('div.overflow-auto') as HTMLElement).dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(cmp.mostrarResultados()).toBe(false);
    http.verify();
  });
});

