import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from './errores-http';
import { fmtMoney, fmtNum, todayISO } from './formato';

describe('shared/utils/formato', () => {
  it('todayISO devuelve YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('fmtNum quita ceros sobrantes y maneja vacíos', () => {
    expect(fmtNum('86.0000')).toBe('86');
    expect(fmtNum(null)).toBe('—');
    expect(fmtNum('')).toBe('—');
    expect(fmtNum('abc')).toBe('abc');
  });

  it('fmtMoney usa siempre 2 decimales', () => {
    expect(fmtMoney('20.837209')).toBe(fmtMoney(20.84));
    expect(fmtMoney(undefined)).toBe('—');
  });

  it('errorMessage lee message string, lista o el mensaje HTTP', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 409, error: { message: 'Stock insuficiente' } }))).toBe('Stock insuficiente');
    expect(errorMessage(new HttpErrorResponse({ status: 400, error: { message: ['a', 'b'] } }))).toBe('a\nb');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('otro')).toBe('Error inesperado');
  });
});
