import { resolverCodigo } from '../lib/escaneo'
import { producto } from '../__testing__/producto'

const pala = producto({ id: 'a', codigoBarra: '7790001112223', codigoPropio: 'PRO11923' })
const padre = producto({ id: 'pf', codigoPropio: 'SAP-LIN', esPadreDeVariantes: true })
const lavanda = producto({ id: 'v1', productoPadreId: 'pf', codigoBarra: '7790009998887' })

describe('escanear un código en la góndola', () => {
  it('un producto se resuelve por código de barras, propio o del proveedor, sin importar mayúsculas ni espacios', () => {
    expect(resolverCodigo([pala], '7790001112223')).toEqual({ tipo: 'producto', producto: pala })
    expect(resolverCodigo([pala], ' pro11923 ')).toEqual({ tipo: 'producto', producto: pala })
    const conProveedor = producto({ id: 'b', codigoProveedor: 'PROV-9' })
    expect(resolverCodigo([conProveedor], 'prov-9')).toEqual({ tipo: 'producto', producto: conProveedor })
  })

  it('una fragancia lleva a elegir las fragancias de su línea: no se vende suelta', () => {
    expect(resolverCodigo([padre, lavanda], '7790009998887')).toEqual({ tipo: 'fragancias', padreId: 'pf' })
  })

  it('una línea con fragancias también abre su elección', () => {
    expect(resolverCodigo([padre, lavanda], 'sap-lin')).toEqual({ tipo: 'fragancias', padreId: 'pf' })
  })

  it('un código que no está en el catálogo no resuelve nada', () => {
    expect(resolverCodigo([pala], '0000')).toBeNull()
    expect(resolverCodigo([pala], '   ')).toBeNull()
  })
})
