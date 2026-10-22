import { fleteDeLaVenta } from '../lib/flete'
import { METODO_ENTREGA } from '@/features/ventas/lib/venta-form-retiro'

// D-025: el 5 % automático de flete no existe en la web ni en el backend; el flete es lo que se escribe.
describe('fleteDeLaVenta', () => {
  it('sin nada escrito el flete es 0, no un porcentaje de la orden', () => {
    expect(fleteDeLaVenta(METODO_ENTREGA.Logistica, '')).toBe(0)
  })

  it('un envío con flete escrito lo usa tal cual', () => {
    expect(fleteDeLaVenta(METODO_ENTREGA.Logistica, '1500')).toBe(1500)
  })

  it('lo escrito que no es un número vale 0', () => {
    expect(fleteDeLaVenta(METODO_ENTREGA.Logistica, 'abc')).toBe(0)
  })

  it('un retiro en el local no lleva flete aunque haya algo escrito (comportamiento previo)', () => {
    expect(fleteDeLaVenta(METODO_ENTREGA.RetiroEnLocal, '1500')).toBe(0)
  })
})
