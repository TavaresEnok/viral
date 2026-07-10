'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: api.projects.list,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const projects = query.state.data;
      if (!projects?.length) return false;
      const hasActiveProcessing = projects.some((project) => project.status === 'PENDING' || project.status === 'PROCESSING');
      return hasActiveProcessing ? 3000 : false;
    },
  });
}
