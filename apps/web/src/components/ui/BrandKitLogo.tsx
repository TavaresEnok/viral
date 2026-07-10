/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';

interface BrandKitLogoProps {
  kitId: string;
  kitName: string;
  className?: string;
  initialsClassName?: string;
  initialsBackground?: string;
  initialsColor?: string;
}

export function BrandKitLogo({ kitId, kitName, className = 'h-12 w-12', initialsClassName, initialsBackground, initialsColor }: BrandKitLogoProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setBlobUrl(null);
    setError(false);

    api.brandKits.logoBlobUrl(kitId)
      .then((url) => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        objectUrlRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    };
  }, [kitId]);

  if (blobUrl && !error) {
    return <img src={blobUrl} alt="" className={`rounded-full object-cover ${className}`} />;
  }

  return (
    <div className={`flex items-center justify-center rounded-full ${className} ${initialsClassName ?? ''}`} style={{ backgroundColor: initialsBackground ?? '#C8F542', color: initialsColor ?? '#10120A' }}>
      <span className="text-lg font-bold">{kitName.charAt(0).toUpperCase()}</span>
    </div>
  );
}
