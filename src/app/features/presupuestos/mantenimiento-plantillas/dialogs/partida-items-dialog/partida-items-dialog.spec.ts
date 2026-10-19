import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env';
import { PartidaItemsDialogComponent } from './partida-items-dialog';
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
