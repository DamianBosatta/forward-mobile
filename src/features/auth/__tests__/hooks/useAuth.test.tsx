import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/auth.store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mocks
jest.mock('../../store/auth.store', () => {
  const mockStore = {
    setTokens: jest.fn(),
    setUser: jest.fn(),
    logout: jest.fn(),
  };

  const useAuthStoreMock = jest.fn(() => mockStore) as any;
  useAuthStoreMock.getState = jest.fn(() => ({
    ...mockStore,
    accessToken: 'fake-token'
  }));

  return {
    useAuthStore: useAuthStoreMock,
    parsePermissionsFromArray: jest.fn((arr) => arr)
  };
});

jest.mock('@/core/api/client', () => ({
  configureApiClient: jest.fn(),
  API_URL: 'http://test-api.com'
}));

const queryClient = new QueryClient();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('deberia traducir invalid_grant a un mensaje amigable', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error_description: 'invalid_grant' })
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const success = await result.current.login('admin', '123');
      expect(success).toBe(false);
    });

    expect(result.current.error).toBe('Usuario o contraseña incorrectos.');
  });

  it('deberia traducir inactive a cuenta inactiva', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error_description: 'The user is inactive' })
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const success = await result.current.login('admin', '123');
      expect(success).toBe(false);
    });

    expect(result.current.error).toBe('El usuario se encuentra inactivo. Contactá al administrador.');
  });

  it('al entrar borra la caché que haya quedado en el teléfono de otro usuario', async () => {
    queryClient.setQueryData(['inicio', 'resumen'], { ventas: null, compras: null, autorizacionesPendientes: null });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r' }) })
      .mockResolvedValue({ ok: false, json: async () => ({}) });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      expect(await result.current.login('vendedor', '123')).toBe(true);
    });

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
