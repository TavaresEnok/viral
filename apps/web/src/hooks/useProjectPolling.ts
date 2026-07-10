'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useProjectSSE } from './useProjectSSE';

export function useProjectPolling(projectId: string) {
  const sseStatus = useProjectSSE(projectId);

  const query = useQuery({
    queryKey: ['job', projectId],
    queryFn: () => api.jobs.status(projectId),
    enabled: Boolean(projectId) && !sseStatus,
    refetchInterval: (query) => {
      if (sseStatus) return false;
      const status = query.state.data?.status;
      return status === 'COMPLETED' || status === 'FAILED' ? false : 3000;
    },
  });

  return {
    data: sseStatus ?? query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
