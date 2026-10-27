import {
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CalendarDays,
  ChartColumn,
  CircleUser,
  House,
  Landmark,
  Lock,
  Navigation,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native'
import type { AppModule } from '@/libs/api-client/types'
import type { AppCapability } from '@/features/auth/lib/capabilities'

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
  /** Capacidad otorgable que tiene que tener (p. ej. CAP_AUTORIZAR_VENTA). */
  capacidad?: AppCapability
  /** Condición propia que se suma a las anteriores (p. ej. varios módulos o un corte por perfil). */
  visibleSi?: (canDo: Acceso['canDo']) => boolean
}

export interface MenuGroup {
  /** Sin título: los ítems van sueltos, como en la lámina Menu. */
  title?: string
  items: MenuItem[]
}

type CanDo = (module: AppModule, action: Accion) => boolean

/**
 * El chofer lee viajes y no crea ventas: eso lo distingue del vendedor y de la oficina. No hay
 * capacidad de "chofer" en el servidor (su alcance es la hoja propia, `AlcanceDeLaHoja`), así que
 * mobile lo reconoce por sus permisos, nunca por su rol.
 */
export function esChofer(canDo: CanDo): boolean {
  return canDo('MOD_VIAJES', 'read') && !canDo('MOD_VENTAS', 'create')
}

/** Entra a Ventas como la pantalla (leer ventas o pedidos); el chofer queda afuera. */
export function puedeVerVentas(canDo: CanDo): boolean {
  return !esChofer(canDo) && (canDo('MOD_VENTAS', 'read') || canDo('MOD_PEDIDOS', 'read'))
}

/**
 * Módulos del alcance, en las secciones de la lámina ModMenu: Inicio suelto, VENDER, COMPRAR,
 * GESTIÓN, LOGÍSTICA y Reportes suelto al final. Quién ve cada entrada no cambia: lo deciden
 * `appModule`, `capacidad` y `visibleSi`, no la sección.
 */
export const MENU: MenuGroup[] = [
  {
    items: [{ id: 'inicio', label: 'Inicio', icon: House, href: '/(tabs)/', routeName: 'index' }],
  },
  {
    title: 'VENDER',
    items: [
      // Mismo criterio que la pantalla (leer ventas o pedidos), menos el chofer: lee ventas (el pedido de una parada) y no debe ver el módulo.
      { id: 'ventas', label: 'Ventas', icon: Tag, href: '/(tabs)/ventas', routeName: 'ventas/index', visibleSi: puedeVerVentas },
      { id: 'clientes', label: 'Clientes', icon: CircleUser, href: '/(tabs)/socios', routeName: 'socios/index', appModule: 'MOD_CLIENTES' },
      { id: 'catalogo', label: 'Catálogo', hint: 'Solo ver', icon: BookOpen, href: '/(tabs)/inventario', routeName: 'inventario/index', appModule: 'MOD_STOCK' },
      { id: 'stock', label: 'Stock', hint: 'Solo ver', icon: Boxes, href: '/(tabs)/inventario/stock', routeName: 'inventario/stock', appModule: 'MOD_STOCK' },
    ],
  },
  {
    title: 'COMPRAR',
    items: [
      { id: 'compras', label: 'Compras', icon: ShoppingBag, href: '/(tabs)/compras', routeName: 'compras/index', appModule: 'MOD_COMPRAS' },
      { id: 'proveedores', label: 'Proveedores', icon: Building2, href: '/(tabs)/proveedores', routeName: 'proveedores/index', appModule: 'MOD_PROVEEDORES' },
    ],
  },
  {
    title: 'GESTIÓN',
    items: [
      // Igual que la web (sidebar.tsx, "Autorizaciones pendientes"): se muestra solo por CAP_AUTORIZAR_VENTA.
      { id: 'autorizaciones', label: 'Autorizaciones', icon: ShieldCheck, href: '/(tabs)/autorizaciones', routeName: 'autorizaciones/index', capacidad: 'CAP_AUTORIZAR_VENTA' },
      { id: 'cuentas', label: 'Cuentas corrientes', icon: Landmark, href: '/(tabs)/cuentas', routeName: 'cuentas/index', appModule: 'MOD_CC' },
      // Transferencias entre cuentas propias; los cobros se registran desde la cuenta corriente del cliente.
      // Los cheques se operan en la web (bloque 12, D10).
      { id: 'movimientos', label: 'Transferencias', icon: Wallet, href: '/(tabs)/tesoreria', routeName: 'tesoreria/index', appModule: 'MOD_PAGOS' },
      // El calendario no es un módulo en el servidor: cada uno ve el suyo (CalendarioController).
      { id: 'calendario', label: 'Calendario', icon: CalendarDays, href: '/(tabs)/calendario', routeName: 'calendario/index' },
      // Cada uno ve sus avisos (el destinatario sale del token); el número de no leídas va al lado.
      { id: 'avisos', label: 'Avisos', icon: Bell, href: '/(tabs)/avisos', routeName: 'avisos/index' },
    ],
  },
  {
    title: 'LOGÍSTICA',
    items: [
      // Solo ver (D6): pendientes y no entregados. GET /Logistica/ventas-para-preparacion pide MOD_VIAJES:Read y recorta por depósito
      // (AlcanceDelDespacho); la web abre el tablero de picking con el mismo módulo (REGLAS_DE_RUTA).
      { id: 'por-preparar', label: 'Pedidos de logística', icon: PackageCheck, href: '/(tabs)/logistica/pedidos', routeName: 'logistica/pedidos', appModule: 'MOD_VIAJES' },
      { id: 'consola', label: 'Consola del chofer', icon: Navigation, href: '/(tabs)/logistica/consola', routeName: 'logistica/consola', appModule: 'MOD_VIAJES' },
    ],
  },
  {
    items: [
      // El servidor pide Ventas:Read y acota el alcance (el vendedor ve lo suyo); el chofer lee ventas pero no vende.
      { id: 'reportes', label: 'Reportes', icon: ChartColumn, href: '/(tabs)/reportes', routeName: 'reportes/index', visibleSi: (canDo) => canDo('MOD_VENTAS', 'read') && puedeVerVentas(canDo) },
    ],
  },
]

/** Va al pie del menú, separado. Todos pueden ver su cuenta. */
export const MI_CUENTA: MenuItem = { id: 'cuenta', label: 'Mi cuenta y contraseña', icon: Lock, href: '/(tabs)/perfil', routeName: 'perfil' }

interface Acceso {
  canDo: (module: AppModule, action: Accion) => boolean
  tieneCapacidad: (capacidad: AppCapability) => boolean
}

/** Deja solo lo que el usuario puede usar; un grupo sin ítems visibles desaparece con su título. */
export function menuVisible(menu: MenuGroup[], { canDo, tieneCapacidad }: Acceso): MenuGroup[] {
  const puede = (it: MenuItem) =>
    (!it.capacidad || tieneCapacidad(it.capacidad)) &&
    (!it.appModule || canDo(it.appModule, it.appAction ?? 'read')) &&
    (!it.visibleSi || it.visibleSi(canDo))
  return menu
    .map((g) => ({ ...g, items: g.items.filter(puede) }))
    .filter((g) => g.items.length > 0)
}

/** La entrada queda marcada en su pantalla y en las que cuelgan de ella (ventas/[id], cuentas/nueva...). */
export function esRutaActiva(item: MenuItem, rutaActual: string | undefined): boolean {
  if (!rutaActual) return false
  if (rutaActual === item.routeName) return true
  // Una pantalla hermana con entrada propia (Stock dentro de inventario/) no resalta a la de índice.
  if (MENU.some((g) => g.items.some((i) => i.routeName === rutaActual))) return false
  return item.routeName.endsWith('/index') && rutaActual.startsWith(item.routeName.slice(0, -'index'.length))
}
