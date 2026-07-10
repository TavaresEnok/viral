'use client';
import { useEffect, useRef, useState } from 'react';
import type { JobStatus } from '@/types/api.types';
import { api } from '@/lib/api';

export function useProjectSSE(projectId: string) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function connect() {
      try {
        const { ticket } = await api.jobs.getSseTicket(projectId);
        if (cancelled) return;

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:3001`;
        const url = `${baseUrl}/jobs/${projectId}/stream?token=${encodeURIComponent(ticket)}`;
        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        let consecutiveErrors = 0;
        es.onmessage = (event) => {
          consecutiveErrors = 0;
          try {
            setStatus(JSON.parse(event.data) as JobStatus);
          } catch {
            // ignora mensagem malformada
          }
        };
        es.onerror = () => {
          consecutiveErrors++;
          if (consecutiveErrors >= 5) es.close();
        };
      } catch {
        // sem ticket — polling vai cobrir
      }
    }

    connect();
    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [projectId]);

  return status;
}
