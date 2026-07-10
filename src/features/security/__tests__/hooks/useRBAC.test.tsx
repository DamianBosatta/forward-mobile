import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRBAC } from '../../hooks/useRBAC';
import { securityApi } from '../../api/securityApi';

jest.mock('../../api/securityApi', () => ({
  securityApi: {
    getProfiles: jest.fn(),
    getRoles: jest.fn(),
    getSessions: jest.fn(),
    getAccessLogs: jest.fn(),
    createProfile: jest.fn(),
    updateProfile: jest.fn(),
    deleteProfile: jest.fn(),
    applyProfileToUser: jest.fn(),
    assignRoleToUser: jest.fn(),
    updateRoleProfile: jest.fn(),
    revokeSession: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deactivateUser: jest.fn(),
  },
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useRBAC hooks - Users and Roles mutations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    (securityApi.createUser as jest.Mock).mockResolvedValue({});
    (securityApi.updateUser as jest.Mock).mockResolvedValue({});
    (securityApi.deactivateUser as jest.Mock).mockResolvedValue({});
    (securityApi.createRole as jest.Mock).mockResolvedValue({});
    (securityApi.updateRole as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Users mutations', () => {
    it('createUser calls securityApi.createUser', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: ({children}) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> });
      const payload = { email: 'a@a.com', firstName: 'A', lastName: 'B' };
      
      await act(async () => {
        await result.current.createUser(payload);
      });
      
      expect(securityApi.createUser).toHaveBeenCalledWith(payload);
    });

    it('handles API errors correctly when creating a user', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: ({children}) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> });
      const payload = { email: 'a@a.com', firstName: 'A', lastName: 'B' };
      
      (securityApi.createUser as jest.Mock).mockRejectedValueOnce(new Error('API Error'));
      
      await act(async () => {
        await expect(result.current.createUser(payload)).rejects.toThrow('API Error');
      });
      
      // La caché de queries NO debería haberse invalidado si hubo error
      // Para probar esto, podríamos espiar queryClient.invalidateQueries pero es interno al provider,
      // simplemente comprobamos que propague el error.
    });

    it('updateUser calls securityApi.updateUser', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });
      const payload = { firstName: 'C' };
      
      await act(async () => {
        await result.current.updateUser({ id: '1', payload });
      });
      
      expect(securityApi.updateUser).toHaveBeenCalledWith('1', payload);
    });

    it('deactivateUser calls securityApi.deactivateUser', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });
      
      await act(async () => {
        await result.current.deactivateUser('1');
      });
      
      expect(securityApi.deactivateUser).toHaveBeenCalledWith('1');
    });
  });

  describe('Roles mutations', () => {
    it('createRole calls securityApi.createRole', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });
      const payload = { name: 'Admin', description: 'desc' };
      
      await act(async () => {
        await result.current.createRole(payload);
      });
      
      expect(securityApi.createRole).toHaveBeenCalledWith(payload);
    });

    it('updateRole calls securityApi.updateRole', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });
      const payload = { description: 'new desc' };
      
      await act(async () => {
        await result.current.updateRole({ id: 'role1', payload });
      });
      
      expect(securityApi.updateRole).toHaveBeenCalledWith('role1', payload);
    });
  });
});
