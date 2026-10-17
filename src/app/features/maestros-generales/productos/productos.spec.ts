import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Producto, ProductoPaginated } from './interfaces/productos.interface';
import { ProductosComponent } from './productos';

const PRODUCTO: Producto = {
  id: 1,
  codigo: 'CON-0001',
  descripcion: 'Cemento Portland',
  id_categoria: 1,
  id_unidad_medida: 1,
  tipo_producto: 'PRODUCTO',
  stock: '10',
  id_familia: null,
  clase_inventario: 'CONSUMIBLE',
  uso_principal: null,
  stock_minimo: '0',
  stock_objetivo: '0',
  estado_operativo: 'NORMAL',
  id_almacen_default: null,
  costo_promedio: '20',
  comentarios: null,
  imagen_url: null,
  estado: true,
};

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/maestros/producto')) {
    const pagina: ProductoPaginated = { data: [PRODUCTO], page: 1, pageSize: 20, total: 1, totalPages: 1 };
    return pagina;
  }
  return [];
}

const BOTONES = { nuevo: 'Nuevo Bien o Servicio', editar: 'Editar', desactivar: 'Desactivar', detalle: 'Ver detalle' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(ProductosComponent, misPermisos('Logística', { 'maestros.productos': acciones }), responder);
  expect(p.el.textContent).toContain('CON-0001');
  return p;
}

describe('ProductosComponent: botones según permisos (maestros.productos)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: solo "Ver detalle"', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nuevo: false, editar: false, desactivar: false, detalle: true });
  });

  it('crear → Nuevo; editar → Editar; eliminar → Desactivar (DELETE)', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ nuevo: true, editar: false, desactivar: false, detalle: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ nuevo: false, editar: true, desactivar: false, detalle: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES)).toEqual({ nuevo: false, editar: false, desactivar: true, detalle: true });
  });
});
