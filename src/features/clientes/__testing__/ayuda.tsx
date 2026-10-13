import React from 'react'
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth.store'
import type { SocioListDto } from '@/libs/api-client/types'

/** Render con un react-query real y sin reintentos (un error del servidor se ve enseguida). */
export function renderConQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

/** Usuario logueado con estos permisos (módulos y capacidades, como los manda el servidor). */
export function conPermisos(permisos: { module: string; canRead?: boolean; canCreate?: boolean; canUpdate?: boolean }[]) {
  useAuthStore.setState({
    user: { id: 'u1', username: 'vendedor', email: 'v@x.com', roles: ['Empleado'], permissions: permisos } as never,
  })
}

export function clienteDeLista(extra: Partial<SocioListDto> = {}): SocioListDto {
  return {
    id: 'c1',
    razonSocial: 'Graciela Ruiz',
    cuit: '27-24389156-3',
    tipo: 'Cliente',
    condicionIva: 'Monotributo',
    email: '',
    telefono: '1146582291',
    direccion: 'Av. del Valle 89',
    nombreFantasia: 'Kiosco Chela',
    nombreContacto: 'Chela',
    displayName: 'Av. del Valle 89 - Kiosco Chela',
    esProvisorio: false,
    requiereCompletar: false,
    activo: true,
    saldoAmount: 186420,
    saldoTstAmount: 0,
    saldoNormalAmount: 186420,
    esPropio: true,
    puedeVerSaldo: true,
    puedeVerCuentaCorriente: true,
    puedeEditar: true,
    deLaCasa: false,
    tieneDeudaVencida: false,
    deudaVencidaAmount: 0,
    ...extra,
  }
}

export function pagina<T>(items: T[], totalCount: number) {
  return { items, page: 1, pageSize: 20, totalCount, totalPages: 1, hasNextPage: false }
}
