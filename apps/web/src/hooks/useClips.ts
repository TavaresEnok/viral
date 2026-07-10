'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useClips(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ['clips', projectId],
    queryFn: () => api.clips.list(projectId),
    enabled: Boolean(projectId) && enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const clips = query.state.data;
      return clips?.some((clip) => clip.status === 'RENDERING' || clip.status === 'PENDING') ? 3000 : false;
    },
  });
}
