'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.projects.get(projectId),
    enabled: Boolean(projectId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
