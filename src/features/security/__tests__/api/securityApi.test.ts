import { buildPermissionProfilePayload, PermissionProfile, securityApi } from '../../api/securityApi'
import { api } from '@/src/core/api/client'

jest.mock('@/src/core/api/client', () => ({
  api: {
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
  },
}))

describe('securityApi - Permission Profiles', () => {
  it('omits detail ids so the backend can generate valid GUIDs', () => {
    const profile: PermissionProfile = {
      id: '4e2f5163-f94c-4845-852c-a420d5fb46b5',
      nombre: 'Deposito',
      descripcion: 'Perfil de deposito',
      activo: true,
      roleName: 'Deposito',
      detalles: [
        {
          id: 'local-MOD_STOCK',
          module: 'MOD_STOCK',
          canRead: true,
          canCreate: true,
          canUpdate: true,
          canDelete: false,
        },
      ],
    }

    const payload = buildPermissionProfilePayload(profile)

    expect(payload).toEqual({
      nombre: 'Deposito',
      descripcion: 'Perfil de deposito',
      activo: true,
      detalles: [
        {
          module: 'MOD_STOCK',
          canRead: true,
          canCreate: true,
          canUpdate: true,
          canDelete: false,
        },
      ],
    })
    expect(payload.detalles[0]).not.toHaveProperty('id')
  })

  it('does not let client-only profile fields leak into the save contract', () => {
    const payload = buildPermissionProfilePayload({
      id: 'profile-id',
      nombre: '  Deposito  ',
      descripcion: '  ',
      activo: true,
      roleName: 'Deposito',
      detalles: [],
    })

    expect(payload).toEqual({
      nombre: 'Deposito',
      descripcion: undefined,
      activo: true,
      detalles: [],
    })
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('roleName')
  })
})

describe('securityApi - Users and Roles', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Users', () => {
    it('createUser calls POST /api/v1/Users with payload', async () => {
      const payload = { email: 'test@test.com', firstName: 'John', lastName: 'Doe' }
      await securityApi.createUser(payload)
      expect(api.post).toHaveBeenCalledWith('/api/v1/Users', payload)
    })

    it('createUser throws error on API failure', async () => {
      const payload = { email: 'test@test.com', firstName: 'John', lastName: 'Doe' }
      const error = new Error('Server Error');
      (api.post as jest.Mock).mockRejectedValueOnce(error);
      await expect(securityApi.createUser(payload)).rejects.toThrow('Server Error');
    })

    it('updateUser calls PUT /api/v1/Users/{id} with payload', async () => {
      const payload = { firstName: 'Jane' }
      await securityApi.updateUser('123', payload)
      expect(api.put).toHaveBeenCalledWith('/api/v1/Users/123', payload)
    })

    it('deactivateUser calls PATCH /api/v1/Users/{id}/deactivate', async () => {
      await securityApi.deactivateUser('123')
      expect(api.patch).toHaveBeenCalledWith('/api/v1/Users/123/deactivate', {})
    })
  })

  describe('Roles', () => {
    it('createRole calls POST /api/v1/Roles with payload', async () => {
      const payload = { name: 'Admin', description: 'Administrator' }
      await securityApi.createRole(payload)
      expect(api.post).toHaveBeenCalledWith('/api/v1/Roles', payload)
    })

    it('createRole throws error on API failure', async () => {
      const payload = { name: 'Admin', description: 'Administrator' }
      const error = new Error('Permission Denied');
      (api.post as jest.Mock).mockRejectedValueOnce(error);
      await expect(securityApi.createRole(payload)).rejects.toThrow('Permission Denied');
    })

    it('updateRole calls PUT /api/v1/Roles/{id} with payload', async () => {
      const payload = { description: 'New description' }
      await securityApi.updateRole('role-123', payload)
      expect(api.put).toHaveBeenCalledWith('/api/v1/Roles/role-123', payload)
    })
  })
})
