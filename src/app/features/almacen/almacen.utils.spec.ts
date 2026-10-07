import { HttpErrorResponse } from '@angular/common/http';
import { alertaBadge, errorMessage, fmtMoney, fmtNum, plazoBadge, todayISO } from './almacen.utils';

describe('almacen.utils', () => {
  it('todayISO devuelve YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('errorMessage lee message string, lista o el mensaje HTTP', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 409, error: { message: 'Stock insuficiente' } }))).toBe('Stock insuficiente');
    expect(errorMessage(new HttpErrorResponse({ status: 400, error: { message: ['a', 'b'] } }))).toBe('a\nb');
    expect(errorMessage(new HttpErrorResponse({ status: 500, error: {} }))).toContain('500');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('otro')).toBe('Error inesperado');
  });

  it('fmtNum quita ceros sobrantes y maneja vacíos', () => {
    expect(fmtNum('86.0000')).toBe('86');
    expect(fmtNum('20.837209', 4)).toBe(fmtNum(20.8372));
    expect(fmtNum(null)).toBe('—');
    expect(fmtNum('')).toBe('—');
    expect(fmtNum('abc')).toBe('abc');
  });

  it('fmtMoney usa siempre 2 decimales', () => {
    expect(fmtMoney('20.837209')).toBe(fmtMoney(20.84));
    expect(fmtMoney(undefined)).toBe('—');
  });

  it('asigna el badge correcto a cada alerta y plazo', () => {
    expect(alertaBadge('OK')).toBe('badge-completed');
    expect(alertaBadge('BAJO_MINIMO')).toBe('badge-pending');
    expect(alertaBadge('SIN_STOCK')).toBe('badge-danger');
    expect(alertaBadge('EQUIPO_NO_OPERATIVO')).toBe('badge-danger');
    expect(plazoBadge('EN_PLAZO')).toBe('badge-completed');
    expect(plazoBadge('RETORNADO_A_TIEMPO')).toBe('badge-completed');
    expect(plazoBadge('VENCE_HOY')).toBe('badge-pending');
    expect(plazoBadge('RETORNADO_CON_RETRASO')).toBe('badge-pending');
    expect(plazoBadge('VENCIDO')).toBe('badge-danger');
    expect(plazoBadge('ANULADO')).toBe('badge-progress');
  });
});
