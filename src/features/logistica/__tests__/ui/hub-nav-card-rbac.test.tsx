/**
 * hub-nav-card-rbac.test.tsx — RBAC gating tests for the logistics hub.
 *
 * Verifies two invariants:
 *   1. HubNavCard renders null when visible=false (used for mgmt-only cards)
 *   2. isMgmtRole correctly gates management-only cards based on the user's roles
 *
 * Design intent: a non-management user (e.g. Empleado with MOD_VIAJES:read)
 * must NOT see the Vehículos or Planificar Viaje nav cards. Management roles
 * (Administrador, AdministradorSistemas, Gerencia) must see all four cards.
 *
 * Tests follow the project pattern: mock native/theme hooks, test behavioral
 * invariants (not implementation details).
 */

import React from 'react'
import { render } from '@testing-library/react-native'
import { HubNavCard } from '../../components/hub/HubNavCard'
import { isMgmtRole } from '../../lib/rbac'
import { Truck } from 'lucide-react-native'

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/libs/theme', () => ({
  useColors: () => ({
    primary: '#00d1c1',
    surface: '#ffffff',
    bg: '#f5f5f5',
    border: '#e0e0e0',
    text: '#000000',
    textMuted: '#666666',
    surface2: '#e2e8f0',
    textSecondary: '#475569',
    textDisabled: '#64748b',
    info: '#3b82f6',
    danger: '#ef4444',
  }),
  tokens: {
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    radius: { sm: 8, md: 12, lg: 16 },
  },
  BRAND: {
    violet: '#8b5cf6',
    green: '#22c55e',
    red: '#ef4444',
    lime: '#a3e635',
  },
}))

jest.mock('@/core/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), notification: jest.fn() },
}))

// GlassCard is a styled View — mock it so we don't need the full native module tree
jest.mock('@/core/ui', () => {
  const { View } = require('react-native')
  return {
    GlassCard: ({ children, style }: any) => <View style={style}>{children}</View>,
    RequirePermission: ({ children }: any) => <>{children}</>,
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// HubNavCard — visible prop gating
// ─────────────────────────────────────────────────────────────────────────────

describe('HubNavCard — visibility gating', () => {
  const baseProps = {
    title: 'Vehículos',
    subtitle: 'ABM de la flota',
    icon: Truck,
    onPress: jest.fn(),
  }

  it('renders null when visible is false', () => {
    const { toJSON } = render(<HubNavCard {...baseProps} visible={false} />)
    expect(toJSON()).toBeNull()
  })

  it('renders the card when visible is true', () => {
    const { getByText } = render(<HubNavCard {...baseProps} visible={true} />)
    expect(getByText('Vehículos')).toBeTruthy()
  })

  it('renders the card when visible is omitted (defaults to true)', () => {
    const { getByText } = render(<HubNavCard {...baseProps} />)
    expect(getByText('Vehículos')).toBeTruthy()
  })

  it('shows the subtitle when provided', () => {
    const { getByText } = render(<HubNavCard {...baseProps} visible />)
    expect(getByText('ABM de la flota')).toBeTruthy()
  })

  it('renders without subtitle when omitted', () => {
    const { getByText, queryByText } = render(
      <HubNavCard title="Picking" icon={Truck} onPress={jest.fn()} visible />,
    )
    expect(getByText('Picking')).toBeTruthy()
    expect(queryByText('ABM de la flota')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isMgmtRole — role-based gate for management-only hub cards
// ─────────────────────────────────────────────────────────────────────────────

describe('isMgmtRole — management card gate', () => {
  it('returns false for an empty role list', () => {
    expect(isMgmtRole([])).toBe(false)
  })

  it('returns false for a non-management role (Empleado)', () => {
    expect(isMgmtRole(['Empleado'])).toBe(false)
  })

  it('returns false for a non-management role (Vendedor)', () => {
    expect(isMgmtRole(['Vendedor'])).toBe(false)
  })

  it('returns true for Administrador', () => {
    expect(isMgmtRole(['Administrador'])).toBe(true)
  })

  it('returns true for AdministradorSistemas', () => {
    expect(isMgmtRole(['AdministradorSistemas'])).toBe(true)
  })

  it('returns true for Gerencia', () => {
    expect(isMgmtRole(['Gerencia'])).toBe(true)
  })

  it('returns true when management role is mixed with non-management roles', () => {
    expect(isMgmtRole(['Empleado', 'Administrador'])).toBe(true)
  })

  it('returns false when only non-management roles are present (multiple)', () => {
    expect(isMgmtRole(['Empleado', 'Vendedor'])).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: non-management user does NOT see mgmt-only cards
// ─────────────────────────────────────────────────────────────────────────────

describe('Hub RBAC integration — non-management user', () => {
  const NON_MGMT_ROLES = ['Empleado']

  it('Vehículos card is NOT visible for a non-management user', () => {
    const isMgmt = isMgmtRole(NON_MGMT_ROLES)
    const { toJSON } = render(
      <HubNavCard title="Vehículos" icon={Truck} onPress={jest.fn()} visible={isMgmt} />,
    )
    expect(toJSON()).toBeNull()
  })

  it('Planificar Viaje card is NOT visible for a non-management user', () => {
    const isMgmt = isMgmtRole(NON_MGMT_ROLES)
    const { toJSON } = render(
      <HubNavCard title="Planificar Viaje" icon={Truck} onPress={jest.fn()} visible={isMgmt} />,
    )
    expect(toJSON()).toBeNull()
  })
})

describe('Hub RBAC integration — management user', () => {
  const MGMT_ROLES = ['Administrador']

  it('Vehículos card IS visible for a management user', () => {
    const isMgmt = isMgmtRole(MGMT_ROLES)
    const { getByText } = render(
      <HubNavCard title="Vehículos" icon={Truck} onPress={jest.fn()} visible={isMgmt} />,
    )
    expect(getByText('Vehículos')).toBeTruthy()
  })

  it('Planificar Viaje card IS visible for a management user', () => {
    const isMgmt = isMgmtRole(MGMT_ROLES)
    const { getByText } = render(
      <HubNavCard title="Planificar Viaje" icon={Truck} onPress={jest.fn()} visible={isMgmt} />,
    )
    expect(getByText('Planificar Viaje')).toBeTruthy()
  })
})
