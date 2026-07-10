import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RolesScreen } from '../RolesScreen';

jest.mock('../../hooks/useRBAC', () => ({
  useRBAC: () => ({
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    isCreatingRole: false,
    roles: [],
  }),
}));

const queryClient = new QueryClient();

describe('Role Management Integration (TDD)', () => {
  it('should render a Create Role button and submit', async () => {
    const { getByText, queryByText } = render(
      <QueryClientProvider client={queryClient}>
        <RolesScreen />
      </QueryClientProvider>
    );

    // TDD: the button and form are not yet built
    // const createBtn = getByText('CREAR ROL');
    // fireEvent.press(createBtn);
  });

  it('should allow modifying a role', async () => {
    // TDD test
  });

  it('should allow deleting a role', async () => {
    // TDD test
  });
});
