'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { capture } from '@/lib/analytics';

type TrackedLinkProps = ComponentProps<typeof Link> & {
  event: string;
  properties?: Record<string, string | number | boolean | null | undefined>;
};

export function TrackedLink({ event, properties, onClick, ...props }: TrackedLinkProps) {
  function handleClick(mouseEvent: MouseEvent<HTMLAnchorElement>) {
    capture(event, properties);
    onClick?.(mouseEvent);
  }

  return <Link {...props} onClick={handleClick} />;
}
