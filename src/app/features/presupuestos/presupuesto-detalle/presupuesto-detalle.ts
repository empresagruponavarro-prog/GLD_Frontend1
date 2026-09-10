import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  PresupuestosService 
} from '../presupuestos.service';

import {
  PresupuestoCompleto
} from '../interfaces'

@Component({
  selector: 'app-presupuesto-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './presupuesto-detalle.html',
  styleUrl: './presupuesto-detalle.css'
})
export class PresupuestoDetalleComponent implements OnInit {
  protected readonly Number = Number;
  protected readonly Math = Math;

  private presupuestosService = inject(PresupuestosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isNew = signal<boolean>(false);
  loading = signal<boolean>(false);
  presupuesto = signal<PresupuestoCompleto | null>(null);
  activeTab = signal<'general' | 'fases' | 'liquidacion' | 'historial'>('general');

  liquidacion = computed(() => {
    const p = this.presupuesto();
    if (!p) return null;
    const cd = Number(p.CostoDirecto) || 0;
    const gg = Number(p.GastosGenerales) || 0;
    const ut = Number(p.Utilidad) || 0;
    const viaticos = Number(p.Viaticos) || 0;
    const dsct = Number(p.DsctoComercial) || 0;
    const sub = Number(p.SubTotalSinIGV) || 0;
    const igv = Number(p.IGV) || 0;
    const total = Number(p.Total) || 0;
    const ggPct = cd ? (gg / cd * 100) : 0;
    const utPct = cd ? (ut / cd * 100) : 0;
    return { cd, gg, ut, viaticos, dsct, sub, igv, total, ggPct, utPct };
  });

  fases = computed(() => this.presupuesto()?.fases || []);
  historiales = computed(() => this.presupuesto()?.historiales || []);

  totalFasesCD = computed(() =>
    this.fases().reduce((s, f) => s + (Number(f.CostoDirecto) || 0), 0)
  );

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id === 'nuevo' || !id) {
      this.isNew.set(true);
    } else {
      this.loadPresupuesto(id);
    }
  }

  loadPresupuesto(id: string) {
    this.loading.set(true);
    this.presupuestosService.getPresupuestoCompleto(id).subscribe({
      next: (res) => { 
        this.presupuesto.set(res); 
        this.loading.set(false); 
      },
      error: (err) => { 
        console.error('Error al cargar presupuesto completo:', err); 
        this.loading.set(false); 
      }
    });
  }

  setTab(tab: 'general' | 'fases' | 'liquidacion' | 'historial') { 
    this.activeTab.set(tab); 
  }

  volver() { 
    this.router.navigate(['/presupuestos']); 
  }

  estadoBadgeClass(estado?: string) {
    const s = (estado || '').toUpperCase();
    if (s === 'APROBADO') return 'badge-aprobado';
    if (s.includes('REVISION') || s.includes('DESARROLLO')) return 'badge-revision';
    if (s === 'ENTREGADO') return 'badge-entregado';
    return 'badge-pendiente';
  }
}
