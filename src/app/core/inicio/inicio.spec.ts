import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { MIS_PERMISOS_URL, MemoryStorage, guardarSesion, misPermisos, provideSesionStorage } from '../auth/auth.testing';
import { MisPermisos } from '../auth/permisos.models';
import { InicioComponent } from './inicio';

const storage = new MemoryStorage();

async function montar(respuesta: MisPermisos) {
  guardarSesion(storage, 'Usuario');
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSesionStorage(storage)],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(InicioComponent);
  fixture.detectChanges();
  TestBed.inject(HttpTestingController).expectOne(MIS_PERMISOS_URL).flush(respuesta);
  await fixture.whenStable();
  // El componente espera `listo()` y después navega: se deja correr esa cadena de promesas.
  await new Promise<void>((r) => setTimeout(r, 0));
  fixture.detectChanges();
  return { navegar, el: fixture.nativeElement as HTMLElement };
}

describe('InicioComponent (GRP S-10)', () => {
  beforeEach(() => storage.clear());
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    storage.clear();
  });

  it('con ver en Centros de Costos abre /centros-costos', async () => {
    const { navegar } = await montar(misPermisos('Usuario', { 'centros-costos': {} }));

    expect(navegar).toHaveBeenCalledWith('/centros-costos', { replaceUrl: true });
  });

  it('el Administrador también entra por Centros de Costos', async () => {
    const { navegar } = await montar(misPermisos('Administrador', {}, true));

    expect(navegar).toHaveBeenCalledWith('/centros-costos', { replaceUrl: true });
  });

  it('sin Centros de Costos pero con el menú de módulos, abre /modulos', async () => {
    const { navegar } = await montar(misPermisos('Usuario', { modulos: {} }));

    expect(navegar).toHaveBeenCalledWith('/modulos', { replaceUrl: true });
  });

  it('sin ninguno de los dos no redirige (evita el bucle con el guard) y avisa', async () => {
    const { navegar, el } = await montar(misPermisos('Usuario', { incidencias: {} }));

    expect(navegar).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="inicio-sin-acceso"]')?.textContent).toContain('No tiene módulos asignados');
  });
});
