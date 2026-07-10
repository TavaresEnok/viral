'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getAuthToken } from '@/stores/auth.store';

export function useQuota() {
  return useQuery({
    queryKey: ['quota'],
    queryFn: () => api.quota.get(),
    enabled: !!getAuthToken(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
