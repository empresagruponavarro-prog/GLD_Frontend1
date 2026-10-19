import { ClaveModulo } from '../auth/permisos.models';

/** Enlace del menú lateral asociado a su módulo (se oculta sin el permiso `ver`). */
export interface EnlaceMenu {
  etiqueta: string;
  ruta: string;
  /** Clases Font Awesome del icono. */
  icono: string;
  modulo: ClaveModulo;
  /** `routerLinkActiveOptions.exact` (por defecto `false`). */
  exacto?: boolean;
}

export type IdSubmenu = 'documentos' | 'tesoreria' | 'almacen' | 'maestros';

/** Grupo desplegable del menú (`.sidebar-item.has-sub` + `.sidebar-submenu`). */
export interface SubmenuMenu {
  id: IdSubmenu;
  etiqueta: string;
  icono: string;
  enlaces: readonly EnlaceMenu[];
}

export type EntradaMenu = { tipo: 'enlace'; enlace: EnlaceMenu } | { tipo: 'submenu'; submenu: SubmenuMenu };

/** Sección con título (`.menu-category`). */
export interface SeccionMenu {
  categoria: string;
  entradas: readonly EntradaMenu[];
}

function enlace(e: EnlaceMenu): EntradaMenu {
  return { tipo: 'enlace', enlace: e };
}

function submenu(s: SubmenuMenu): EntradaMenu {
  return { tipo: 'submenu', submenu: s };
}

/** Menú lateral completo, en el orden en que se muestra. */
export const MENU_LATERAL: readonly SeccionMenu[] = [
  {
    categoria: 'Navegación',
    entradas: [
      enlace({ etiqueta: 'Dashboard Situacional', ruta: '/dashboard-situacional', icono: 'fa-solid fa-chart-line', modulo: 'dashboard', exacto: true }),
      enlace({ etiqueta: 'Módulos Principal', ruta: '/modulos', icono: 'fa-solid fa-table-cells-large', modulo: 'modulos' }),
    ],
  },
  {
    categoria: 'Operaciones',
    entradas: [
      enlace({ etiqueta: 'Registro de Incidencias', ruta: '/incidencias', icono: 'fa-solid fa-clipboard-list', modulo: 'incidencias' }),
      submenu({
        id: 'documentos',
        etiqueta: 'Documentos',
        icono: 'fa-solid fa-folder-open',
        enlaces: [
          { etiqueta: 'Compromisos de pago', ruta: '/documentos/administracion', icono: 'fa-solid fa-file-invoice-dollar', modulo: 'documentos.administracion' },
          { etiqueta: 'Órdenes de compra', ruta: '/documentos/origen', icono: 'fa-solid fa-file-lines', modulo: 'documentos.origen' },
          { etiqueta: 'Requerimientos (FUR)', ruta: '/requerimientos', icono: 'fa-solid fa-file-circle-plus', modulo: 'requerimientos', exacto: true },
          { etiqueta: 'Aprobaciones', ruta: '/requerimientos/aprobacion', icono: 'fa-solid fa-clipboard-check', modulo: 'requerimientos.aprobacion' },
        ],
      }),
      submenu({
        id: 'tesoreria',
        etiqueta: 'Tesorería',
        icono: 'fa-solid fa-sack-dollar',
        enlaces: [
          { etiqueta: 'Consulta y tablero', ruta: '/tesoreria/consulta', icono: 'fa-solid fa-chart-column', modulo: 'tesoreria.consulta' },
          { etiqueta: 'Programación de pagos', ruta: '/tesoreria/programacion', icono: 'fa-solid fa-calendar-check', modulo: 'tesoreria.programacion' },
          { etiqueta: 'Ejecución de pagos', ruta: '/tesoreria/pagos', icono: 'fa-solid fa-money-check-dollar', modulo: 'tesoreria.pagos' },
          { etiqueta: 'Cuentas de pago', ruta: '/tesoreria/cuentas', icono: 'fa-solid fa-building-columns', modulo: 'tesoreria.cuentas' },
          { etiqueta: 'Tipo de cambio', ruta: '/tesoreria/tipo-cambio', icono: 'fa-solid fa-dollar-sign', modulo: 'tesoreria.tipo-cambio' },
        ],
      }),
      submenu({
        id: 'almacen',
        etiqueta: 'Control de Almacén',
        icono: 'fa-solid fa-warehouse',
        enlaces: [
          { etiqueta: 'Consulta', ruta: '/almacen/consulta', icono: 'fa-solid fa-magnifying-glass', modulo: 'almacen.consulta' },
          { etiqueta: 'Stock actual', ruta: '/almacen/stock', icono: 'fa-solid fa-boxes-stacked', modulo: 'almacen.stock' },
          { etiqueta: 'Recepción de compras', ruta: '/almacen/recepciones', icono: 'fa-solid fa-truck-ramp-box', modulo: 'almacen.recepciones' },
          { etiqueta: 'Entradas', ruta: '/almacen/ingresos', icono: 'fa-solid fa-arrow-right-to-bracket', modulo: 'almacen.ingresos' },
          { etiqueta: 'Salidas', ruta: '/almacen/salidas', icono: 'fa-solid fa-arrow-right-from-bracket', modulo: 'almacen.salidas' },
          { etiqueta: 'Transferencias', ruta: '/almacen/transferencias', icono: 'fa-solid fa-right-left', modulo: 'almacen.transferencias' },
          { etiqueta: 'Préstamos de equipos', ruta: '/almacen/prestamos', icono: 'fa-solid fa-screwdriver-wrench', modulo: 'almacen.prestamos' },
          { etiqueta: 'Kardex', ruta: '/almacen/kardex', icono: 'fa-solid fa-list-ol', modulo: 'almacen.kardex' },
          { etiqueta: 'Inventario inicial', ruta: '/almacen/inventario-inicial', icono: 'fa-solid fa-clipboard-check', modulo: 'almacen.inventario-inicial' },
          { etiqueta: 'Almacenes', ruta: '/almacen/almacenes', icono: 'fa-solid fa-warehouse', modulo: 'almacen.almacenes' },
        ],
      }),
    ],
  },
  {
    categoria: 'Módulos del Sistema',
    entradas: [
      submenu({
        id: 'maestros',
        etiqueta: 'Maestros Generales',
        icono: 'fa-solid fa-gears',
        enlaces: [
          { etiqueta: 'Empresas', ruta: '/admin/empresas', icono: 'fa-solid fa-building', modulo: 'admin.empresas' },
          { etiqueta: 'Anexos', ruta: '/anexos', icono: 'fa-solid fa-paperclip', modulo: 'maestros.anexos' },
          { etiqueta: 'Catálogo de Bienes y Servicios', ruta: '/productos', icono: 'fa-solid fa-box', modulo: 'maestros.productos' },
          { etiqueta: 'Áreas', ruta: '/maestros-generales/areas', icono: 'fa-solid fa-sitemap', modulo: 'maestros.areas' },
          { etiqueta: 'Unidades de Medida', ruta: '/maestros-generales/unidades-medida', icono: 'fa-solid fa-ruler-combined', modulo: 'maestros.generales' },
          { etiqueta: 'Centros de Costos', ruta: '/centros-costos', icono: 'fa-solid fa-building-flag', modulo: 'centros-costos' },
          { etiqueta: 'Presupuestos', ruta: '/presupuestos', icono: 'fa-solid fa-file-invoice-dollar', modulo: 'presupuestos' },
          { etiqueta: 'Plantillas', ruta: '/presupuestos/plantillas', icono: 'fa-solid fa-copy', modulo: 'presupuestos.plantillas' },
        ],
      }),
    ],
  },
  {
    categoria: 'Administración',
    entradas: [
      enlace({ etiqueta: 'Usuarios', ruta: '/admin/usuarios', icono: 'fa-solid fa-users-gear', modulo: 'admin.usuarios' }),
      enlace({ etiqueta: 'Roles y permisos', ruta: '/admin/roles', icono: 'fa-solid fa-user-shield', modulo: 'admin.roles' }),
    ],
  },
];

/** Filtra el menú: quita enlaces no visibles, submenús sin enlaces y secciones vacías. */
export function filtrarMenu(menu: readonly SeccionMenu[], visible: (e: EnlaceMenu) => boolean): SeccionMenu[] {
  const resultado: SeccionMenu[] = [];
  for (const seccion of menu) {
    const entradas: EntradaMenu[] = [];
    for (const entrada of seccion.entradas) {
      if (entrada.tipo === 'enlace') {
        if (visible(entrada.enlace)) entradas.push(entrada);
      } else {
        const enlaces = entrada.submenu.enlaces.filter(visible);
        if (enlaces.length > 0) entradas.push({ tipo: 'submenu', submenu: { ...entrada.submenu, enlaces } });
      }
    }
    if (entradas.length > 0) resultado.push({ categoria: seccion.categoria, entradas });
  }
  return resultado;
}
