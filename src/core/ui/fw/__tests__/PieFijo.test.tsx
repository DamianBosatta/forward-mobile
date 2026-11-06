import React from 'react'
import { Keyboard, Text, View } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { PieFijo } from '../PieFijo'
import { espacioBajoTeclado, paddingInferiorDelPie } from '../espacioTeclado'
import { TEMAS, conTema, estilo } from '../__testing__/tema'

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}))

describe('espacioBajoTeclado: cuánto hay que subir el pie para que quede sobre el teclado', () => {
  it('teclado cerrado: nada', () => {
    expect(espacioBajoTeclado({ tecladoAbierto: false, tecladoArriba: 2000, pieAbajo: 3000 })).toBe(0)
  })
  it('teclado abierto y la ventana no se achicó: sube lo que el teclado tapa', () => {
    expect(espacioBajoTeclado({ tecladoAbierto: true, tecladoArriba: 2000, pieAbajo: 3000 })).toBe(1000)
  })
  it('teclado abierto y la ventana ya se achicó (el pie queda sobre el teclado): nada, sin sumar dos veces', () => {
    expect(espacioBajoTeclado({ tecladoAbierto: true, tecladoArriba: 2000, pieAbajo: 1990 })).toBe(0)
    expect(espacioBajoTeclado({ tecladoAbierto: true, tecladoArriba: 2000, pieAbajo: 2000 })).toBe(0)
  })
})

describe('paddingInferiorDelPie', () => {
  it('cerrado y con inset: respeta la barra del sistema', () => {
    expect(paddingInferiorDelPie({ base: 16, inset: 34, usaInset: true, tecladoAbierto: false, espacio: 0 })).toBe(50)
  })
  it('cerrado y sin inset pedido: solo la base', () => {
    expect(paddingInferiorDelPie({ base: 16, inset: 34, usaInset: false, tecladoAbierto: false, espacio: 0 })).toBe(16)
  })
  it('abierto: se saca el inset y se suma el espacio que tapa el teclado', () => {
    expect(paddingInferiorDelPie({ base: 16, inset: 34, usaInset: true, tecladoAbierto: true, espacio: 0 })).toBe(16)
    expect(paddingInferiorDelPie({ base: 16, inset: 34, usaInset: true, tecladoAbierto: true, espacio: 300 })).toBe(316)
  })
})

describe.each(TEMAS)('PieFijo (%s)', (tema) => {
  beforeEach(() => conTema(tema))
  let afterEachRestaurar: (() => void) | undefined
  afterEach(() => { act(() => conTema('light')); jest.restoreAllMocks(); afterEachRestaurar?.(); afterEachRestaurar = undefined })

  const montar = (props: Partial<React.ComponentProps<typeof PieFijo>> = {}) => {
    const oyentes: Record<string, (e: unknown) => void> = {}
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((nombre: string, fn: (e: unknown) => void) => {
      oyentes[nombre] = fn
      return { remove: () => { delete oyentes[nombre] } }
    }) as never)
    render(
      <View>
        <PieFijo testID="pie" {...props}><Text>Confirmar</Text></PieFijo>
      </View>,
    )
    return oyentes
  }
  const abrir = (o: Record<string, (e: unknown) => void>, screenY: number) =>
    act(() => { (o.keyboardDidShow ?? o.keyboardWillShow)({ endCoordinates: { screenY, height: 800 } }) })
  const cerrar = (o: Record<string, (e: unknown) => void>) =>
    act(() => { (o.keyboardDidHide ?? o.keyboardWillHide)({}) })

  it('cerrado: el contenido se ve y con conInsetInferior suma la barra del sistema', () => {
    montar({ conInsetInferior: true })
    expect(screen.getByText('Confirmar')).toBeTruthy()
    expect(estilo(screen.getByTestId('pie-contenido')).paddingBottom).toBe(16 + 34)
  })

  it('abierto: saca el inset y deja el pie sobre el teclado', () => {
    const o = montar({ conInsetInferior: true })
    abrir(o, 2000)
    expect(estilo(screen.getByTestId('pie-contenido')).paddingBottom).toBe(16)
    cerrar(o)
    expect(estilo(screen.getByTestId('pie-contenido')).paddingBottom).toBe(16 + 34)
  })

  const parchearMedicion = () => {
    const proto = View.prototype as unknown as { measure?: unknown; measureInWindow?: unknown }
    const original = { measure: proto.measure, measureInWindow: proto.measureInWindow }
    // `measure` da la posición en pantalla (pageY); `measureInWindow` en Android resta la barra de estado fuera de un Modal translúcido.
    const medir = jest.fn((cb: (x: number, y: number, w: number, h: number, px: number, py: number) => void) => cb(0, 0, 1000, 100, 0, 2900))
    const enVentana = jest.fn((cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 2900 - 144, 1000, 100))
    proto.measure = medir
    proto.measureInWindow = enVentana
    afterEachRestaurar = () => { proto.measure = original.measure; proto.measureInWindow = original.measureInWindow }
    return medir
  }

  it('abierto y sin achicarse la ventana: sube el pie lo que tapa el teclado; si la ventana ya se achicó, no suma', () => {
    const medir = parchearMedicion()
    const o = montar({ conInsetInferior: true })
    abrir(o, 2200)
    expect(estilo(screen.getByTestId('pie-contenido')).paddingBottom).toBe(16 + 800)
    medir.mockImplementation((cb) => cb(0, 0, 1000, 100, 0, 2000))
    fireEvent(screen.getByTestId('pie'), 'layout', { nativeEvent: { layout: { x: 0, y: 2000, width: 1000, height: 100 } } })
    expect(estilo(screen.getByTestId('pie-contenido')).paddingBottom).toBe(16)
  })

  it('mide en coordenadas de pantalla (como screenY del teclado), no las de la ventana sin barra de estado', () => {
    parchearMedicion()
    const o = montar()
    abrir(o, 2200)
    // pie en pantalla hasta 3000 (pageY 2900 + 100), teclado en 2200: tapa 800; con measureInWindow daría 656.
    expect(estilo(screen.getByTestId('pie-contenido')).paddingBottom).toBe(16 + 800)
  })

  it('usa tokens del tema: fondo y borde superior', () => {
    montar()
    const s = estilo(screen.getByTestId('pie'))
    expect(s.borderTopWidth).toBe(1)
    expect(typeof s.backgroundColor).toBe('string')
  })
})
