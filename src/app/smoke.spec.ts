import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

@Component({ selector: 'app-smoke', template: '<p>{{ label }}</p>' })
class SmokeComponent {
  label = 'ok';
}

describe('smoke', () => {
  it('runs specs through the Angular unit-test builder', () => {
    expect(1 + 1).toBe(2);
  });

  it('renders a component with TestBed under jsdom', async () => {
    await TestBed.configureTestingModule({ imports: [SmokeComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SmokeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ok');
  });
});
