import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ObraService } from './obra.service';
import { ObraCockpit } from './obra.interface';

export interface PlanoVisor {
  codigo: string;
  nombre: string;
  version: string;
  disciplina: string;
  escala: string;
  formatoPeso: string;
  cc: string;
  voboFecha: string;
  proyectista: string;
  cap: string;
  firmaDigital: string;
  notas: string;
}

export interface PlanoHistorialItem {
  version: string;
  estado: string;
  peso: string;
  fecha: string;
  descripcion: string;
  proyectista: string;
  actual: boolean;
}

export interface FotoEvidencia {
  id: number;
  titulo: string;
  categoria: string;
  fecha: string;
  tag: string;
  fotoUrl: string;
  descripcion: string;
  frente: string;
  plano: string;
  registradoPor: string;
  ssoma: string;
  coords: string;
  conforme: boolean;
}

export interface SemanaEditable {
  identificador: string;
  fase: string;
  fechaInicio: string;
  fechaFin: string;
  nombre: string;
  responsable: string;
  estado: string;
  meta: number;
  avanceReal: number;
  descripcion: string;
}

@Component({
  selector: 'app-obra-cockpit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './obra-cockpit.html',
  styleUrl: './obra-cockpit.css',
})
export class ObraCockpitComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private obraService = inject(ObraService);

  // Estados reactivos (Signals)
  idCentroCosto = signal<number>(0);
  loading = signal<boolean>(false);
  cockpit = signal<ObraCockpit | null>(null);

  // Tab activo: 'tab-cronograma' | 'tab-directorio' | 'tab-planos' | 'tab-documentos' | 'tab-incidencias'
  activeTab = signal<string>('tab-cronograma');
  exportMenuOpen = signal<boolean>(false);

  // ─── MODAL 4: SUBIR NUEVO PLANO DE OBRA (CAD/BIM/PDF) ───────────────────
  modalSubirPlanoVisible = signal<boolean>(false);
  nuevoPlano = {
    archivoNombre: '',
    archivoPeso: '',
    codigo: '',
    nombre: '',
    especialidad: 'Arquitectura (ARQ)',
    version: 'v1.0',
    versionAnterior: '',
    estadoAprobacion: 'En Revisión Técnica',
    fechaVobo: '',
    proyectista: '',
    reemplazarArchivar: false,
    notificarWhatsapp: true,
  };

  // ─── MODAL 5: VISOR TÉCNICO CAD 2D ─────────────────────────────────────
  modalVisorCadVisible = signal<boolean>(false);
  planoVisorActivo: PlanoVisor = {
    codigo: '',
    nombre: '',
    version: '',
    disciplina: '',
    escala: '',
    formatoPeso: '',
    cc: '',
    voboFecha: '',
    proyectista: '',
    cap: '',
    firmaDigital: '',
    notas: '',
  };
  cadCapas = {
    muros: true,
    cotas: true,
    gondolas: true,
    electricas: true,
  };
  cadZoom = signal<number>(100);

  // ─── MODAL 9: BITÁCORA DIGITAL & ASIENTO TÉCNICO ─────────────────────
  modalBitacoraVisible = signal<boolean>(false);
  asientoBitacoraActivo = {
    numero: 1,
    folio: '',
    fechaHora: '',
    autor: '',
    autorCargo: '',
    supervisor: '',
    supervisorCargo: '',
    hitoFrente: '',
    climaJornada: '',
    anotacion: '',
    acuerdos: [] as { titulo: string; detalle: string }[],
    sha256: '',
    fotos: [
      {
        titulo: 'Alineamiento Parantes 89mm',
        tag: 'Aprobado SSOMA',
        badge: 'Aprobado',
        badgeClass: 'bg-emerald-600 text-white',
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCFdGLCvTBVqL9nG7XznPsUAx7TmKoLvOnwntttD54Qf4X0rGyYgWH91dqTLoV-U2jRYmj5jtMq0-BLJz2kLyITZe3a3lu3JxHQc2petuRTm8z-E0atW7zxUElQRVQbNUVtYqr6x4HLBZQWsxVCttDbo0FxGTRIMA2p0FsZtn8dO8bDEzbmWsra2A4mnO1iJd-KdzfoKtJ-2S-XN4o4V9opRuREvRaX06Imkg1a6PO_diWrYfHnXW3ToQ',
      },
      {
        titulo: 'Tendido Conduit Empotrado',
        tag: 'Coordinado ELEC-02',
        badge: 'IEE Ok',
        badgeClass: 'bg-amber-800 text-white',
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJ7r2P5V1Y6TksU6cW_7YvY2jXyH-a94f_1wX1lX5w6a4d3f2e1c0b9a8f7e6d5c4b3a2f1e0d',
      },
    ],
  };

  // ─── MODAL 10: REPORTAR NUEVA INCIDENCIA EN OBRA ──────────────────────
  modalReportarIncidenciaVisible = signal<boolean>(false);
  nuevaIncidencia = {
    prioridad: 'Alta Prioridad (Bloqueo Crítico - Res. 24h)',
    especialidad: 'Climatización HVAC (Ductos & Equipos)',
    frente: 'Frente A — Línea de Cajas y Zona Comercial',
    titulo: '',
    descripcion: '',
    responsable: 'Ing. Marcos Quispe (Instalaciones)',
    plazo: '24 Horas',
    notificarWhatsapp: true,
    vincularCuaderno: true,
  };

  // ─── MODAL 7: ANEXAR DOCUMENTO TÉCNICO / ACTA ────────────────────────
  modalAnexarDocVisible = signal<boolean>(false);
  nuevoDocumento = {
    archivoNombre: '',
    archivoPeso: '',
    categoria: 'Actas de Entrega y Recepción (Legal / Obra)',
    folio: '',
    titulo: '',
    entidadEmisora: '',
    fechaEmision: '',
    vigencia: 'Permanente / Validez Contractual',
    responsableGld: '',
    hitoSemana: '',
    sincronizarTablets: true,
    notificarWhatsapp: true,
    incluirDossier: true,
  };

  // ─── MODAL 8: DETALLE DOCUMENTO TÉCNICO & ACTA CONTRACTUAL ──────────────
  modalDetalleDocVisible = signal<boolean>(false);
  documentoDetalleActivo = {
    folio: '',
    expediente: '',
    titulo: '',
    categoria: '',
    folioCompleto: '',
    fechaEmision: '',
    vigencia: '',
    entidadesFirmantes: '',
    responsableGld: '',
    hitoVinculado: '',
    archivoNombre: '',
    archivoPeso: '',
    sha256: '',
  };

  // ─── MODAL 6: HISTORIAL DE VERSIONES ───────────────────────────────────
  modalHistorialPlanosVisible = signal<boolean>(false);
  historialPlanos: PlanoHistorialItem[] = [
    {
      version: 'v2.2 (Actual)',
      estado: 'Aprobado para Construcción',
      peso: 'DWG & PDF (14.8 MB)',
      fecha: '10/02/2026 • 14:15 hrs',
      descripcion: 'Ampliación de pasillo central y reubicación técnica de Tablero TG',
      proyectista: 'Arq. Lucía Fernández R.',
      actual: true,
    },
    {
      version: 'v2.1 (Archivado)',
      estado: 'Observado con Cambios',
      peso: 'DWG & PDF (14.2 MB)',
      fecha: '02/02/2026 • 09:30 hrs',
      descripcion: 'Observación de INDECI por ancho de pasillo menor a 1.20m (estaba en 1.05m) y cambio de posición de tablero eléctrico.',
      proyectista: 'Arq. Lucía Fernández R.',
      actual: false,
    },
    {
      version: 'v2.0 (Inicial)',
      estado: 'Aprobado Preliminar',
      peso: 'DWG (12.8 MB)',
      fecha: '15/01/2026 • 11:00 hrs',
      descripcion: 'Entrega inicial de arquitectura según layout Tambo estándar 2026.',
      proyectista: 'Arq. Lucía Fernández R.',
      actual: false,
    },
  ];

  // ─── MODAL 1: PROGRAMAR NUEVA SEMANA / HITO ─────────────────────────────
  modalNuevaSemanaVisible = signal<boolean>(false);
  nuevaSemana = {
    correlativo: '',
    fechaInicio: '',
    fechaFin: '',
    fasePrincipal: '',
    metaPonderada: 0,
    nombreHito: '',
    responsable: '',
    detalleActividades: '',
  };

  // ─── MODAL 2: VISOR DE EVIDENCIAS FOTOGRÁFICAS ──────────────────────────
  modalEvidenciasVisible = signal<boolean>(false);
  evidenciaSemanaTitulo = signal<string>('SEM 02: Estructuración Metálica & Muros Drywall');
  filtroEvidenciaCategoria = signal<string>('Todas');

  todasFotos: FotoEvidencia[] = [
    {
      id: 1,
      titulo: 'Estructura Parantes',
      categoria: 'Estructura Metálica',
      fecha: '28 Sep • 16:30',
      tag: 'FOTO-VES-SEM02-04 • 28/09/2026 16:30',
      fotoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCFdGLCvTBVqL9nG7XznPsUAx7TmKoLvOnwntttD54Qf4X0rGyYgWH91dqTLoV-U2jRYmj5jtMq0-BLJz2kLyITZe3a3lu3JxHQc2petuRTm8z-E0atW7zxUElQRVQbNUVtYqr6x4HLBZQWsxVCttDbo0FxGTRIMA2p0FsZtn8dO8bDEzbmWsra2A4mnO1iJd-KdzfoKtJ-2S-XN4o4V9opRuREvRaX06Imkg1a6PO_diWrYfHnXW3ToQ',
      descripcion: 'Inspección visual de modulación cada 0.407m conforme a especificación técnica antisísmica. Refuerzos de madera colocados para anclaje de mobiliario en caja de cobro.',
      frente: 'Frente A — Línea de Cajas y Góndolas',
      plano: 'ARQ-01 v2.1',
      registradoPor: 'Arq. Lucía Fernández R.',
      ssoma: 'Ing. Carlos Mendoza (OK)',
      coords: 'S 12°12\'44" W 76°56\'02"',
      conforme: true,
    },
    {
      id: 2,
      titulo: 'Tendido Tubos Conduit',
      categoria: 'Estructura Metálica',
      fecha: '27 Sep • 11:15',
      tag: 'FOTO-VES-SEM02-03 • 27/09/2026 11:15',
      fotoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnvBZ0vtIoaMLoWuXNJeGjCO6Y2okfr8rBX-Wv_lT6TZkX-6fD-S6UnxlfRFRU5OnnWpzEmucLAEDFQ1Qj8H1DFTokIpOHddtGdVcIRNMjhAmX1qYM5J2_KKviCInxtEuS9CNKM-g76c7Pt1BdACpywKXQ4Xxsewp5LsgHRlqfMIAF_QCZ4nmxHadU0K20TjfoQ4T_XGqv9irPIfhwgOiqbWkgVaVFgWJUjBTkKTFtI5leQn4yzUP6ug',
      descripcion: 'Canalizaciones conduit pesadas empotradas en tabiquería para alimentadores de fuerza y cómputo.',
      frente: 'Frente B — Cuarto de Tableros',
      plano: 'ELEC-02 v1.3',
      registradoPor: 'Ing. Marcos Quispe T.',
      ssoma: 'Ing. Carlos Mendoza (OK)',
      coords: 'S 12°12\'45" W 76°56\'03"',
      conforme: true,
    },
    {
      id: 3,
      titulo: 'Inspección de EPP',
      categoria: 'Seguridad SSOMA',
      fecha: '26 Sep • 08:30',
      tag: 'FOTO-VES-SEM02-02 • 26/09/2026 08:30',
      fotoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDoiMOoFE6T6gI-AnwP6OMf2wl7mt52zO129bfXAe2S8oBSJ9I5TZmDXzRBadxJt2NjceTMe5fuaTrnNiOc4NFhEqtb-sWThkuVizprj7drnSPZiAfIeAv71PFHB97g4T4TAUKTuE2wcloCFLeIAGsRPNPCxfHJUDjg-5YFtON1Y0EuMA-raZFvP720GbjAKDsa-PPFZXznTgjNcC1t0bkTWcEl2t59EiLKtwGHF2tIbKgCX9wptSVnBg',
      descripcion: 'Verificación de charla de 5 minutos e inspección de arneses y barbiquejos para trabajos en altura.',
      frente: 'Frente General',
      plano: 'SSOMA-REG-4509',
      registradoPor: 'Bach. Diego Salazar',
      ssoma: 'Aprobado SSOMA',
      coords: 'S 12°12\'44" W 76°56\'01"',
      conforme: true,
    },
    {
      id: 4,
      titulo: 'Recepción Placas RH',
      categoria: 'Placas Yeso / RH',
      fecha: '25 Sep • 14:20',
      tag: 'FOTO-VES-SEM02-01 • 25/09/2026 14:20',
      fotoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBD5IjAGTP5daZ8FqTyMoHFpRt9c2TcGMCTvlQIY_Im8rRrdcE4Ov9cgGX50Dt93wAkMrgOOlc6jFU9KFJy5M_GlVgq_0iV0BV3ksIe7alRhtTwujSEvXmvUCnkcwYaI8cbPnUJCYRhLIdp1bfMqMope73pPcM8j8ntYwgAcRfa1BwqEMLXJugTW2BXt4qqrZwJaZpS9DqBJ9LK5QsIOPKggUu3EvA3ln5cVzbnmIV1mm8okWnWcFa53g',
      descripcion: 'Descarga y acopio bajo techo de 120 planchas de yeso cartón resistente a la humedad (RH 1/2).',
      frente: 'Zona de Almacén Seco',
      plano: 'ARQ-01 v2.1',
      registradoPor: 'Arq. Lucía Fernández R.',
      ssoma: 'Ing. Carlos Mendoza (OK)',
      coords: 'S 12°12\'43" W 76°56\'02"',
      conforme: true,
    },
    {
      id: 5,
      titulo: 'Emplacado Yeso ST',
      categoria: 'Placas Yeso / RH',
      fecha: '29 Sep • 17:10',
      tag: 'FOTO-VES-SEM02-05 • 29/09/2026 17:10',
      fotoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCFdGLCvTBVqL9nG7XznPsUAx7TmKoLvOnwntttD54Qf4X0rGyYgWH91dqTLoV-U2jRYmj5jtMq0-BLJz2kLyITZe3a3lu3JxHQc2petuRTm8z-E0atW7zxUElQRVQbNUVtYqr6x4HLBZQWsxVCttDbo0FxGTRIMA2p0FsZtn8dO8bDEzbmWsra2A4mnO1iJd-KdzfoKtJ-2S-XN4o4V9opRuREvRaX06Imkg1a6PO_diWrYfHnXW3ToQ',
      descripcion: 'Fijación de placas ST con tornillos autorroscantes cada 25cm. Verificación de plomos en esquinas.',
      frente: 'Frente C — Pasillo Central',
      plano: 'ARQ-01 v2.1',
      registradoPor: 'Arq. Lucía Fernández R.',
      ssoma: 'Ing. Carlos Mendoza (OK)',
      coords: 'S 12°12\'44" W 76°56\'02"',
      conforme: true,
    },
    {
      id: 6,
      titulo: 'Cierre y Masillado',
      categoria: 'Placas Yeso / RH',
      fecha: '01 Oct • 12:00',
      tag: 'FOTO-VES-SEM02-06 • 01/10/2026 12:00',
      fotoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnvBZ0vtIoaMLoWuXNJeGjCO6Y2okfr8rBX-Wv_lT6TZkX-6fD-S6UnxlfRFRU5OnnWpzEmucLAEDFQ1Qj8H1DFTokIpOHddtGdVcIRNMjhAmX1qYM5J2_KKviCInxtEuS9CNKM-g76c7Pt1BdACpywKXQ4Xxsewp5LsgHRlqfMIAF_QCZ4nmxHadU0K20TjfoQ4T_XGqv9irPIfhwgOiqbWkgVaVFgWJUjBTkKTFtI5leQn4yzUP6ug',
      descripcion: 'Primera mano de masilla en juntas con cinta de papel microperforada. Secado adecuado sin fisuras.',
      frente: 'Frente A y B',
      plano: 'ARQ-01 v2.1',
      registradoPor: 'Arq. Lucía Fernández R.',
      ssoma: 'Ing. Carlos Mendoza (OK)',
      coords: 'S 12°12\'44" W 76°56\'02"',
      conforme: true,
    },
  ];

  fotoActiva = signal<FotoEvidencia>(this.todasFotos[0]);

  // ─── MODAL 3: EDITAR PROGRAMACIÓN DE SEMANA / HITO ─────────────────────
  modalEditarSemanaVisible = signal<boolean>(false);
  semanaEnEdicion: SemanaEditable = {
    identificador: '# SEM 02',
    fase: 'Fase 2: Estructuración Metálica & Muros Drywall',
    fechaInicio: '2026-09-25',
    fechaFin: '2026-10-01',
    nombre: 'Estructuración Metálica & Muros Drywall',
    responsable: 'Arq. Lucía Fernández R. (CAP: 9821 - Drywall & Acabados)',
    estado: 'Concluido',
    meta: 100.0,
    avanceReal: 100.0,
    descripcion: 'Tendido de tuberías conduit empotradas, modulación de parantes 89mm cada 0.407m y refuerzos antisísmicos conforme a plano ARQ-01.',
  };

  // Filtros
  searchPlanosText = signal<string>('');
  filtroDisciplina = signal<string>('Todas las Disciplinas');

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
    this.obraService.getCockpit(id).subscribe({
      next: (data) => {
        this.cockpit.set(data);
      },
      error: (err) => {
        console.warn('Cargando con datos de referencia visuales:', err);
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

  cerrarModales(): void {
    this.modalNuevaSemanaVisible.set(false);
    this.modalEvidenciasVisible.set(false);
    this.modalEditarSemanaVisible.set(false);
    this.modalSubirPlanoVisible.set(false);
    this.modalVisorCadVisible.set(false);
    this.modalHistorialPlanosVisible.set(false);
    this.modalAnexarDocVisible.set(false);
    this.modalDetalleDocVisible.set(false);
    this.modalBitacoraVisible.set(false);
    this.modalReportarIncidenciaVisible.set(false);
  }

  // Métodos Modal 1
  abrirModalNuevaSemana(): void {
    this.modalNuevaSemanaVisible.set(true);
  }

  guardarNuevaSemana(): void {
    alert('✅ Semana ' + this.nuevaSemana.correlativo + ' programada exitosamente e integrada a la Curva S.');
    this.modalNuevaSemanaVisible.set(false);
  }

  // Métodos Modal 2
  viewEvidence(sem: string): void {
    this.evidenciaSemanaTitulo.set(sem.includes('02') ? 'SEM 02: Estructuración Metálica & Muros Drywall' : sem + ': Obras Provisionales y Demolición Parcial');
    this.fotoActiva.set(this.todasFotos[0]);
    this.modalEvidenciasVisible.set(true);
  }

  seleccionarFoto(foto: FotoEvidencia): void {
    this.fotoActiva.set(foto);
  }

  filtrarFotosPorCategoria(cat: string): void {
    this.filtroEvidenciaCategoria.set(cat);
  }

  get fotosFiltradas(): FotoEvidencia[] {
    const f = this.filtroEvidenciaCategoria();
    if (f === 'Todas') return this.todasFotos;
    return this.todasFotos.filter(foto => foto.categoria === f);
  }

  marcarConforme(): void {
    const f = this.fotoActiva();
    alert('✅ Inspección validada como Conforme con sello digital.');
  }

  exportarReportePdf(): void {
    alert('📄 Generando Reporte Fotográfico Oficial en PDF con firmas...');
  }

  // Métodos Modal 3
  editCronogramaRow(sem: string): void {
    if (sem.includes('01')) {
      this.semanaEnEdicion = {
        identificador: '# SEM 01',
        fase: 'Fase 1: Obras Provisionales y Demolición Parcial',
        fechaInicio: '2026-09-18',
        fechaFin: '2026-09-24',
        nombre: 'Obras Provisionales y Demolición Parcial',
        responsable: 'Ing. Carlos Mendoza P. (Jefe de Obra)',
        estado: 'Concluido',
        meta: 100.0,
        avanceReal: 100.0,
        descripcion: 'Retiro de piso existente, canalizaciones maestras y cerco perimétrico de lona conforme a plan de demolición.',
      };
    } else if (sem.includes('03')) {
      this.semanaEnEdicion = {
        identificador: '# SEM 03',
        fase: 'Fase 3: Instalaciones Sanitarias, Eléctricas TG y Climatización',
        fechaInicio: '2026-10-02',
        fechaFin: '2026-10-08',
        nombre: 'Instalaciones Sanitarias, Eléctricas TG y Climatización',
        responsable: 'Ing. Marcos Quispe T. (Residente IIEE / IISS)',
        estado: 'En Plazo',
        meta: 60.0,
        avanceReal: 65.0,
        descripcion: 'Pruebas hidráulicas, pase de cable libre de halógeno y montaje de ductería para equipos de climatización HVAC.',
      };
    } else {
      this.semanaEnEdicion = {
        identificador: '# SEM 02',
        fase: 'Fase 2: Estructuración Metálica & Muros Drywall',
        fechaInicio: '2026-09-25',
        fechaFin: '2026-10-01',
        nombre: 'Estructuración Metálica & Muros Drywall',
        responsable: 'Arq. Lucía Fernández R. (CAP: 9821 - Drywall & Acabados)',
        estado: 'Concluido',
        meta: 100.0,
        avanceReal: 100.0,
        descripcion: 'Tendido de tuberías conduit empotradas, modulación de parantes 89mm cada 0.407m y refuerzos antisísmicos conforme a plano ARQ-01.',
      };
    }
    this.modalEditarSemanaVisible.set(true);
  }

  guardarEdicionSemana(): void {
    alert('✅ Programación de ' + this.semanaEnEdicion.identificador + ' actualizada al ' + this.semanaEnEdicion.avanceReal + '%. Curva S recalculada.');
    this.modalEditarSemanaVisible.set(false);
  }

  openModal(modalId: string): void {
    if (modalId === 'modal-semana') {
      this.abrirModalNuevaSemana();
    } else if (modalId === 'modal-plano') {
      this.abrirModalSubirPlano();
    } else if (modalId === 'modal-documento') {
      this.abrirModalAnexarDoc();
    } else if (modalId === 'modal-incidencia') {
      this.abrirModalNuevaIncidencia();
    } else if (modalId === 'modal-bitacora') {
      this.verAsientoBitacora(14);
    } else {
      alert('Modal: ' + modalId);
    }
  }

  verAsientoBitacora(num?: number): void {
    this.cerrarModales();
    if (num) {
      this.asientoBitacoraActivo.numero = num;
    }
    this.modalBitacoraVisible.set(true);
  }

  abrirModalNuevaIncidencia(): void {
    this.cerrarModales();
    this.modalReportarIncidenciaVisible.set(true);
  }

  guardarNuevaIncidencia(): void {
    alert(`🚨 Incidencia "${this.nuevaIncidencia.titulo}" reportada con éxito y notificada al equipo de obra.`);
    this.modalReportarIncidenciaVisible.set(false);
  }

  abrirModalAnexarDoc(): void {
    this.cerrarModales();
    this.modalAnexarDocVisible.set(true);
  }

  guardarNuevoDocumento(): void {
    alert(`✅ Documento ${this.nuevoDocumento.folio} anexado y encriptado en el repositorio técnico oficial.`);
    this.modalAnexarDocVisible.set(false);
  }

  verDetalleDocumento(folio?: string): void {
    this.cerrarModales();
    if (folio) {
      this.documentoDetalleActivo.folio = folio;
    }
    this.modalDetalleDocVisible.set(true);
  }

  abrirModalSubirPlano(): void {
    this.cerrarModales();
    this.modalSubirPlanoVisible.set(true);
  }

  guardarNuevoPlano(): void {
    alert(`✅ Plano ${this.nuevoPlano.codigo} (${this.nuevoPlano.version}) registrado y sincronizado en el repositorio técnico.`);
    this.modalSubirPlanoVisible.set(false);
  }

  abrirHistorialDesdeVisor(): void {
    this.modalVisorCadVisible.set(false);
    this.modalHistorialPlanosVisible.set(true);
  }

  abrirVisorDesdeHistorial(version?: string): void {
    this.modalHistorialPlanosVisible.set(false);
    this.modalVisorCadVisible.set(true);
  }

  abrirSubirDesdeVisor(): void {
    this.modalVisorCadVisible.set(false);
    this.modalSubirPlanoVisible.set(true);
  }

  zoomInCad(): void {
    this.cadZoom.update(z => Math.min(z + 15, 200));
  }

  zoomOutCad(): void {
    this.cadZoom.update(z => Math.max(z - 15, 50));
  }

  resetZoomCad(): void {
    this.cadZoom.set(100);
  }

  toggleCapa(capa: 'muros' | 'cotas' | 'gondolas' | 'electricas'): void {
    this.cadCapas[capa] = !this.cadCapas[capa];
  }

  editResidente(nombre: string): void {
    alert('Ficha técnica de residente: ' + nombre);
  }

  previewPlano(cod: string, name?: string): void {
    this.cerrarModales();
    this.planoVisorActivo = {
      codigo: cod || 'ARQ-02',
      nombre: name || (cod === 'ARQ-02' ? 'Distribución Arquitectónica General & Circulaciones' : 'Plano de Especialidad ' + cod),
      version: cod === 'ARQ-01' ? 'v2.1 (Aprobado Obra)' : 'v2.2 (Aprobado Obra)',
      disciplina: cod.startsWith('ARQ') ? 'ARQ' : cod.startsWith('ELEC') ? 'ELEC' : 'ING',
      escala: 'Escala 1:50',
      formatoPeso: 'DWG / PDF Vectorial (14.8 MB)',
      cc: 'CC-948: Tambo Villa El Salvador',
      voboFecha: '10/02/2026',
      proyectista: 'Arq. Lucía Fernández R.',
      cap: '9821',
      firmaDigital: 'Firma Digital GLD • 10/02/2026 14:15',
      notas: 'Ampliación de pasillo central a 1.20m por norma técnica de evacuación comercial INDECI y reubicación de tablero TG.',
    };
    this.cadZoom.set(100);
    this.modalVisorCadVisible.set(true);
  }

  downloadPlano(filename: string): void {
    alert('📥 Descargando archivo técnico: ' + filename);
  }

  openReplaceModal(cod: string): void {
    this.cerrarModales();
    this.modalHistorialPlanosVisible.set(true);
  }

  showAlert(msg: string): void {
    this.editCronogramaRow('SEM-03');
  }

  onSearchPlanos(event: Event): void {
    const input = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchPlanosText.set(input);
    const rows = document.querySelectorAll('#planosTable tbody tr');
    rows.forEach((r) => {
      const el = r as HTMLElement;
      el.style.display = el.innerText.toLowerCase().includes(input) ? '' : 'none';
    });
  }

  onDisciplinaChange(event: Event): void {
    const select = (event.target as HTMLSelectElement).value;
    this.filtroDisciplina.set(select);
    const rows = document.querySelectorAll('#planosTable tbody tr');
    rows.forEach((r) => {
      const el = r as HTMLElement;
      if (select === 'Todas las Disciplinas') {
        el.style.display = '';
      } else {
        el.style.display = el.innerText.toLowerCase().includes(select.toLowerCase()) ? '' : 'none';
      }
    });
  }
}
