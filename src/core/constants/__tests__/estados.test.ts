import { getVentaStatusConfig } from '../status'
import { esEstadoCompra, esEstadoHojaRuta, esEstadoVenta } from '../estados'
import { canDownloadEtiquetas, canDownloadNotaEntrega } from '@/features/pedidos/lib/pedido-pdf-gating'
import { canAuthorizeVenta } from '@/features/ventas/lib/authorization'
import { estaCancelada, pasoDeVenta } from '@/features/ventas/lib/estadoVenta'

const COLORS = { primary: '#P', danger: '#D', textMuted: '#M', surface2: '#S' }
const PERMISOS = [{ module: 'CAP_AUTORIZAR_VENTA', canRead: true }]

describe('esEstadoVenta / esEstadoHojaRuta / esEstadoCompra (L-33)', () => {
  it('la venta llega como nombre, número o número en texto', () => {
    expect(esEstadoVenta('Empacada', 'Empacada')).toBe(true)
    expect(esEstadoVenta(4, 'Empacada')).toBe(true)
    expect(esEstadoVenta('4', 'Empacada')).toBe(true)
    expect(esEstadoVenta('4', 'Confirmada', 'EnRuta')).toBe(false)
  })

  it('un estado desconocido o vacío no es ninguno', () => {
    expect(esEstadoVenta('Inventado', 'Anulada', 'Pendiente')).toBe(false)
    expect(esEstadoVenta(99, 'Anulada')).toBe(false)
    expect(esEstadoVenta(null, 'Anulada')).toBe(false)
    expect(esEstadoVenta(undefined, 'Anulada')).toBe(false)
  })

  it('hoja de ruta por número o por nombre', () => {
    expect(esEstadoHojaRuta(2, 'EnCurso')).toBe(true)
    expect(esEstadoHojaRuta('EnCurso', 'EnCurso')).toBe(true)
    expect(esEstadoHojaRuta(3, 'EnCurso', 'Cancelada')).toBe(false)
    expect(esEstadoHojaRuta(9, 'EnCurso')).toBe(false)
  })

  it('la compra llega por nombre', () => {
    expect(esEstadoCompra('NotaPedido', 'NotaPedido', 'Confirmado')).toBe(true)
    expect(esEstadoCompra('Entregado', 'NotaPedido', 'Confirmado')).toBe(false)
    expect(esEstadoCompra(undefined, 'NotaPedido')).toBe(false)
    expect(esEstadoCompra('Otro', 'NotaPedido')).toBe(false)
  })
})

describe('getVentaStatusConfig conserva las etiquetas de mobile', () => {
  const caso = (estado: string | number | null | undefined) => getVentaStatusConfig(estado, COLORS).label
  it.each([
    ['1', 'Pendiente'], ['Pendiente', 'Pendiente'], [1, 'Pendiente'],
    ['2', 'Confirmada'], ['Confirmada', 'Confirmada'],
    ['3', 'Preparando'], ['EnPreparacion', 'Preparando'],
    ['4', 'Preparando'], ['Empacada', 'Preparando'],
    ['5', 'En Ruta'], ['EnRuta', 'En Ruta'],
    ['6', 'Entregada'], ['Entregada', 'Entregada'],
    ['8', 'Anulada'], ['Anulada', 'Anulada'],
    ['9', 'Por Autorizar'], ['PendienteAutorizacion', 'Por Autorizar'],
  ])('%s -> %s', (estado, etiqueta) => {
    expect(caso(estado)).toBe(etiqueta)
  })

  it('NoEntregada, Vencido, Rechazada y los desconocidos siguen en "Otros" (decisión del dueño)', () => {
    for (const e of ['7', 'NoEntregada', '10', 'Vencido', '11', 'RechazadaAutorizacion', 'Inventado', '', null, undefined]) {
      expect(caso(e)).toBe('Otros')
    }
  })

  it('conserva color y fondo', () => {
    const c = getVentaStatusConfig('Anulada', COLORS)
    expect([c.color, c.bg]).toEqual(['#D', '#D15'])
    expect(getVentaStatusConfig(6, COLORS).color).toBe('#P')
  })
})

describe('permiso de PDF por estado (nombre, número o texto)', () => {
  it('etiquetas desde Empacada, por nombre también', () => {
    expect(canDownloadEtiquetas('Empacada')).toBe(true)
    expect(canDownloadEtiquetas(4)).toBe(true)
    expect(canDownloadEtiquetas('EnPreparacion')).toBe(false)
    expect(canDownloadEtiquetas('Anulada')).toBe(false)
    expect(canDownloadEtiquetas('Inventado')).toBe(false)
  })
  it('nota de entrega desde EnPreparacion, por nombre también', () => {
    expect(canDownloadNotaEntrega('EnPreparacion')).toBe(true)
    expect(canDownloadNotaEntrega('3')).toBe(true)
    expect(canDownloadNotaEntrega('Confirmada')).toBe(false)
  })
})

describe('autorizar y pasos del detalle de venta', () => {
  it('autorizar acepta 9, "9" y el nombre', () => {
    expect(canAuthorizeVenta(9, PERMISOS)).toBe(true)
    expect(canAuthorizeVenta('9', PERMISOS)).toBe(true)
    expect(canAuthorizeVenta('PendienteAutorizacion', PERMISOS)).toBe(true)
    expect(canAuthorizeVenta('Confirmada', PERMISOS)).toBe(false)
  })

  it('el paso de la línea de tiempo es el de siempre', () => {
    expect(pasoDeVenta('2')).toBe(0)
    expect(pasoDeVenta('Confirmada')).toBe(0)
    expect(pasoDeVenta('EnPreparacion')).toBe(1)
    expect(pasoDeVenta(4)).toBe(1)
    expect(pasoDeVenta('EnRuta')).toBe(2)
    expect(pasoDeVenta('6')).toBe(3)
    expect(pasoDeVenta('1')).toBe(-1)
    expect(pasoDeVenta('Inventado')).toBe(-1)
    expect(pasoDeVenta(undefined)).toBe(-1)
  })

  it('cancelada es Anulada o NoEntregada, por número o por nombre', () => {
    expect(estaCancelada('8')).toBe(true)
    expect(estaCancelada('7')).toBe(true)
    expect(estaCancelada('Anulada')).toBe(true)
    expect(estaCancelada('NoEntregada')).toBe(true)
    expect(estaCancelada('2')).toBe(false)
    expect(estaCancelada('Inventado')).toBe(false)
  })
})
