import { Component, inject, signal, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncidenciasService } from './incidencias.service';
import { Incidencia } from './interfaces';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataTable } from '../../shared/interfaces';
declare var L: any; // Leaflet global JS library

@Component({
  selector: 'app-incidencias',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './incidencias.html'
})
export class IncidenciasComponent implements AfterViewChecked {
  private service = inject(IncidenciasService);

  columns: DataTable[] = [
    { label: 'ID ⇅' },
    { label: 'REGISTRADOR ⇅' },
    { label: 'DOC. IDENTIDAD ⇅' },
    { label: 'CARGO ⇅' },
    { label: 'SOLICITANTE ⇅' },
    { label: 'DOC. SOLICITANTE ⇅' },
    { label: 'TELÉFONO ⇅' },
    { label: 'DOMICILIO ⇅' },
    { label: 'FECHA ⇅' },
    { label: 'ORIGEN ⇅' },
    { label: 'DIRECCIÓN ⇅' },
    { label: 'ESTADO ⇅', align: 'center' },
    { label: 'ACCIONES', align: 'center' }
  ];
  incidencias = signal<Incidencia[]>([]);
  loading = signal<boolean>(false);

  // Leaflet Map References
  private leafletMap: any = null;
  private leafletMarker: any = null;
  private mapNeedsInit = false;

  // Modal State
  showFormModal = signal<boolean>(false);
  showDetailModal = signal<boolean>(false);
  editingId = signal<number | null>(null);
  selectedItem = signal<Incidencia | null>(null);

  filters = {
    fechaInicio: '',
    fechaFin: '',
    promotor: '',
    estado: '',
    solicitante: '',
    incidencia: '',
    representante: '',
  };

  formData: Incidencia = {
    promotor: '',
    docRegistrador: '',
    cargoRegistrador: '',
    solicitante: '',
    docSolicitante: '',
    telefonoSolicitante: '',
    domicilioSolicitante: '',
    fechaIncidencia: new Date().toISOString().substring(0, 10),
    horaIncidencia: '08:30',
    origenIncidencia: 'DIRECTO',
    viaOrigen: '',
    cuadra: '',
    urbanizacion: '',
    sectorVecinal: '',
    tipificacion: 'INCIDENCIA TÉCNICA',
    direccionExacta: '',
    incidencia: '',
    prioridadCategoria: 'NORMAL',
    latitud: '-12.09120000',
    longitud: '-76.95340000',
    gerenciaAsignada: '',
    representante: '',
    estado: 'PENDIENTE',
  };

  // Coordenadas reactivas: Leaflet las actualiza desde callbacks externos
  latitud = signal<string>('-12.09120000');
  longitud = signal<string>('-76.95340000');

  ngOnInit() {
    this.loadIncidencias();
  }

  ngAfterViewChecked() {
    if (this.showFormModal() && this.mapNeedsInit) {
      this.mapNeedsInit = false;
      setTimeout(() => this.initLeafletMap(), 150);
    }
  }

  // Interactive Leaflet Map with Green Draggable Pin Marker
  initLeafletMap() {
    const mapElement = document.getElementById('leaflet-map-container');
    if (!mapElement || typeof L === 'undefined') return;

    const lat = Number(this.latitud()) || -12.0912;
    const lng = Number(this.longitud()) || -76.9534;

    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }

    this.leafletMap = L.map('leaflet-map-container').setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.leafletMap);

    // Green pin marker matching screenshot
    const greenIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    this.leafletMarker = L.marker([lat, lng], {
      draggable: true,
      icon: greenIcon,
    }).addTo(this.leafletMap);

    this.leafletMarker.bindPopup('🟢 Arrastra para mover').openPopup();

    // Event when dragging green marker ends
    this.leafletMarker.on('dragend', () => {
      const pos = this.leafletMarker.getLatLng();
      this.latitud.set(pos.lat.toFixed(8));
      this.longitud.set(pos.lng.toFixed(8));
    });

    // Event when clicking anywhere on map
    this.leafletMap.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      this.leafletMarker.setLatLng([lat, lng]);
      this.latitud.set(lat.toFixed(8));
      this.longitud.set(lng.toFixed(8));
    });

    setTimeout(() => {
      this.leafletMap.invalidateSize();
    }, 200);
  }

  updateMarkerFromInputs() {
    const lat = Number(this.latitud());
    const lng = Number(this.longitud());

    if (!isNaN(lat) && !isNaN(lng) && this.leafletMarker && this.leafletMap) {
      this.leafletMarker.setLatLng([lat, lng]);
      this.leafletMap.panTo([lat, lng]);
    }
  }

  getCurrentLocation() {
    if (navigator.geolocation) {
      this.loading.set(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(8);
          const lng = position.coords.longitude.toFixed(8);
          this.latitud.set(lat);
          this.longitud.set(lng);

          if (this.leafletMarker && this.leafletMap) {
            this.leafletMarker.setLatLng([Number(lat), Number(lng)]);
            this.leafletMap.setView([Number(lat), Number(lng)], 16);
          }
          this.loading.set(false);
        },
        (error) => {
          this.loading.set(false);
          alert('No se pudo detectar la posición GPS: ' + error.message);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Tu navegador no soporta geolocalización GPS.');
    }
  }

  loadIncidencias() {
    this.loading.set(true);
    this.service.getAll(this.filters).subscribe({
      next: (data) => {
        this.incidencias.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
      },
    });
  }

  resetFilters() {
    this.filters = {
      fechaInicio: '',
      fechaFin: '',
      promotor: '',
      estado: '',
      solicitante: '',
      incidencia: '',
      representante: '',
    };
    this.loadIncidencias();
  }

  openCreateModal() {
    this.editingId.set(null);
    this.formData = {
      promotor: '',
      docRegistrador: '',
      cargoRegistrador: '',
      solicitante: '',
      docSolicitante: '',
      telefonoSolicitante: '',
      domicilioSolicitante: '',
      fechaIncidencia: new Date().toISOString().substring(0, 10),
      horaIncidencia: '08:30',
      origenIncidencia: 'DIRECTO',
      viaOrigen: '',
      cuadra: '',
      urbanizacion: '',
      sectorVecinal: '',
      tipificacion: 'INCIDENCIA TÉCNICA',
      direccionExacta: '',
      incidencia: '',
      prioridadCategoria: 'NORMAL',
      latitud: '-12.09120000',
      longitud: '-76.95340000',
      gerenciaAsignada: '',
      representante: '',
      estado: 'PENDIENTE',
    };
    this.latitud.set('-12.09120000');
    this.longitud.set('-76.95340000');
    this.showFormModal.set(true);
    this.mapNeedsInit = true;
  }

  openEditModal(item: Incidencia) {
    this.editingId.set(item.id!);
    this.formData = { ...item };
    this.latitud.set(item.latitud ?? '');
    this.longitud.set(item.longitud ?? '');
    this.showFormModal.set(true);
    this.mapNeedsInit = true;
  }

  openDetailModal(item: Incidencia) {
    this.selectedItem.set(item);
    this.showDetailModal.set(true);
  }

  saveIncidencia() {
    if (!this.formData.solicitante || !this.formData.incidencia) {
      alert('Por favor complete los campos obligatorios (*).');
      return;
    }

    this.formData.latitud = this.latitud();
    this.formData.longitud = this.longitud();

    const editId = this.editingId();
    if (editId) {
      this.service.update(editId!, this.formData).subscribe({
        next: () => { this.closeModals(); this.loadIncidencias(); },
        error: (err) => alert('Error al actualizar: ' + err.error?.message),
      });
    } else {
      this.service.create(this.formData).subscribe({
        next: () => { this.closeModals(); this.loadIncidencias(); },
        error: (err) => alert('Error al crear: ' + err.error?.message),
      });
    }
  }

  duplicateIncidencia(id: number) {
    if (confirm('¿Deseas duplicar esta ficha de caso?')) {
      this.service.duplicate(id).subscribe({
        next: () => this.loadIncidencias(),
        error: (err) => alert('Error al duplicar: ' + err.error?.message),
      });
    }
  }

  deleteIncidencia(id: number) {
    if (confirm(`¿Eliminar la incidencia #${id}?`)) {
      this.service.delete(id).subscribe({
        next: () => this.loadIncidencias(),
        error: (err) => alert('Error al eliminar: ' + err.error?.message),
      });
    }
  }

  exportExcel() {
    this.service.exportExcel(this.filters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Registro_Casos_GLD_${new Date().toISOString().substring(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Error al exportar:', err),
    });
  }

  closeModals() {
    this.showFormModal.set(false);
    this.showDetailModal.set(false);
    this.editingId.set(null);
    this.selectedItem.set(null);
  }
}
