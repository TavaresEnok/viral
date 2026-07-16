'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useProjectSSE } from './useProjectSSE';

export function useProjectPolling(projectId: string) {
  const { status: sseStatus, live: sseLive } = useProjectSSE(projectId);

  // O polling só descansa enquanto o SSE está VIVO. Antes bastava uma
  // mensagem para desligá-lo permanentemente: se o stream caísse depois
  // (proxy ocioso, restart da API), a barra congelava até dar refresh.
  const query = useQuery({
    queryKey: ['job', projectId],
    queryFn: () => api.jobs.status(projectId),
    enabled: Boolean(projectId) && !sseLive,
    refetchInterval: (query) => {
      if (sseLive) return false;
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
