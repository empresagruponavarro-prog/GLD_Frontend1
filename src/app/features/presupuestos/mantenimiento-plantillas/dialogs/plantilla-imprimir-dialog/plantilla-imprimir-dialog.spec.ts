import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PlantillaImprimirDialogComponent } from './plantilla-imprimir-dialog';
import { PlantillaCompleta } from '@app/features/presupuestos/presupuestos.service';

describe('PlantillaImprimirDialogComponent', () => {
  let component: PlantillaImprimirDialogComponent;
  let fixture: ComponentFixture<PlantillaImprimirDialogComponent>;

  const plantillaMock: PlantillaCompleta = {
    id: 1,
    IdPlantilla: 'PL-TAMBO-01',
    Nombre: 'Tambo Implementación y Obra Gruesa',
    Descripcion: 'Plantilla tipo para tiendas Tambo estándar',
    Activo: true,
    FechaCreacion: '2026-01-15',
    fases: [
      {
        id: 10,
        IdPlantillaFase: 'PF-01',
        IdpptoFase: 'F01',
        NombreFase: 'TRABAJOS PRELIMINARES',
        Orden: 0,
        categorias: [
          {
            id: 101,
            IdPlantillaFase: 'PF-01',
            IdpptoFaseCategoria: 'CAT-01',
            NombreCategoria: 'Demoliciones y desmontajes',
            CostoReferencial: 1500,
            VentaReferencial: 2200,
            totalItems: 3,
          },
          {
            id: 102,
            IdPlantillaFase: 'PF-01',
            IdpptoFaseCategoria: 'CAT-02',
            NombreCategoria: 'Trazo y replanteo',
            CostoReferencial: 800,
            VentaReferencial: 1200,
            totalItems: 0,
          },
        ],
      },
      {
        id: 20,
        IdPlantillaFase: 'PF-02',
        IdpptoFase: 'F02',
        NombreFase: 'OBRAS CIVILES Y CONCRETO',
        Orden: 1,
        categorias: [
          {
            id: 201,
            IdPlantillaFase: 'PF-02',
            IdpptoFaseCategoria: 'CAT-03',
            NombreCategoria: 'Concreto armado en losa',
            CostoReferencial: 5000,
            VentaReferencial: 7500,
            totalItems: 2,
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlantillaImprimirDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PlantillaImprimirDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('plantilla', plantillaMock);
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('calcula las métricas de los 3 niveles correctamente', () => {
    expect(component.totalFases()).toBe(2);
    expect(component.totalPartidas()).toBe(3);
    // Costo total: 1500 + 800 + 5000 = 7300
    expect(component.costoTotalEstimado()).toBe(7300);
  });

  it('calcula subtotales por cada fase', () => {
    const fase1 = plantillaMock.fases[0];
    expect(component.calcularSubtotalFase(fase1)).toBe(2300);

    const fase2 = plantillaMock.fases[1];
    expect(component.calcularSubtotalFase(fase2)).toBe(5000);
  });

  it('emite el evento closed al hacer clic en cerrar', () => {
    let cerrado = false;
    component.closed.subscribe(() => {
      cerrado = true;
    });

    const botonCerrar = fixture.nativeElement.querySelector('button[title="Cerrar"]');
    expect(botonCerrar).not.toBeNull();
    botonCerrar?.click();
    expect(cerrado).toBe(true);
  });

  it('permite colapsar y expandir fases como un acordeón', () => {
    // Por defecto todas están expandidas
    expect(component.isFaseExpandida(10)).toBe(true);
    expect(component.isFaseExpandida(20)).toBe(true);

    // Colapsar fase 10
    component.toggleFase(10);
    expect(component.isFaseExpandida(10)).toBe(false);
    expect(component.isFaseExpandida(20)).toBe(true);

    // Re-expandir fase 10
    component.toggleFase(10);
    expect(component.isFaseExpandida(10)).toBe(true);

    // Colapsar todas
    component.colapsarTodas();
    expect(component.isFaseExpandida(10)).toBe(false);
    expect(component.isFaseExpandida(20)).toBe(false);

    // Expandir todas
    component.expandirTodas();
    expect(component.isFaseExpandida(10)).toBe(true);
    expect(component.isFaseExpandida(20)).toBe(true);
  });
});
