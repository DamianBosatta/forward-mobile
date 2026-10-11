import React from 'react'
import { act, render, screen } from '@testing-library/react-native'
import { FileText } from 'lucide-react-native'
import { themeColors, type ChipEstado } from '@/libs/theme'
import { BottomBar, Button, DocumentCard, Fab, Field, Notice, Segmented, StatusChip, TopBar, TotalsRow } from '../index'
import { TEMAS, conTema, estilo } from '../__testing__/tema'


afterEach(() => conTema('light'))

const ESTADOS: [ChipEstado, string][] = [
  ['confirmado', 'Confirmado'],
  ['pendiente', 'Pendiente'],
  ['porAutorizar', 'Por autorizar'],
  ['enCurso', 'En curso'],
  ['entregado', 'Entregado'],
  ['anulado', 'Anulado'],
]

// Barrido: cada componente base toma el color del tema activo, no uno fijo.
// Se renderiza en claro, se cambia el modo con el store y se vuelve a leer:
// el color tiene que moverse al valor del otro tema.
describe.each(TEMAS)('tema %s: los componentes base toman los colores del tema', (tema) => {
  const c = themeColors[tema]
  beforeEach(() => conTema(tema))

  it('StatusChip en los 6 estados', () => {
    render(
      <>
        {ESTADOS.map(([estado]) => (
          <StatusChip key={estado} estado={estado} />
        ))}
      </>,
    )
    for (const [estado] of ESTADOS) {
      const chip = screen.getAllByLabelText(/^Estado: /)[ESTADOS.findIndex(([e]) => e === estado)]
      expect(estilo(chip).backgroundColor).toBe(c.chip[estado].bg)
    }
  })

  it('Notice en sus cuatro tonos usa el fondo suave del tema', () => {
    render(
      <>
        <Notice tone="info" testID="n-info">a</Notice>
        <Notice tone="advertencia" testID="n-adv">b</Notice>
        <Notice tone="peligro" testID="n-pel">c</Notice>
        <Notice tone="exito" testID="n-exi">d</Notice>
      </>,
    )
    expect(estilo(screen.getByTestId('n-info')).backgroundColor).toBe(c.chip.enCurso.bg)
    expect(estilo(screen.getByTestId('n-adv')).backgroundColor).toBe(c.chip.porAutorizar.bg)
    expect(estilo(screen.getByTestId('n-pel')).backgroundColor).toBe(c.chip.anulado.bg)
    expect(estilo(screen.getByTestId('n-exi')).backgroundColor).toBe(c.chip.entregado.bg)
    expect(estilo(screen.getByText('a')).color).toBe(c.text)
  })

  it('Field con error pinta el borde y el mensaje con el rojo del tema', () => {
    render(<Field label="Cantidad" error="Falta la cantidad" value="" onChangeText={jest.fn()} />)
    expect(estilo(screen.getByLabelText('Cantidad')).borderColor).toBe(c.chip.anulado.text)
    expect(estilo(screen.getByText('Falta la cantidad')).color).toBe(c.chip.anulado.text)
    expect(estilo(screen.getByText('Cantidad')).color).toBe(c.text)
  })

  it('Button primario, TotalsRow, Fab y Segmented', () => {
    render(
      <>
        <Button label="Confirmar" onPress={jest.fn()} />
        <TotalsRow label="Total" importe={100} destacado />
        <Fab accessibilityLabel="Nueva" onPress={jest.fn()} />
        <Segmented
          accessibilityLabel="Modo"
          options={[{ value: 'a', label: 'Uno' }, { value: 'b', label: 'Dos' }]}
          value="a"
          onChange={jest.fn()}
        />
      </>,
    )
    expect(estilo(screen.getByRole('button', { name: 'Confirmar' })).backgroundColor).toBe(c.action)
    expect(estilo(screen.getByText('Total')).color).toBe(c.text)
    expect(estilo(screen.getByRole('button', { name: 'Nueva' })).backgroundColor).toBe(c.action)
    expect(estilo(screen.getByRole('radio', { name: 'Uno' })).backgroundColor).toBe(c.surface)
    expect(estilo(screen.getByRole('radio', { name: 'Dos' })).backgroundColor).toBe('transparent')
  })

  it('TopBar, BottomBar y DocumentCard', () => {
    render(
      <>
        <TopBar title="Inicio" leading={{ kind: 'menu', onPress: jest.fn() }} />
        <BottomBar
          items={[
            { key: 'a', label: 'Presupuesto', icon: FileText, onPress: jest.fn() },
            { key: 'b', label: 'Pedido', icon: FileText, onPress: jest.fn() },
          ]}
          activeKey="b"
        />
        <DocumentCard
          numero="A1"
          vendedor="Ana López"
          direccion="Av. Siempreviva 742"
          nombre="Ana"
          hora="10:03"
          importe={10}
          chip={{ estado: 'confirmado', label: 'Confirmado' }}
          onPress={jest.fn()}
        />
      </>,
    )
    expect(estilo(screen.getByRole('header')).color).toBe(c.onTopBarStrong)
    expect(estilo(screen.getByText('Pedido')).color).toBe(c.brandInk)
    expect(estilo(screen.getByText('Presupuesto')).color).toBe(c.text)
    expect(estilo(screen.getByRole('button', { name: /Av\. Siempreviva/ })).backgroundColor).toBe(c.surface)
  })
})

describe('cambio de modo en vivo', () => {
  it('al pasar de claro a oscuro con el store, los componentes ya montados cambian de color', () => {
    // Se comparan tokens que difieren entre temas (action es el mismo teal en los dos).
    expect(themeColors.dark.text).not.toBe(themeColors.light.text)
    expect(themeColors.dark.chip.entregado.bg).not.toBe(themeColors.light.chip.entregado.bg)
    conTema('light')
    render(
      <>
        <Field label="Cantidad" value="" onChangeText={jest.fn()} />
        <Notice tone="exito" testID="n">listo</Notice>
      </>,
    )
    const etiqueta = () => estilo(screen.getByText('Cantidad')).color
    const aviso = () => estilo(screen.getByTestId('n')).backgroundColor
    expect(etiqueta()).toBe(themeColors.light.text)
    expect(aviso()).toBe(themeColors.light.chip.entregado.bg)
    act(() => conTema('dark'))
    expect(etiqueta()).toBe(themeColors.dark.text)
    expect(aviso()).toBe(themeColors.dark.chip.entregado.bg)
  })
})
