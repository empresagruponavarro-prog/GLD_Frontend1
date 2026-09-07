import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenusService } from './menus.service';
import { MenuRoot, SubMenu } from './menus.interface';

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menus.html'
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

  constructor(private menusService: MenusService) {}

  ngOnInit() {
    this.loadTree();
  }

  loadTree() {
    this.loading = true;
    this.menusService.getTree().subscribe({
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
      this.menusService.updateRootMenu(this.editingRootId, this.rootForm).subscribe({
        next: () => { this.closeModals(); this.loadTree(); },
        error: (err) => alert('Error al actualizar: ' + err.error?.message),
      });
    } else {
      this.menusService.createRootMenu(this.rootForm).subscribe({
        next: () => { this.closeModals(); this.loadTree(); },
        error: (err) => alert('Error al crear: ' + err.error?.message),
      });
    }
  }

  deleteRootMenu(id: string) {
    if (confirm(`¿Eliminar el menú raíz "${id}" y todos sus submenús?`)) {
      this.menusService.deleteRootMenu(id).subscribe({
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
      this.menusService.updateSubMenu(this.subForm.MenuId, this.editingSubNombre, this.subForm).subscribe({
        next: () => { this.closeModals(); this.loadTree(); },
        error: (err) => alert('Error al actualizar submenú: ' + err.error?.message),
      });
    } else {
      this.menusService.createSubMenu(this.subForm).subscribe({
        next: () => { this.closeModals(); this.loadTree(); },
        error: (err) => alert('Error al crear submenú: ' + err.error?.message),
      });
    }
  }

  deleteSubMenu(menuId: string, subNombre: string) {
    if (confirm(`¿Eliminar el submenú "${subNombre}"?`)) {
      this.menusService.deleteSubMenu(menuId, subNombre).subscribe({
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
