import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { securityApi } from '../api/securityApi';

export const useSecurity = () => {
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: securityApi.getSessions,
    staleTime: 1000 * 60 * 5,
  });

  const logsQuery = useQuery({
    queryKey: ['security-logs'],
    queryFn: () => securityApi.getAccessLogs(10),
    staleTime: 1000 * 60 * 2,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: securityApi.revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const refetchAll = async () => {
    await Promise.all([
      sessionsQuery.refetch(),
      logsQuery.refetch()
    ]);
  };

  return {
    sessions: sessionsQuery.data ?? [],
    logs: logsQuery.data ?? [],
    isLoading: sessionsQuery.isLoading || logsQuery.isLoading,
    isError: sessionsQuery.isError || logsQuery.isError,
    refetch: refetchAll,
    revokeSession: revokeSessionMutation.mutateAsync,
    isRevoking: revokeSessionMutation.isPending,
  };
};
