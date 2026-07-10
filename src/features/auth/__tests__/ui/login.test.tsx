import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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

// Mock dependencias complejas de UI y Expo
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() })
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn()
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
}));

// Mock del hook de Auth
jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn()
}));

// Mock Moti y Reanimated para simplificar tests
jest.mock('moti', () => ({
  MotiView: ({ children }: any) => <>{children}</>,
  MotiText: ({ children }: any) => <>{children}</>
}));

describe('LoginScreen UI', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      login: jest.fn(),
      isLoading: false,
      error: null,
      isLocked: false,
      failedAttempts: 0
    });
  });

  it('deberia renderizar los inputs de usuario y contraseña', () => {
    const { getByPlaceholderText } = renderLogin();

    expect(getByPlaceholderText('ej: administrador')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('deberia mostrar alerta si los campos estan vacios al ingresar', async () => {
    const { getByText } = renderLogin();

    // Buscar el boton "INGRESAR AL SISTEMA"
    const loginButton = getByText('INGRESAR AL SISTEMA');
    fireEvent.press(loginButton);

    // Como usamos ConfirmModal interno, deberia aparecer el titulo CAMPO REQUERIDO
    await waitFor(() => {
      expect(getByText('CAMPO REQUERIDO')).toBeTruthy();
    });
  });

  it('deberia llamar a login con los datos ingresados', async () => {
    const mockLogin = jest.fn().mockResolvedValue(true);
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      isLocked: false,
      failedAttempts: 0
    });

    const { getByPlaceholderText, getByText } = renderLogin();

    fireEvent.changeText(getByPlaceholderText('ej: administrador'), 'admin');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'secreta123');
    
    fireEvent.press(getByText('INGRESAR AL SISTEMA'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'secreta123');
    });
  });
});
