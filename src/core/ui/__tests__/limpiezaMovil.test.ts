import fs from 'fs'
import path from 'path'

const raiz = path.join(__dirname, '../../../..')

describe('limpieza de la UI móvil (auditoría, tanda 6)', () => {
  it('no queda la pantalla "Módulo en Construcción" de socios/cuenta: la cuenta del socio es /(tabs)/cuentas/[id]', () => {
    expect(fs.existsSync(path.join(raiz, 'app/socios/cuenta/[id].tsx'))).toBe(false)
    expect(fs.existsSync(path.join(raiz, 'app/(tabs)/cuentas/[id].tsx'))).toBe(true)
  })
})
