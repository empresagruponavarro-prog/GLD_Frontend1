import { marcadoDeEvento, opcionValida, valorDeEvento } from './eventos';

function eventoEn(target: EventTarget): Event {
  const evento = new Event('input');
  target.dispatchEvent(evento);
  return evento;
}

describe('eventos', () => {
  it('valorDeEvento lee input, select y textarea; otro destino → ""', () => {
    const input = document.createElement('input');
    input.value = 'abc';
    expect(valorDeEvento(eventoEn(input))).toBe('abc');
    const select = document.createElement('select');
    select.append(new Option('Uno', 'UNO', true, true));
    expect(valorDeEvento(eventoEn(select))).toBe('UNO');
    const area = document.createElement('textarea');
    area.value = 'texto';
    expect(valorDeEvento(eventoEn(area))).toBe('texto');
    expect(valorDeEvento(eventoEn(document.createElement('div')))).toBe('');
  });

  it('marcadoDeEvento lee checked', () => {
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = true;
    expect(marcadoDeEvento(eventoEn(check))).toBe(true);
    expect(marcadoDeEvento(eventoEn(document.createElement('div')))).toBe(false);
  });

  it('opcionValida acota a la lista', () => {
    const OPCIONES = ['A', 'B'] as const;
    expect(opcionValida(OPCIONES, 'B')).toBe('B');
    expect(opcionValida(OPCIONES, 'C')).toBeNull();
  });
});
