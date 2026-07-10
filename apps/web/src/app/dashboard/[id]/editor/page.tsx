'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/common/Skeleton';
import { useClips } from '@/hooks/useClips';

export default function ProjectEditorIndexPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const clipsQuery = useClips(params.id, true);
  const firstClip = clipsQuery.data?.[0];

  useEffect(() => {
    if (firstClip) {
      router.replace(`/dashboard/${params.id}/editor/${firstClip.id}`);
    }
  }, [firstClip, params.id, router]);

  if (clipsQuery.isLoading) {
    return <Skeleton className="h-[calc(100vh-9rem)] rounded-2xl" />;
  }

  return (
    <div className="rounded-2xl border border-hairline-subtle bg-surface p-8 text-sm text-ink-secondary">
      Este projeto ainda não tem cortes para editar.
    </div>
  );
}
