import { MENU, esRutaActiva, type MenuItem } from '../menuModules'

const items = MENU.flatMap((g) => g.items)
const porId = (id: string) => items.find((i) => i.id === id) as MenuItem

describe('Catálogo y Stock como entradas separadas (lámina ModMenu)', () => {
  it('son dos entradas: Catálogo con MOD_CATALOGO y Stock con MOD_STOCK, sin capacidades', () => {
    const catalogo = porId('catalogo')
    const stock = porId('stock')
    expect([catalogo.label, stock.label]).toEqual(['Catálogo', 'Stock'])
    expect(catalogo.appModule).toBe('MOD_CATALOGO')
    expect(stock.appModule).toBe('MOD_STOCK')
    expect(catalogo.capacidad).toBeUndefined()
    expect(stock.capacidad).toBeUndefined()
    expect(catalogo.href).toBe('/(tabs)/inventario')
    expect(stock.href).toBe('/(tabs)/inventario/stock')
  })

  it('en Stock solo se resalta Stock; en Catálogo solo Catálogo', () => {
    expect(esRutaActiva(porId('stock'), 'inventario/stock')).toBe(true)
    expect(esRutaActiva(porId('catalogo'), 'inventario/stock')).toBe(false)
    expect(esRutaActiva(porId('catalogo'), 'inventario/index')).toBe(true)
    expect(esRutaActiva(porId('stock'), 'inventario/index')).toBe(false)
  })
})
