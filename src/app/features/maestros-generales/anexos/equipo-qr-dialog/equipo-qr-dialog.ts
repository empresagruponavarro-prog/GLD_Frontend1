import { ChangeDetectionStrategy, Component, computed, input, output, viewChild } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { EquipoAsignado, TrabajadorResumen } from '../interfaces/equipo-asignado.interface';
import { contenidoQR, escaparHtml, formatearFecha, lineasQR } from './equipo-qr.util';

@Component({
  selector: 'app-equipo-qr-dialog',
  standalone: true,
  imports: [QRCodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipo-qr-dialog.html',
  styleUrl: './equipo-qr-dialog.css',
})
export class EquipoQrDialogComponent {
  readonly equipo = input.required<EquipoAsignado>();
  readonly trabajador = input.required<TrabajadorResumen>();
  readonly cerrar = output<void>();

  private readonly qr = viewChild(QRCodeComponent);

  protected readonly contenido = computed(() => contenidoQR(this.equipo(), this.trabajador()));
  protected readonly caracteristicas = computed(() => Object.entries(this.equipo().caracteristicas));
  protected readonly fecha = computed(() => formatearFecha(this.equipo().fechaAsignacion));

  protected descargarPng(): void {
    const dataUrl = this.dataUrl();
    if (!dataUrl) return;
    const e = this.equipo();
    const enlace = document.createElement('a');
    enlace.href = dataUrl;
    enlace.download = `QR-${e.codigo}-${e.serie ?? e.id}.png`;
    enlace.click();
  }

  protected imprimirEtiqueta(): void {
    const dataUrl = this.dataUrl();
    if (!dataUrl) return;
    const e = this.equipo();
    const ventana = window.open('', '_blank', 'width=420,height=560');
    if (!ventana) return;
    const lineas = lineasQR(e, this.trabajador())
      .map((l) => `<div>${escaparHtml(l)}</div>`)
      .join('');
    ventana.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta ${escaparHtml(e.codigo)}</title>
<style>body{font-family:Arial,sans-serif;margin:16px;color:#111}h1{font-size:14px;margin:8px 0}img{width:200px;height:200px}div{font-size:11px;line-height:1.4}</style>
</head><body onload="window.print()"><img src="${dataUrl}" alt="QR"><h1>${escaparHtml(`${e.codigo} ${e.marca} ${e.modelo}`)}</h1>${lineas}</body></html>`);
    ventana.document.close();
  }

  private dataUrl(): string | null {
    const raiz: HTMLElement | undefined = this.qr()?.qrcElement.nativeElement;
    const canvas = raiz?.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : null;
  }
}
