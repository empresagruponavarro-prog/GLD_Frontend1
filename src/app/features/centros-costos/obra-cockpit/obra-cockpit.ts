import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

// Service & Interfaces
import { ObraService } from './obra.service';
import { ObraCockpit, ObraSemana, ObraResidente, ObraPlano, ObraDocumento, ObraIncidencia } from './obra.interface';

// Tabs
import { CronogramaTabComponent } from './components/cronograma-tab/cronograma-tab';
import { DirectorioTabComponent } from './components/directorio-tab/directorio-tab';
import { PlanosTabComponent } from './components/planos-tab/planos-tab';
import { DocumentosTabComponent } from './components/documentos-tab/documentos-tab';
import { IncidenciasTabComponent } from './components/incidencias-tab/incidencias-tab';

// Dialogs
import { SemanaDialogComponent } from './dialogs/semana-dialog/semana-dialog';
import { ResidenteDialogComponent } from './dialogs/residente-dialog/residente-dialog';
import { PlanoDialogComponent, ModoPlano } from './dialogs/plano-dialog/plano-dialog';
import { PlanoVisorDialogComponent } from './dialogs/plano-visor-dialog/plano-visor-dialog';
import { HistorialPlanosDialogComponent } from './dialogs/historial-planos-dialog/historial-planos-dialog';
import { DocumentoDialogComponent } from './dialogs/documento-dialog/documento-dialog';
import { IncidenciaDialogComponent } from './dialogs/incidencia-dialog/incidencia-dialog';
import { GeneralesDialogComponent } from './dialogs/generales-dialog/generales-dialog';

@Component({
  selector: 'app-obra-cockpit',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    CronogramaTabComponent, DirectorioTabComponent, PlanosTabComponent, DocumentosTabComponent, IncidenciasTabComponent,
    SemanaDialogComponent, ResidenteDialogComponent, PlanoDialogComponent, PlanoVisorDialogComponent, HistorialPlanosDialogComponent,
    DocumentoDialogComponent, IncidenciaDialogComponent, GeneralesDialogComponent
  ],
  templateUrl: './obra-cockpit.html',
})
export class ObraCockpitComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private obraService = inject(ObraService);

  idCentroCosto = signal<number>(0);
  loading = signal<boolean>(false);
  cockpit = signal<ObraCockpit | null>(null);

  activeTab = signal<string>('tab-cronograma');
  exportMenuOpen = signal<boolean>(false);

  // Dialog visibilities
  showSemanaDialog = signal(false);
  showResidenteDialog = signal(false);
  showPlanoDialog = signal(false);
  showPlanoVisorDialog = signal(false);
  showHistorialDialog = signal(false);
  showDocumentoDialog = signal(false);
  showIncidenciaDialog = signal(false);
  showGeneralesDialog = signal(false);

  // Selected items for editing
  selectedSemana = signal<ObraSemana | null>(null);
  selectedResidente = signal<ObraResidente | null>(null);
  selectedPlano = signal<ObraPlano | null>(null);
  selectedPlanoParaVer = signal<ObraPlano | null>(null);
  planoDialogModo = signal<ModoPlano>('crear');
  selectedDocumento = signal<ObraDocumento | null>(null);
  selectedIncidencia = signal<ObraIncidencia | null>(null);

  // Computed data for tabs
  semanas = computed(() => this.cockpit()?.cronograma || []);
  kpis = computed(() => this.cockpit()?.kpis);
  cabecera = computed(() => this.cockpit()?.cabecera);
  generales = computed(() => this.cockpit()?.generales);
  residentes = computed(() => this.cockpit()?.residentes || []);
  planos = computed(() => this.cockpit()?.planos || []);
  documentos = computed(() => this.cockpit()?.documentos || []);
  incidencias = computed(() => this.cockpit()?.incidencias || []);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) {
        this.idCentroCosto.set(id);
        this.cargarCockpit(id);
      }
    });
  }

  cargarCockpit(id: number): void {
    this.loading.set(true);
    this.obraService.getCockpit(id).subscribe({
      next: (data) => {
        this.cockpit.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando cockpit', err);
        this.loading.set(false);
      },
    });
  }

  volver(): void {
    this.router.navigate(['/centros-costos']);
  }

  setTab(tabId: string): void {
    this.activeTab.set(tabId);
  }

  toggleExportMenu(): void {
    this.exportMenuOpen.update((v) => !v);
  }

  // --- Generic Save Handler ---
  onDialogSaved(): void {
    // Close all dialogs and refresh data
    this.showSemanaDialog.set(false);
    this.showResidenteDialog.set(false);
    this.showPlanoDialog.set(false);
    this.showDocumentoDialog.set(false);
    this.showIncidenciaDialog.set(false);
    this.showGeneralesDialog.set(false);
    this.showHistorialDialog.set(false);
    
    this.cargarCockpit(this.idCentroCosto());
  }

  // --- Handlers for Cronograma Tab ---
  onNuevaSemana(): void {
    this.selectedSemana.set(null);
    this.showSemanaDialog.set(true);
  }
  onEditarSemana(sem: ObraSemana): void {
    this.selectedSemana.set(sem);
    this.showSemanaDialog.set(true);
  }
  onEvidenciasSemana(sem: ObraSemana): void {
    // TODO: implement evidence viewer
  }

  // --- Handlers for Directorio Tab ---
  onNuevoResidente(): void {
    this.selectedResidente.set(null);
    this.showResidenteDialog.set(true);
  }
  onEditarResidente(res: ObraResidente): void {
    this.selectedResidente.set(res);
    this.showResidenteDialog.set(true);
  }

  // --- Handlers for Planos Tab ---
  onSubirPlano(): void {
    this.selectedPlano.set(null);
    this.planoDialogModo.set('crear');
    this.showPlanoDialog.set(true);
  }
  onVerPlano(plano: ObraPlano): void {
    if (!plano.archivo_url) {
      alert(`El plano ${plano.codigo_plano} no tiene archivo adjunto.`);
      return;
    }
    this.selectedPlanoParaVer.set(plano);
    this.showPlanoVisorDialog.set(true);
  }
  onDescargarPlano(plano: ObraPlano): void {
    if (!plano.archivo_url) {
      alert(`El plano ${plano.codigo_plano} no tiene archivo adjunto.`);
      return;
    }
    if (/^https?:\/\//i.test(plano.archivo_url)) {
      window.open(plano.archivo_url, '_blank', 'noopener');
      return;
    }
    // Descarga directa en memoria sin exponer la ruta del backend en la barra del navegador
    this.obraService.descargarArchivoPlanoBlob(this.idCentroCosto(), plano.id, false).subscribe({
      next: (blob) => {
        const extMatch = plano.archivo_url?.match(/\.([a-z0-9]+)(?:\?|$)/i);
        const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.pdf';
        const nombre = `${plano.codigo_plano}_${plano.version || 'v1'}${ext}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      error: () => {
        alert('No se pudo descargar el archivo.');
      },
    });
  }
  onNuevaVersionPlano(plano: ObraPlano): void {
    this.selectedPlano.set(plano);
    this.planoDialogModo.set('version');
    this.showPlanoDialog.set(true);
  }
  onHistorialPlano(plano: ObraPlano): void {
    this.selectedPlano.set(plano);
    this.showHistorialDialog.set(true);
  }
  onEliminarPlano(plano: ObraPlano): void {
    const msg = plano.id_plano_anterior
      ? `¿Eliminar la versión ${plano.version} de ${plano.codigo_plano}? La versión anterior volverá a quedar vigente.`
      : `¿Eliminar el plano ${plano.codigo_plano} (${plano.version}) y su archivo? Esta acción no se puede deshacer.`;
    if (!confirm(msg)) return;
    this.obraService.deletePlano(this.idCentroCosto(), plano.id).subscribe({
      next: () => this.cargarCockpit(this.idCentroCosto()),
      error: () => alert('No se pudo eliminar el plano.'),
    });
  }

  // --- Handlers for Documentos Tab ---
  onAnexarDocumento(): void {
    this.selectedDocumento.set(null);
    this.showDocumentoDialog.set(true);
  }
  onVerDetalleDocumento(doc: ObraDocumento): void {
    this.selectedDocumento.set(doc);
    this.showDocumentoDialog.set(true);
  }
  onDescargarDocumento(doc: ObraDocumento): void {
    // TODO
  }

  // --- Handlers for Incidencias Tab ---
  onReportarIncidencia(): void {
    this.selectedIncidencia.set(null);
    this.showIncidenciaDialog.set(true);
  }
  onVerBitacora(inc: ObraIncidencia): void {
    this.selectedIncidencia.set(inc);
    this.showIncidenciaDialog.set(true); // maybe different dialog later
  }
  onResolverIncidencia(inc: ObraIncidencia): void {
    this.selectedIncidencia.set(inc);
    this.showIncidenciaDialog.set(true);
  }
}
