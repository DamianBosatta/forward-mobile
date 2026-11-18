import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * S9 (M8c): las listas que pueden tener cientos de filas usan FlashList (reciclan las filas); las que tienen secciones
 * quedan en SectionList y las de un solo bloque en FlatList (ver listasLargasContrato).
 * FlashList 2 no acepta `columnWrapperStyle` ni `gap` en `contentContainerStyle`: el espacio entre celdas va en la celda.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..')
const LISTAS_PESADAS = [
  'app/(tabs)/proveedores/index.tsx',
  'app/(tabs)/cuentas/index.tsx',
  'app/(tabs)/inventario/index.tsx',
  'src/features/compras/components/CatalogoCompra.tsx',
  'src/features/pagos/components/ListaDePagos.tsx',
  'src/features/inventario/components/MovimientosDeStock.tsx',
  'src/features/inventario/components/StockPorDeposito.tsx',
  'src/features/deudores/components/DeudoresClientes.tsx',
  'src/features/cuentas/components/DeudasAProveedores.tsx',
  'src/features/cuentas/components/ElegirClienteCobro.tsx',
  'src/features/cuentas/components/ElegirProveedorPago.tsx',
  'src/features/venta-nueva/components/ElegirClienteVenta.tsx',
  'src/features/venta-nueva/components/CatalogoVenta.tsx',
]

describe('listas pesadas con FlashList', () => {
  it.each(LISTAS_PESADAS)('%s usa FlashList y no FlatList', (ruta) => {
    const fuente = readFileSync(join(RAIZ, ruta), 'utf8')
    expect(fuente).toMatch(/<FlashList\b/)
    expect(fuente).not.toMatch(/<FlatList\b/)
    expect(fuente).not.toMatch(/columnWrapperStyle/)
  })
})
