export interface SubMenu {
  MenuId: string;
  TipoSubMenu?: string;
  SubMenuNombre: string;
  SubMenuVista?: string;
  Imagen?: string;
}

export interface MenuRoot {
  MenuId: string;
  MenuNombre: string;
  Imagen?: string;
  submenus: SubMenu[];
}
