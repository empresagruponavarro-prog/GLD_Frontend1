import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenusService } from './menus.service';
import { MenuRoot, SubMenu } from './interfaces';

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menus.html'
})
export class MenusComponent {
  private menusService = inject(MenusService);

  treeData = signal<MenuRoot[]>([]);
  loading = signal<boolean>(false);

  // Drag & drop state
  draggedRootIdx = signal<number | null>(null);
  draggedSub = signal<{ rootIdx: number; subIdx: number } | null>(null);

  // Root Modal State
  showRootModal = signal<boolean>(false);
  editingRootId = signal<string | null>(null);
  rootForm = { MenuId: '', MenuNombre: '', Imagen: '' };

  // SubModal State
  showSubModal = signal<boolean>(false);
  editingSubNombre = signal<string | null>(null);
  subForm: SubMenu = { MenuId: '', SubMenuNombre: '', SubMenuVista: '', Imagen: '' };

  constructor() {
    this.loadTree();
  }

  loadTree() {
    this.loading.set(true);
    this.menusService.getTree().subscribe({
      next: (data) => {
        this.treeData.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
      },
    });
  }

  // Drag and Drop Logic
  onRootDragStart(idx: number, event: DragEvent) {
    this.draggedRootIdx.set(idx);
    this.draggedSub.set(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onRootDrop(targetIdx: number) {
    const currentRootIdx = this.draggedRootIdx();
    if (currentRootIdx !== null && currentRootIdx !== targetIdx) {
      const list = [...this.treeData()];
      const movedItem = list.splice(currentRootIdx, 1)[0];
      list.splice(targetIdx, 0, movedItem);
      this.treeData.set(list);
    }
    this.draggedRootIdx.set(null);
  }

  onSubDragStart(rootIdx: number, subIdx: number, event: DragEvent) {
    event.stopPropagation();
    this.draggedSub.set({ rootIdx, subIdx });
    this.draggedRootIdx.set(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onSubDrop(rootIdx: number, targetSubIdx: number) {
    const subDrag = this.draggedSub();
    if (subDrag && subDrag.rootIdx === rootIdx && subDrag.subIdx !== targetSubIdx) {
      const list = [...this.treeData()];
      const subList = [...list[rootIdx].submenus];
      const movedSub = subList.splice(subDrag.subIdx, 1)[0];
      subList.splice(targetSubIdx, 0, movedSub);
      list[rootIdx] = { ...list[rootIdx], submenus: subList };
      this.treeData.set(list);
    }
    this.draggedSub.set(null);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  // Root Menu Actions
  openRootModal() {
    this.editingRootId.set(null);
    this.rootForm = { MenuId: '', MenuNombre: '', Imagen: 'Users' };
    this.showRootModal.set(true);
  }

  editRootModal(root: MenuRoot) {
    this.editingRootId.set(root.MenuId);
    this.rootForm = { MenuId: root.MenuId, MenuNombre: root.MenuNombre, Imagen: root.Imagen || '' };
    this.showRootModal.set(true);
  }

  saveRootMenu() {
    if (!this.rootForm.MenuId || !this.rootForm.MenuNombre) {
      alert('Por favor complete los campos obligatorios.');
      return;
    }

    const editId = this.editingRootId();
    if (editId) {
      this.menusService.updateRootMenu(editId, this.rootForm).subscribe({
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
    this.editingSubNombre.set(null);
    this.subForm = { MenuId: parentMenuId, SubMenuNombre: '', SubMenuVista: '', Imagen: 'ClipboardList' };
    this.showSubModal.set(true);
  }

  editSubModal(sub: SubMenu) {
    this.editingSubNombre.set(sub.SubMenuNombre);
    this.subForm = { ...sub };
    this.showSubModal.set(true);
  }

  saveSubMenu() {
    if (!this.subForm.SubMenuNombre) {
      alert('El nombre del submenú es obligatorio.');
      return;
    }

    const subNombre = this.editingSubNombre();
    if (subNombre) {
      this.menusService.updateSubMenu(this.subForm.MenuId, subNombre, this.subForm).subscribe({
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
    this.showRootModal.set(false);
    this.showSubModal.set(false);
    this.editingRootId.set(null);
    this.editingSubNombre.set(null);
  }
}
