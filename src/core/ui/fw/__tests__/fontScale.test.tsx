import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { FileText } from 'lucide-react-native'
import { maxFontScale } from '@/libs/theme'
import { BottomBar, Button, DocumentCard, Fab, Field, Stepper, TopBar } from '../index'
import { TEMAS, conTema, estilo } from '../__testing__/tema'

// Literal on purpose: a missing prop (undefined) must not pass by equalling a missing constant.
const TOPE = 1.3

afterEach(() => conTema('light'))

// A control with a fixed height cannot grow with the system font: its text carries the shared cap
// (`maxFontScale`), the single source for every `maxFontSizeMultiplier` in the app.
describe.each(TEMAS)('tope de escala de fuente en controles de alto fijo (%s)', (tema) => {
  beforeEach(() => conTema(tema))

  it('the shared cap is the 1.3 the mobile reference prescribes', () => {
    expect(maxFontScale).toBe(TOPE)
  })

  it('Button caps its label, md and xl', () => {
    render(
      <>
        <Button label="Confirmar" onPress={jest.fn()} />
        <Button label="Entregar" size="xl" onPress={jest.fn()} />
      </>,
    )
    expect(screen.getByText('Confirmar').props.maxFontSizeMultiplier).toBe(TOPE)
    expect(screen.getByText('Entregar').props.maxFontSizeMultiplier).toBe(TOPE)
  })

  it('Button keeps its height at the default font scale', () => {
    render(
      <>
        <Button label="Confirmar" onPress={jest.fn()} />
        <Button label="Entregar" size="xl" onPress={jest.fn()} />
      </>,
    )
    expect(estilo(screen.getByRole('button', { name: 'Confirmar' })).height).toBe(48)
    expect(estilo(screen.getByRole('button', { name: 'Entregar' })).height).toBe(72)
  })

  it('Fab caps its label', () => {
    render(<Fab accessibilityLabel="Nueva venta" label="Nueva venta" onPress={jest.fn()} />)
    expect(screen.getByText('Nueva venta').props.maxFontSizeMultiplier).toBe(TOPE)
  })

  it('BottomBar caps its item labels', () => {
    render(<BottomBar items={[{ key: 'a', label: 'Pedido', icon: FileText, onPress: jest.fn() }]} activeKey="a" />)
    expect(screen.getByText('Pedido').props.maxFontSizeMultiplier).toBe(TOPE)
  })

  it('TopBar caps the title, the labelled action and the tabs', () => {
    render(
      <TopBar
        title="Ventas"
        actions={[{ icon: FileText, accessibilityLabel: 'Transferir', label: 'Transferir', onPress: jest.fn() }]}
        tabs={[{ label: 'Hoy', selected: true, onPress: jest.fn() }]}
      />,
    )
    expect(screen.getByText('Ventas').props.maxFontSizeMultiplier).toBe(TOPE)
    expect(screen.getByText('Transferir').props.maxFontSizeMultiplier).toBe(TOPE)
    expect(screen.getByText('Hoy').props.maxFontSizeMultiplier).toBe(TOPE)
  })

  it('Field caps its fixed-height input and its prefix', () => {
    render(<Field label="Monto" prefijo="$" value="10" onChangeText={jest.fn()} />)
    expect(screen.getByLabelText('Monto').props.maxFontSizeMultiplier).toBe(TOPE)
    expect(screen.getByText('$').props.maxFontSizeMultiplier).toBe(TOPE)
  })

  it('Stepper caps its quantity', () => {
    render(<Stepper nombre="Aceite" value={3} max={5} onChange={jest.fn()} />)
    expect(screen.getByLabelText('Cantidad de Aceite: 3').props.maxFontSizeMultiplier).toBe(TOPE)
  })

  it('DocumentCard caps the avatar initials', () => {
    render(
      <DocumentCard
        numero="A1"
        vendedor="Emanuel Parraquini"
        direccion="Juan B. Justo 6376"
        nombre="Carlos"
        hora="10:03"
        importe={100}
        onPress={jest.fn()}
        chip={{ estado: 'confirmado', label: 'Confirmado' }}
      />,
    )
    expect(screen.getByText('EP').props.maxFontSizeMultiplier).toBe(TOPE)
  })
})
