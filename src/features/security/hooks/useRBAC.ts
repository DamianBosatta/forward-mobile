import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { securityApi, PermissionProfile, Role } from '../api/securityApi';

export const rbacKeys = {
  all: ['rbac'] as const,
  profiles: () => [...rbacKeys.all, 'profiles'] as const,
  profile: (id: string) => [...rbacKeys.profiles(), id] as const,
  roles: () => [...rbacKeys.all, 'roles'] as const,
  role: (id: string) => [...rbacKeys.roles(), id] as const,
  sessions: () => [...rbacKeys.all, 'sessions'] as const,
  logs: () => [...rbacKeys.all, 'logs'] as const,
};

export const useRBAC = () => {
  const queryClient = useQueryClient();

  // Queries
  const profilesQuery = useQuery({
    queryKey: rbacKeys.profiles(),
    queryFn: securityApi.getProfiles,
  });

  const rolesQuery = useQuery({
    queryKey: rbacKeys.roles(),
    queryFn: securityApi.getRoles,
  });

  const sessionsQuery = useQuery({
    queryKey: rbacKeys.sessions(),
    queryFn: securityApi.getSessions,
  });

  const logsQuery = useQuery({
    queryKey: rbacKeys.logs(),
    queryFn: () => securityApi.getAccessLogs(10),
  });

  // Mutations
  const createProfileMutation = useMutation({
    mutationFn: securityApi.createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.profiles() });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, profile }: { id: string; profile: Partial<PermissionProfile> }) =>
      securityApi.updateProfile(id, profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.profiles() });
    },
  });
  
  const deleteProfileMutation = useMutation({
    mutationFn: (id: string) => securityApi.deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.profiles() });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: (payload: import('../api/securityApi').CreateRolePayload) => securityApi.createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: import('../api/securityApi').UpdateRolePayload }) =>
      securityApi.updateRole(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => securityApi.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
    },
  });

  // Users mutations
  const createUserMutation = useMutation({
    mutationFn: (payload: import('../api/securityApi').CreateUserPayload) => securityApi.createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: import('../api/securityApi').UpdateUserPayload }) =>
      securityApi.updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: (id: string) => securityApi.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });

  const applyProfileMutation = useMutation({
    mutationFn: ({ profileId, userId }: { profileId: string; userId: string }) =>
      securityApi.applyProfileToUser(profileId, userId),
    onSuccess: () => {
      // Invalidate both rbac and users to reflect changes
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) =>
      securityApi.assignRoleToUser(userId, roleName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });

  const updateRoleProfileMutation = useMutation({
    mutationFn: ({ roleId, profileId }: { roleId: string; profileId: string }) =>
      securityApi.updateRoleProfile(roleId, profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.roles() });
      queryClient.invalidateQueries({ queryKey: rbacKeys.profiles() });
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (tokenId: string) => securityApi.revokeSession(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacKeys.sessions() });
    },
  });

  return {
    // Data
    profiles: profilesQuery.data ?? [],
    roles: rolesQuery.data ?? [],
    sessions: sessionsQuery.data ?? [],
    logs: logsQuery.data ?? [],
    
    // Status
    isLoading: profilesQuery.isLoading || rolesQuery.isLoading || sessionsQuery.isLoading || logsQuery.isLoading,
    isError: profilesQuery.isError || rolesQuery.isError,

    // Actions
    createProfile: createProfileMutation.mutateAsync,
    updateProfile: updateProfileMutation.mutateAsync,
    deleteProfile: deleteProfileMutation.mutateAsync,
    applyProfile: applyProfileMutation.mutateAsync,
    assignRole: assignRoleMutation.mutateAsync,
    updateRoleProfile: updateRoleProfileMutation.mutateAsync,
    revokeSession: revokeSessionMutation.mutateAsync,
    
    createRole: createRoleMutation.mutateAsync,
    updateRole: updateRoleMutation.mutateAsync,
    deleteRole: deleteRoleMutation.mutateAsync,

    createUser: createUserMutation.mutateAsync,
    updateUser: updateUserMutation.mutateAsync,
    deactivateUser: deactivateUserMutation.mutateAsync,

    // Pending states
    isApplying: applyProfileMutation.isPending,
    isAssigning: assignRoleMutation.isPending,
    isUpdatingRole: updateRoleProfileMutation.isPending,
    isRevoking: revokeSessionMutation.isPending,
    isCreatingUser: createUserMutation.isPending,
    isUpdatingUser: updateUserMutation.isPending,
    isCreatingRole: createRoleMutation.isPending,
    isUpdatingRoleDetails: updateRoleMutation.isPending,
  };
};

