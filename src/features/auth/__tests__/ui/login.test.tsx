/**
 * Ingreso (bloque 12, T2: lienzo M1 y TM13; D11; reglas mobile §15): usuario y contraseña o
 * huella, y el selector de servidor solo en la build de desarrollo.
 */
import React from 'react';
import { act } from '@testing-library/react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginScreen from '../../../../../app/login';
import { useAuth } from '../../hooks/useAuth';
import { useOfertaDeHuella } from '../../store/ofertaDeHuella.store';

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

// El ingreso usa la marca del diseño (flecha sobre el círculo verde): si renderiza el logo viejo, falla.
jest.mock('@/core/ui/ForwardLogo', () => ({ ForwardLogo: () => { throw new Error('ForwardLogo viejo'); } }));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace })
}));
jest.mock('@/core/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), notification: jest.fn(), selection: jest.fn() } }));

let mockResponsive = { isTablet: false };
jest.mock('@/libs/useResponsive', () => ({ useResponsive: () => mockResponsive }));

let mockRed: (e: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void = () => {};
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: (cb: typeof mockRed) => { mockRed = cb; return () => {}; } },
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn()
}));

const mockBio = {
  available: false,
  saved: false,
  choice: null as 'enabled' | 'disabled' | null,
};
const mockSaveCredentials = jest.fn();
const mockAuthenticate = jest.fn();
jest.mock('../../utils/biometrics', () => ({
  isBiometricsAvailable: async () => mockBio.available,
  hasSavedCredentials: async () => mockBio.saved,
  getBiometricChoice: async () => mockBio.choice,
  isBiometricLoginEnabled: async () => mockBio.choice === 'enabled',
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
  mockBio.saved = false;
  mockBio.choice = null;
  useOfertaDeHuella.getState().descartar();
  mockResponsive = { isTablet: false };
  mockAuthenticate.mockResolvedValue(null);
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

describe('Ingreso', () => {
  it('muestra el encabezado del diseño (marca con flecha, "Forward" y la frase) y no el logo viejo', () => {
    auth();
    renderLogin();
    expect(screen.getByRole('header', { name: 'Forward' })).toBeTruthy();
    expect(screen.getByText('Entrá con el mismo usuario de la web.')).toBeTruthy();
    expect(screen.getByTestId('login-marca', { includeHiddenElements: true })).toBeTruthy();
  });

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

  it('ingresa con lo escrito y entra a la app; sin decisión no guarda la contraseña y ofrece la huella', async () => {
    const login = auth();
    mockBio.available = true;
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'secreta123');
    fireEvent.press(ingresar());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(login).toHaveBeenCalledWith('admin', 'secreta123');
    expect(mockSaveCredentials).not.toHaveBeenCalled();
    expect(useOfertaDeHuella.getState().pendiente).toEqual({ username: 'admin', password: 'secreta123' });
  });

  it('con la huella aceptada guarda las credenciales al ingresar con contraseña', async () => {
    mockBio.available = true;
    mockBio.choice = 'enabled';
    auth();
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'secreta123');
    fireEvent.press(ingresar());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSaveCredentials).toHaveBeenCalledWith({ username: 'admin', password: 'secreta123' });
    expect(useOfertaDeHuella.getState().pendiente).toBeNull();
  });

  it('con la huella rechazada no guarda la contraseña ni vuelve a preguntar', async () => {
    mockBio.available = true;
    mockBio.choice = 'disabled';
    auth();
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'secreta123');
    fireEvent.press(ingresar());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSaveCredentials).not.toHaveBeenCalled();
    expect(useOfertaDeHuella.getState().pendiente).toBeNull();
  });

  it('sin huella en el teléfono no pregunta', async () => {
    auth();
    renderLogin();
    fireEvent.changeText(usuario(), 'admin');
    fireEvent.changeText(contrasena(), 'secreta123');
    fireEvent.press(ingresar());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(useOfertaDeHuella.getState().pendiente).toBeNull();
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
    expect(useOfertaDeHuella.getState().pendiente).toBeNull();
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

  it('"Entrar con huella" aparece con huella disponible, aceptada y guardada, y no se dispara sola', async () => {
    auth();
    mockBio.available = true;
    mockBio.saved = true;
    mockBio.choice = 'enabled';
    renderLogin();
    expect(await screen.findByRole('button', { name: 'Entrar con huella' })).toBeTruthy();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('sin decisión, rechazada o sin credencial guardada no muestra el botón', async () => {
    auth();
    mockBio.available = true;
    mockBio.saved = true;
    mockBio.choice = null;
    const { unmount } = renderLogin();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Entrar con huella' })).toBeNull();
    unmount();

    mockBio.choice = 'disabled';
    const otra = renderLogin();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Entrar con huella' })).toBeNull();
    otra.unmount();

    mockBio.choice = 'enabled';
    mockBio.saved = false;
    renderLogin();
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Entrar con huella' })).toBeNull();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('tocar "Entrar con huella" pide la huella e ingresa con las credenciales guardadas', async () => {
    const login = auth();
    mockBio.available = true;
    mockBio.saved = true;
    mockBio.choice = 'enabled';
    mockAuthenticate.mockResolvedValue({ username: 'admin', password: 'secreta123' });
    renderLogin();
    fireEvent.press(await screen.findByRole('button', { name: 'Entrar con huella' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('admin', 'secreta123'));
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
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
  it('sin conexión avisa y apaga "Ingresar" y la huella; al volver la red se reactivan', async () => {
    mockBio.available = true;
    mockBio.saved = true;
    mockBio.choice = 'enabled';
    auth();
    renderLogin();
    const huella = await screen.findByRole('button', { name: 'Entrar con huella' });
    act(() => mockRed({ isConnected: false, isInternetReachable: false }));
    expect(screen.getByText('Sin conexión. Conectate a internet para ingresar; se reintenta solo.')).toBeTruthy();
    expect(ingresar().props.accessibilityState).toMatchObject({ disabled: true });
    expect(huella.props.accessibilityState).toMatchObject({ disabled: true });
    act(() => mockRed({ isConnected: true, isInternetReachable: true }));
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
    expect(ingresar().props.accessibilityState).not.toMatchObject({ disabled: true });
  });

  it('un estado de red desconocido no apaga el ingreso', () => {
    auth();
    renderLogin();
    act(() => mockRed({ isConnected: true, isInternetReachable: null }));
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
  });

  it('con error del servidor marca los dos campos en rojo', () => {
    auth({ error: 'Usuario o contraseña incorrectos' });
    renderLogin();
    const borde = (el: { parent: any }) => {
      let n = el.parent;
      while (n && !(n.props.style && [].concat(n.props.style).flat().some((x: any) => x && x.borderWidth))) n = n.parent;
      return [].concat(n.props.style).flat().find((x: any) => x && x.borderWidth);
    };
    expect(borde(usuario())).toMatchObject({ borderWidth: 2, borderColor: '#A90F0F' });
    expect(borde(contrasena())).toMatchObject({ borderWidth: 2, borderColor: '#A90F0F' });
  });
});
