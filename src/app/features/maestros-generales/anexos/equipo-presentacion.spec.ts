import { iconoDeTipo } from './equipo-presentacion';

describe('iconoDeTipo', () => {
  it('reconoce los tipos del desplegable de productos', () => {
    expect(iconoDeTipo('Laptop')).toBe('fa-laptop');
    expect(iconoDeTipo('PC')).toBe('fa-computer');
    expect(iconoDeTipo('Celular')).toBe('fa-mobile-screen');
    expect(iconoDeTipo('UPS')).toBe('fa-car-battery');
    expect(iconoDeTipo('Estabilizador')).toBe('fa-bolt');
    expect(iconoDeTipo('Switch')).toBe('fa-network-wired');
  });

  it('la cámara se reconoce con o sin tilde y en singular o plural', () => {
    expect(iconoDeTipo('Cámara de seguridad')).toBe('fa-video');
    expect(iconoDeTipo('camaras de seguridad')).toBe('fa-video');
    expect(iconoDeTipo('CÁMARA')).toBe('fa-video');
  });

  it('un tipo desconocido usa el icono genérico', () => {
    expect(iconoDeTipo('Otro')).toBe('fa-microchip');
  });
});
