/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api';

export function ProtectedImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [error, setError] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    authenticatedFetch(src)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch image');
        return res.blob();
      })
      .then((blob) => {
        if (active) {
          url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-elevated/60 text-ink-tertiary ${className ?? ''}`}>
        <span className="text-[10px]">sem imagem</span>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className={`flex animate-pulse items-center justify-center bg-elevated/40 ${className ?? ''}`} />
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}
