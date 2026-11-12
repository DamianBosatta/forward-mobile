import fs from 'fs'
import path from 'path'

const raiz = path.join(__dirname, '../../../..')

describe('limpieza de la UI móvil (auditoría, tanda 6)', () => {
  it('no queda la pantalla "Módulo en Construcción" de socios/cuenta: la cuenta del socio es /(tabs)/cuentas/[id]', () => {
    expect(fs.existsSync(path.join(raiz, 'app/socios/cuenta/[id].tsx'))).toBe(false)
    expect(fs.existsSync(path.join(raiz, 'app/(tabs)/cuentas/[id].tsx'))).toBe(true)
  })
})

describe('componentes viejos sin uso (auditoría, tanda 6)', () => {
  it.each(['GlassCard', 'GodButton', 'KpiStatRow', 'TopHeaderActions', 'KpiCardMobile'])('%s ya no está en src/core/ui', (nombre) => {
    expect(fs.existsSync(path.join(raiz, `src/core/ui/${nombre}.tsx`))).toBe(false)
  })
})
