jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '2.3.0' } } }))
const mockUpdates: { updateId: string | null } = { updateId: null }
jest.mock('expo-updates', () => ({ get updateId() { return mockUpdates.updateId } }))
import { versionDeCache } from '../versionDeCache'

describe('versionDeCache (buster de la caché guardada)', () => {
  it('une la versión de la app con el id de la actualización OTA', () => {
    mockUpdates.updateId = 'abc-123'
    expect(versionDeCache()).toBe('2.3.0+abc-123')
  })
  it('sin actualización OTA usa la embebida; cambiar el id cambia el buster', () => {
    mockUpdates.updateId = null
    const a = versionDeCache()
    mockUpdates.updateId = 'otra'
    expect(a).toBe('2.3.0+embebida')
    expect(versionDeCache()).not.toBe(a)
  })
})
