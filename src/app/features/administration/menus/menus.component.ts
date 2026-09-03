import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface SubMenu {
  MenuId: string;
  TipoSubMenu?: string;
  SubMenuNombre: string;
  SubMenuVista?: string;
  Imagen?: string;
}

interface MenuRoot {
  MenuId: string;
  MenuNombre: string;
  Imagen?: string;
  submenus: SubMenu[];
}

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="content-header">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="background: #10b981; color: white; width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
          <i class="fa-solid fa-list-check"></i>
        </div>
        <div>
          <h1 class="content-title" style="margin: 0;">Estructura de Menús</h1>
          <p class="content-subtitle" style="margin: 0;">Administrar orden y jerarquía del menú (arrastra ⣿ para reordenar)</p>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary" (click)="loadTree()" [disabled]="loading">
          <i class="fa-solid fa-arrows-rotate" [class.fa-spin]="loading"></i> {{ loading ? 'Actualizando...' : 'Actualizar' }}
        </button>
        <button class="btn btn-primary" style="background: #059669; border-color: #059669;" (click)="openRootModal()">
          <i class="fa-solid fa-plus"></i> + Menú raíz
        </button>
      </div>
    </div>

    <div class="content-body">
      <div class="menu-tree-container">
        <!-- Loop Root Menus -->
        <div class="menu-root-card"
          *ngFor="let root of treeData; let idx = index"
          [class.dragging]="draggedRootIdx === idx"
          draggable="true"
          (dragstart)="onRootDragStart(idx, $event)"
          (dragover)="onDragOver($event)"
          (drop)="onRootDrop(idx)">
          
          <div class="menu-root-header">
            <div class="menu-root-info">
              <span class="menu-drag-handle" title="Mantén presionado para arrastrar y cambiar orden">
                <i class="fa-solid fa-grip-vertical"></i>
              </span>
              <div>
                <div class="menu-root-title">
                  {{ root.MenuNombre }}
                  <span class="menu-id-badge">#{{ root.MenuId }}</span>
                </div>
                <div class="menu-root-subtitle">
                  Sin ruta (carpeta) · orden {{ idx + 1 }} · {{ root.Imagen || 'Folder' }}
                </div>
              </div>
            </div>
            <div class="menu-actions">
              <button class="btn-icon-action primary" (click)="openSubModal(root.MenuId)" title="Agregar Submenú">
                <i class="fa-solid fa-plus"></i>
              </button>
              <button class="btn-icon-action" (click)="editRootModal(root)" title="Editar Menú Raíz">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn-icon-action danger" (click)="deleteRootMenu(root.MenuId)" title="Eliminar Menú Raíz">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- Nested Submenus List -->
          <div class="submenu-list" *ngIf="root.submenus && root.submenus.length > 0">
            <div class="submenu-card"
              *ngFor="let sub of root.submenus; let sIdx = index"
              [class.dragging]="draggedSub?.rootIdx === idx && draggedSub?.subIdx === sIdx"
              draggable="true"
              (dragstart)="onSubDragStart(idx, sIdx, $event)"
              (dragover)="onDragOver($event)"
              (drop)="onSubDrop(idx, sIdx)">
              
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span class="menu-drag-handle" style="font-size: 0.85rem;" title="Arrastrar submenú">
                  <i class="fa-solid fa-grip-vertical"></i>
                </span>
                <div>
                  <div style="font-weight: 600; font-size: 0.875rem; color: #1e293b;">
                    {{ sub.SubMenuNombre }}
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">
                    {{ sub.SubMenuVista || '/' }} · orden {{ sIdx + 1 }} · {{ sub.Imagen || 'File' }}
                  </div>
                </div>
              </div>
              <div class="menu-actions">
                <button class="btn-icon-action" (click)="editSubModal(sub)" title="Editar Submenú">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-icon-action danger" (click)="deleteSubMenu(sub.MenuId, sub.SubMenuNombre)" title="Eliminar Submenú">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="treeData.length === 0 && !loading" style="text-align: center; padding: 3rem; background: white; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 0.5rem; display: block;"></i>
          No hay menús registrados. Haz clic en <strong>+ Menú raíz</strong> para empezar.
        </div>
      </div>
    </div>

    <!-- Modal Menú Raíz -->
    <div class="modal-overlay" *ngIf="showRootModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingRootId ? 'Editar Menú Raíz' : 'Nuevo Menú Raíz' }}</h3>
          <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem;" (click)="closeModals()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>ID Menú Raíz *</label>
            <input type="text" class="form-control" [(ngModel)]="rootForm.MenuId"
              placeholder="Ej. MNU001" [disabled]="!!editingRootId"
              [style.background]="editingRootId ? '#f1f5f9' : ''">
          </div>
          <div class="form-group">
            <label>Nombre del Menú Raíz *</label>
            <input type="text" class="form-control" [(ngModel)]="rootForm.MenuNombre" placeholder="Ej. Participación Vecinal">
          </div>
          <div class="form-group">
            <label>Icono (FontAwesome)</label>
            <input type="text" class="form-control" [(ngModel)]="rootForm.Imagen" placeholder="Ej. Users">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
          <button class="btn btn-primary" (click)="saveRootMenu()">Guardar Menú Raíz</button>
        </div>
      </div>
    </div>

    <!-- Modal Submenú -->
    <div class="modal-overlay" *ngIf="showSubModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingSubNombre ? 'Editar Submenú' : 'Nuevo Submenú' }}</h3>
          <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem;" (click)="closeModals()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Menú Padre (ID)</label>
            <input type="text" class="form-control" [value]="subForm.MenuId" disabled style="background: #f1f5f9;">
          </div>
          <div class="form-group">
            <label>Nombre del Submenú *</label>
            <input type="text" class="form-control" [(ngModel)]="subForm.SubMenuNombre" placeholder="Ej. Registro de Incidencias">
          </div>
          <div class="form-group">
            <label>Ruta / Vista (URL)</label>
            <input type="text" class="form-control" [(ngModel)]="subForm.SubMenuVista" placeholder="Ej. /participacion_vecinal/registro_incidencias">
          </div>
          <div class="form-group">
            <label>Icono (FontAwesome)</label>
            <input type="text" class="form-control" [(ngModel)]="subForm.Imagen" placeholder="Ej. ClipboardList">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
          <button class="btn btn-primary" (click)="saveSubMenu()">Guardar Submenú</button>
        </div>
      </div>
    </div>
  `
})
export class MenusComponent implements OnInit {
  treeData: MenuRoot[] = [];
  loading = false;

  // Drag & drop state
  draggedRootIdx: number | null = null;
  draggedSub: { rootIdx: number; subIdx: number } | null = null;

  // Root Modal State
  showRootModal = false;
  editingRootId: string | null = null;
  rootForm = { MenuId: '', MenuNombre: '', Imagen: '' };

  // SubModal State
  showSubModal = false;
  editingSubNombre: string | null = null;
  subForm: SubMenu = { MenuId: '', SubMenuNombre: '', SubMenuVista: '', Imagen: '' };

  private apiUrl = 'http://localhost:3000/administration/menus';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadTree();
  }

  loadTree() {
    this.loading = true;
    this.http.get<MenuRoot[]>(`${this.apiUrl}/tree`).subscribe({
      next: (data) => {
        this.treeData = data;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      },
    });
  }

  // Drag and Drop Logic
  onRootDragStart(idx: number, event: DragEvent) {
    this.draggedRootIdx = idx;
    this.draggedSub = null;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onRootDrop(targetIdx: number) {
    if (this.draggedRootIdx !== null && this.draggedRootIdx !== targetIdx) {
      const movedItem = this.treeData.splice(this.draggedRootIdx, 1)[0];
      this.treeData.splice(targetIdx, 0, movedItem);
    }
    this.draggedRootIdx = null;
  }

  onSubDragStart(rootIdx: number, subIdx: number, event: DragEvent) {
    event.stopPropagation();
    this.draggedSub = { rootIdx, subIdx };
    this.draggedRootIdx = null;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onSubDrop(rootIdx: number, targetSubIdx: number) {
    if (this.draggedSub && this.draggedSub.rootIdx === rootIdx && this.draggedSub.subIdx !== targetSubIdx) {
      const subList = this.treeData[rootIdx].submenus;
      const movedSub = subList.splice(this.draggedSub.subIdx, 1)[0];
      subList.splice(targetSubIdx, 0, movedSub);
    }
    this.draggedSub = null;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  // Root Menu Actions
  openRootModal() {
    this.editingRootId = null;
    this.rootForm = { MenuId: '', MenuNombre: '', Imagen: 'Users' };
    this.showRootModal = true;
  }

  editRootModal(root: MenuRoot) {
    this.editingRootId = root.MenuId;
    this.rootForm = { MenuId: root.MenuId, MenuNombre: root.MenuNombre, Imagen: root.Imagen || '' };
    this.showRootModal = true;
  }

  saveRootMenu() {
    if (!this.rootForm.MenuId || !this.rootForm.MenuNombre) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    if (this.editingRootId) {
      this.http.patch(`${this.apiUrl}/${this.editingRootId}`, this.rootForm).subscribe({
        next: () => { this.closeModals(); this.loadTree(); },
        error: (err) => alert('Error al actualizar: ' + err.error?.message),
      });
    } else {
      this.http.post(this.apiUrl, this.rootForm).subscribe({
        next: () => { this.closeModals(); this.loadTree(); },
        error: (err) => alert('Error al crear: ' + err.error?.message),
      });
    }
  }

  deleteRootMenu(id: string) {
    if (confirm(`¿Eliminar el menú raíz "${id}" y todos sus submenús?`)) {
      this.http.delete(`${this.apiUrl}/${id}`).subscribe({
        next: () => this.loadTree(),
        error: (err) => alert('Error al eliminar: ' + err.error?.message),
      });
    }
  }

  // SubMenu Actions
  openSubModal(parentMenuId: string) {
    this.editingSubNombre = null;
    this.subForm = { MenuId: parentMenuId, SubMenuNombre: '', SubMenuVista: '', Imagen: 'ClipboardList' };
    this.showSubModal = true;
  }

  editSubModal(sub: SubMenu) {
    this.editingSubNombre = sub.SubMenuNombre;
    this.subForm = { ...sub };
    this.showSubModal = true;
  }

  saveSubMenu() {
    if (!this.subForm.SubMenuNombre) {
      alert('El nombre del submenú es obligatorio.');
      return;
    }

    if (this.editingSubNombre) {
      this.http.patch(`${this.apiUrl}/submenu/${this.subForm.MenuId}?oldNombre=${encodeURIComponent(this.editingSubNombre)}`, this.subForm).subscribe({
        next: () => { this.closeModals(); this.loadTree(); },
        error: (err) => alert('Error al actualizar submenú: ' + err.error?.message),
      });
    } else {
      this.http.post(`${this.apiUrl}/submenu`, this.subForm).subscribe({
        next: () => { this.closeModals(); this.loadTree(); },
        error: (err) => alert('Error al crear submenú: ' + err.error?.message),
      });
    }
  }

  deleteSubMenu(menuId: string, subNombre: string) {
    if (confirm(`¿Eliminar el submenú "${subNombre}"?`)) {
      this.http.delete(`${this.apiUrl}/submenu/${menuId}?subNombre=${encodeURIComponent(subNombre)}`).subscribe({
        next: () => this.loadTree(),
        error: (err) => alert('Error al eliminar submenú: ' + err.error?.message),
      });
    }
  }

  closeModals() {
    this.showRootModal = false;
    this.showSubModal = false;
    this.editingRootId = null;
    this.editingSubNombre = null;
  }
}
