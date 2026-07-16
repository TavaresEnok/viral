'use client';
import { useEffect, useRef, useState } from 'react';
import type { JobStatus } from '@/types/api.types';
import { api } from '@/lib/api';

export interface ProjectSSEState {
  status: JobStatus | null;
  /** false quando o stream desistiu — o polling precisa reassumir. */
  live: boolean;
}

/**
 * Stream de progresso do projeto.
 *
 * O ticket é de uso único, então o auto-reconnect nativo do EventSource
 * reusaria um ticket expirado e falharia. Por isso reconectamos à mão,
 * buscando um ticket novo, com backoff. Se mesmo assim desistirmos,
 * `live` vira false para o polling voltar a assumir — antes o stream morria
 * calado e a barra de progresso congelava para sempre.
 */
export function useProjectSSE(projectId: string): ProjectSSEState {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [live, setLive] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    async function connect() {
      if (cancelled) return;
      try {
        const { ticket } = await api.jobs.getSseTicket(projectId);
        if (cancelled) return;

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
        const url = `${baseUrl}/jobs/${projectId}/stream?token=${encodeURIComponent(ticket)}`;
        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          if (cancelled) return;
          reconnectAttempts = 0;
          setLive(true);
        };

        es.onmessage = (event) => {
          if (cancelled) return;
          reconnectAttempts = 0;
          setLive(true);
          try {
            setStatus(JSON.parse(event.data) as JobStatus);
          } catch {
            // ignora mensagem malformada
          }
        };

        es.onerror = () => {
          if (cancelled) return;
          // Fecha já: o retry nativo reusaria o ticket de uso único.
          es.close();
          eventSourceRef.current = null;
          setLive(false);
          if (reconnectAttempts >= 5) return; // desiste; polling assume
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 15_000);
          reconnectAttempts += 1;
          reconnectTimer = setTimeout(connect, delay);
        };
      } catch {
        // sem ticket — polling cobre
        if (cancelled) return;
        setLive(false);
      }
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [projectId]);

  return { status, live };
}
