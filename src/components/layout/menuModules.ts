import {
  BookOpen,
  CircleUser,
  House,
  Landmark,
  Lock,
  Navigation,
  PackageCheck,
  ShoppingBag,
  Tag,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native'
import type { AppModule, AppRole } from '@/libs/api-client/types'

type Accion = 'read' | 'create' | 'update' | 'delete'

export interface MenuItem {
  id: string
  label: string
  /** Texto chico a la derecha (p. ej. "Consulta" en catálogo). */
  hint?: string
  icon: LucideIcon
  href: string
  /** Nombre de la ruta dentro del cajón (props.state.routeNames). */
  routeName: string
  appModule?: AppModule
  /** Acción que tiene que tener sobre el módulo (por defecto 'read'). */
  appAction?: Accion
  requiredRoles?: AppRole[]
}

export interface MenuGroup {
  /** Sin título: los ítems van sueltos, como en la lámina Menu. */
  title?: string
  items: MenuItem[]
}

/**
 * Módulos del alcance (plan §3), en el orden de la lámina Menu. Autorizaciones,
 * Calendario y Reportes todavía no tienen pantalla: no se listan hasta que la
 * tengan (Autorizaciones irá con la capacidad CAP_AUTORIZAR_VENTA).
 */
export const MENU: MenuGroup[] = [
  {
    items: [
      { id: 'inicio', label: 'Inicio', icon: House, href: '/(tabs)/', routeName: 'index' },
      // Con CREATE, no read: el chofer lee ventas (el pedido de una parada) y no debe ver el módulo.
      { id: 'ventas', label: 'Ventas', icon: Tag, href: '/(tabs)/ventas', routeName: 'ventas/index', appModule: 'MOD_VENTAS', appAction: 'create' },
      { id: 'compras', label: 'Compras', icon: ShoppingBag, href: '/(tabs)/compras', routeName: 'compras/index', appModule: 'MOD_COMPRAS' },
      { id: 'clientes', label: 'Clientes', icon: CircleUser, href: '/(tabs)/socios', routeName: 'socios/index', appModule: 'MOD_CLIENTES' },
      { id: 'catalogo', label: 'Catálogo y stock', hint: 'Consulta', icon: BookOpen, href: '/(tabs)/inventario', routeName: 'inventario/index', appModule: 'MOD_STOCK' },
    ],
  },
  {
    title: 'Tesorería',
    items: [
      { id: 'cuentas', label: 'Cuentas corrientes', icon: Landmark, href: '/(tabs)/cuentas', routeName: 'cuentas/index', appModule: 'MOD_CC' },
      // Cobros, pagos, transferencias y depósito de cheques viven en la misma pantalla de movimientos.
      { id: 'movimientos', label: 'Cobros y pagos', icon: Wallet, href: '/(tabs)/tesoreria', routeName: 'tesoreria/index', appModule: 'MOD_PAGOS' },
    ],
  },
  {
    title: 'Logística',
    items: [
      { id: 'consola', label: 'Consola del chofer', icon: Navigation, href: '/(tabs)/logistica/consola', routeName: 'logistica/consola', appModule: 'MOD_VIAJES' },
      // Solo lectura; el mismo corte por rol que tenía el hub de logística.
      { id: 'por-preparar', label: 'Pedidos por preparar', icon: PackageCheck, href: '/(tabs)/logistica/pedidos', routeName: 'logistica/pedidos', appModule: 'MOD_VIAJES', requiredRoles: ['Administrador', 'AdministradorSistemas', 'Gerencia'] },
    ],
  },
]

/** Va al pie del menú, separado. Todos pueden ver su cuenta. */
export const MI_CUENTA: MenuItem = { id: 'cuenta', label: 'Mi cuenta y contraseña', icon: Lock, href: '/(tabs)/perfil', routeName: 'perfil' }

interface Acceso {
  canDo: (module: AppModule, action: Accion) => boolean
  roles: readonly string[]
}

/** Deja solo lo que el usuario puede usar; un grupo sin ítems visibles desaparece con su título. */
export function menuVisible(menu: MenuGroup[], { canDo, roles }: Acceso): MenuGroup[] {
  const puede = (it: MenuItem) =>
    (!it.requiredRoles || it.requiredRoles.some((r) => roles.includes(r))) &&
    (!it.appModule || canDo(it.appModule, it.appAction ?? 'read'))
  return menu
    .map((g) => ({ ...g, items: g.items.filter(puede) }))
    .filter((g) => g.items.length > 0)
}

/** La entrada queda marcada en su pantalla y en las que cuelgan de ella (ventas/[id], cuentas/nueva...). */
export function esRutaActiva(item: MenuItem, rutaActual: string | undefined): boolean {
  if (!rutaActual) return false
  if (rutaActual === item.routeName) return true
  return item.routeName.endsWith('/index') && rutaActual.startsWith(item.routeName.slice(0, -'index'.length))
}
