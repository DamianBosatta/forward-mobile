import React from 'react'
import { Text } from 'react-native'
import { render, screen, userEvent } from '@testing-library/react-native'
import { useThemeStore } from '@/libs/theme'
import { EstadoDePantalla } from '@/core/ui/fw/EstadoDePantalla'
import { EstadoDeConsulta, esqueletoDeFilas } from '../EstadoDeConsulta'

const base = { tituloError: 'No pudimos cargar el stock', tituloVacio: 'No hay productos.' }
const datos = <Text>con datos</Text>

describe.each(['light', 'dark'] as const)('EstadoDeConsulta (%s)', (modo) => {
  beforeEach(() => { useThemeStore.setState({ mode: modo }) })

  it('cargando: esqueleto quieto con "Cargando" y sin los datos', () => {
    render(<EstadoDeConsulta {...base} cargando>{datos}</EstadoDeConsulta>)
    expect(screen.getByRole('progressbar', { name: 'Cargando' })).toBeTruthy()
    expect(screen.getAllByTestId('esqueleto-fila')).toHaveLength(3)
    expect(screen.queryByText('con datos')).toBeNull()
  })

  it('esqueleto propio: usa los bloques que le pasan', () => {
    render(<EstadoDeConsulta {...base} cargando esqueleto={esqueletoDeFilas(2, 40)}>{datos}</EstadoDeConsulta>)
    expect(screen.getAllByTestId('esqueleto-fila')).toHaveLength(2)
  })

  it('falla de red: "sin conexión" con Reintentar', async () => {
    const reintentar = jest.fn()
    render(<EstadoDeConsulta {...base} cargando={false} error={new TypeError('Network request failed')} onReintentar={reintentar}>{datos}</EstadoDeConsulta>)
    expect(screen.getByText('No pudimos cargar el stock')).toBeTruthy()
    expect(screen.getByText(/no hay señal/)).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reintentar).toHaveBeenCalledTimes(1)
  })

  it('sinConexion sin error (consulta en pausa): "sin conexión" con Reintentar', async () => {
    const reintentar = jest.fn()
    render(<EstadoDeConsulta {...base} cargando={false} sinConexion onReintentar={reintentar}>{datos}</EstadoDeConsulta>)
    expect(screen.getByText(/no hay señal/)).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reintentar).toHaveBeenCalledTimes(1)
  })

  it('otro error: estado "error" con Reintentar, sin hablar de señal', async () => {
    const reintentar = jest.fn()
    render(<EstadoDeConsulta {...base} cargando={false} error={new Error('boom')} onReintentar={reintentar}>{datos}</EstadoDeConsulta>)
    expect(screen.getByText(/Algo salió mal de nuestro lado/)).toBeTruthy()
    expect(screen.queryByText(/no hay señal/)).toBeNull()
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reintentar).toHaveBeenCalledTimes(1)
  })

  it('vacío: título y texto propios', () => {
    render(<EstadoDeConsulta {...base} cargando={false} vacio textoVacio="Probá con otro filtro.">{datos}</EstadoDeConsulta>)
    expect(screen.getByRole('header', { name: 'No hay productos.' })).toBeTruthy()
    expect(screen.getByText('Probá con otro filtro.')).toBeTruthy()
  })

  it('con datos: muestra los hijos', () => {
    render(<EstadoDeConsulta {...base} cargando={false}>{datos}</EstadoDeConsulta>)
    expect(screen.getByText('con datos')).toBeTruthy()
  })
})

describe('EstadoDePantalla error', () => {
  it('tipo error: título y texto de siempre', () => {
    render(<EstadoDePantalla tipo="error" titulo="No pudimos cargar" />)
    expect(screen.getByRole('header', { name: 'No pudimos cargar' })).toBeTruthy()
    expect(screen.getByText('Algo salió mal de nuestro lado. Probá de nuevo en un rato.')).toBeTruthy()
  })
})
