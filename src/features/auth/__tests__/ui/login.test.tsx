/**
 * Ingreso (bloque 12, T2: lienzo M1 y TM13; D11; reglas mobile §15): usuario y contraseña o
 * huella, y el selector de servidor solo en la build de desarrollo.
 */
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginScreen from '../../../../../app/login';
import { useAuth } from '../../hooks/useAuth';

// LoginScreen uses useQueryClient() (to clear cache on API env switch), so it
// must render inside a QueryClientProvider.
const renderLogin = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginScreen />
    </QueryClientProvider>
  );
};

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace })
}));
jest.mock('@/core/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), notification: jest.fn(), selection: jest.fn() } }));

let mockResponsive = { isTablet: false };
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => mockResponsive }));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn()
}));

const mockBio = {
  available: false,
  saved: null as { username: string; password: string } | null,
  enabled: true,
};
const mockSaveCredentials = jest.fn();
const mockAuthenticate = jest.fn();
jest.mock('../../utils/biometrics', () => ({
  isBiometricsAvailable: async () => mockBio.available,
  getSavedCredentials: async () => mockBio.saved,
  isBiometricLoginEnabled: async () => mockBio.enabled,
  saveCredentials: (c: unknown) => mockSaveCredentials(c),
  authenticateWithBiometrics: () => mockAuthenticate(),
}));

function auth(extra: object = {}) {
  const login = jest.fn().mockResolvedValue(true);
  (useAuth as jest.Mock).mockReturnValue({ login, isLoading: false, error: null, isLocked: false, failedAttempts: 0, ...extra });
  return login;
}

const usuario = () => screen.getByLabelText('Usuario o email');
const contrasena = () => screen.getByLabelText('Contraseña');
const ingresar = () => screen.getByRole('button', { name: 'Ingresar' });

beforeEach(() => {
  jest.clearAllMocks();
  mockBio.available = false;
  mockBio.saved = null;
  mockBio.enabled = true;
  mockResponsive = { isTablet: false };
  mockAuthenticate.mockResolvedValue(null);
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

describe('Ingreso', () => {
  it('pide usuario o email y contraseña, y dice a quién pedir la contraseña olvidada', () => {
    auth();
    renderLogin();
    expect(usuario()).toBeTruthy();
    expect(contrasena()).toBeTruthy();
    expect(ingresar()).toBeTruthy();
    expect(screen.getByText('¿Olvidaste la contraseña? Pedila a tu administrador.')).toBeTruthy();
  });

  it('con los campos vacíos no llama al servidor y lo dice', async () => {
    const login = auth();
    renderLogin();
    fireEvent.press(ingresar());
    expect(await screen.findByText('Completá tu usuario y tu contraseña.')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('ingresa con lo escrito, guarda las credenciales para la huella y entra a la app', async () => {
    const login = auth();
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'secreta123');
    fireEvent.press(ingresar());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(login).toHaveBeenCalledWith('admin', 'secreta123');
    expect(mockSaveCredentials).toHaveBeenCalledWith({ username: 'admin', password: 'secreta123' });
  });

  it('con la huella apagada en Mi cuenta no guarda la contraseña en el teléfono', async () => {
    mockBio.enabled = false;
    auth();
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'secreta123');
    fireEvent.press(ingresar());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSaveCredentials).not.toHaveBeenCalled();
  });

  it('si el ingreso falla no guarda la contraseña ni entra', async () => {
    const login = auth();
    login.mockResolvedValue(false);
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'equivocada');
    fireEvent.press(ingresar());
    await waitFor(() => expect(login).toHaveBeenCalledWith('admin', 'equivocada'));
    expect(mockSaveCredentials).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('si el servidor rechaza, muestra el error y no entra', async () => {
    auth({ error: 'Usuario o contraseña incorrectos.' });
    renderLogin();
    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('avisa los intentos que quedan y bloquea el botón cuando se agotan', () => {
    auth({ failedAttempts: 3 });
    const { rerender } = renderLogin();
    expect(screen.getByText('Te quedan 2 intentos antes del bloqueo.')).toBeTruthy();

    auth({ isLocked: true, failedAttempts: 5 });
    rerender(<QueryClientProvider client={new QueryClient()}><LoginScreen /></QueryClientProvider>);
    expect(screen.getByRole('button', { name: 'Acceso bloqueado' })).toBeDisabled();
  });

  it('"Entrar con huella" aparece solo con huella disponible, prendida y credenciales guardadas', async () => {
    auth();
    mockBio.available = true;
    mockBio.saved = { username: 'admin', password: 'secreta123' };
    renderLogin();
    expect(await screen.findByRole('button', { name: 'Entrar con huella' })).toBeTruthy();
  });

  it('sin credenciales guardadas o con la huella apagada no ofrece la huella', async () => {
    auth();
    mockBio.available = true;
    mockBio.saved = { username: 'admin', password: 'secreta123' };
    mockBio.enabled = false;
    renderLogin();
    await waitFor(() => expect(mockAuthenticate).not.toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Entrar con huella' })).toBeNull();
  });

  it('entrar con huella ingresa con las credenciales guardadas', async () => {
    const login = auth();
    mockBio.available = true;
    mockBio.saved = { username: 'admin', password: 'secreta123' };
    mockAuthenticate.mockResolvedValue({ username: 'admin', password: 'secreta123' });
    renderLogin();
    await waitFor(() => expect(login).toHaveBeenCalledWith('admin', 'secreta123'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
  });

  it('en la build de desarrollo deja elegir el servidor', () => {
    auth();
    renderLogin();
    expect(screen.getByLabelText('Servidor')).toBeTruthy();
  });

  it('en las builds que van a los teléfonos no hay selector de servidor', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    auth();
    renderLogin();
    expect(screen.queryByLabelText('Servidor')).toBeNull();
    expect(screen.queryByText(/Local/)).toBeNull();
  });

  it('en tablet muestra la presentación al lado del formulario', () => {
    mockResponsive = { isTablet: true };
    auth();
    renderLogin();
    expect(screen.getByText('Vendé, cobrá y seguí tus pedidos desde la calle, con los mismos datos que la web.')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Ingresá' })).toBeTruthy();
    expect(ingresar()).toBeTruthy();
  });
});
