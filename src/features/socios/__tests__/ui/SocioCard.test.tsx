/**
 * SocioCard — contact-info rendering.
 *
 * Regression guard for the "SIN REGISTRO" bug: the list DTO (SocioListDto, aliased
 * as SocioComercial) was missing email/telefono/direccion, so the card — which read
 * those fields via a misleading `as SocioDetailDto` cast — always rendered
 * "SIN REGISTRO" even though the data existed. Now the list type carries the fields
 * and the card reads them directly. These tests render the REAL SocioCard with a
 * list item and assert the contact info shows (and falls back only when truly empty).
 */

import React from 'react'
import { render } from '@testing-library/react-native'
import { SocioCard } from '../../components/SocioCard'
import type { SocioComercial } from '@/libs/api-client/types'

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/core/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), notification: jest.fn() },
}))

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native')
  const entering = { duration: () => ({}) }
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: any) => c },
    View,
    FadeInUp: { delay: () => entering },
  }
})

// ── Test data ──────────────────────────────────────────────────────────────────

function makeSocio(overrides: Partial<SocioComercial> = {}): SocioComercial {
  return {
    id: 'socio-1',
    razonSocial: 'Acme S.A.',
    cuit: '30-12345678-9',
    tipo: 'Cliente',
    email: 'acme@acme.com',
    telefono: '+54 9 11 1234 5678',
    direccion: 'Av. Corrientes 1234, CABA',
    activo: true,
    saldoAmount: 15000,
    saldoCurrency: 'ARS',
    cuentaId: 'cuenta-1',
    ...overrides,
  } as SocioComercial
}

// ─────────────────────────────────────────────────────────────────────────────

describe('SocioCard — contact info', () => {
  it('shows email, phone and address from the list item', () => {
    const { getByText, queryByText } = render(<SocioCard item={makeSocio()} />)

    expect(getByText('acme@acme.com')).toBeTruthy()
    expect(getByText('+54 9 11 1234 5678')).toBeTruthy()
    expect(getByText('Av. Corrientes 1234, CABA')).toBeTruthy()
    // The bug symptom must NOT appear when data exists.
    expect(queryByText('SIN REGISTRO')).toBeNull()
  })

  it('falls back to "SIN REGISTRO" only when contact fields are empty', () => {
    const { getAllByText } = render(
      <SocioCard item={makeSocio({ email: '', telefono: '', direccion: '' })} />
    )
    // One placeholder per empty contact row (email, phone, address).
    expect(getAllByText('SIN REGISTRO')).toHaveLength(3)
  })

  it('renders the razón social (uppercased)', () => {
    const { getByText } = render(<SocioCard item={makeSocio({ razonSocial: 'Distribuidora Sur' })} />)
    expect(getByText('DISTRIBUIDORA SUR')).toBeTruthy()
  })
})
