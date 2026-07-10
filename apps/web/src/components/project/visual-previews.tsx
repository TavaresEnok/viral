import { cn } from '@/lib/cn';
import type { CaptionTheme, RenderLayout } from '@/types/api.types';

/**
 * Previews 100% desenhados (retângulos + gradientes), sem imagens externas.
 * Em produção o preview real vem das thumbnails dos clips.
 */

const panel = 'rounded-[6px] bg-[linear-gradient(160deg,#2E2E3A,#191920)]';

export function LayoutMiniPreview({ layout, className }: { layout: RenderLayout; className?: string }) {
  return (
    <div className={cn('relative aspect-[9/16] overflow-hidden rounded-[9px] bg-[#101016]', className)}>
      <div className="absolute inset-0 bg-thumb-stripe" aria-hidden="true" />
      {layout === 'BLURRED_BACKGROUND' && (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#23232D,#121218)] opacity-80" />
          <div className={cn('absolute inset-x-[14%] inset-y-[26%]', panel)} />
        </>
      )}
      {(layout === 'FILL_CROP' || layout === 'SMART_REFRAME' || layout === 'SPEAKER_CLOSEUP') && (
        <div className={cn('absolute inset-[6%]', panel)} />
      )}
      {layout === 'SMART_CENTER' && (
        <>
          <div className={cn('absolute inset-[6%]', panel)} />
          <div className="absolute left-[32%] right-[32%] top-[14%] h-[22%] rounded-[6px] bg-white/12" />
        </>
      )}
      {layout === 'CENTER_FIT' && <div className={cn('absolute inset-x-[6%] top-[34%] h-[32%]', panel)} />}
      {layout === 'TOP_FRAME' && <div className={cn('absolute inset-x-[6%] top-[6%] h-[56%]', panel)} />}
      {layout === 'PODCAST_SPLIT_STATIC' && (
        <>
          <div className={cn('absolute inset-x-[6%] top-[6%] h-[43%]', panel)} />
          <div className={cn('absolute inset-x-[6%] bottom-[6%] h-[43%]', panel)} />
        </>
      )}
      {layout === 'SCREEN_PLUS_FACE' && (
        <>
          <div className={cn('absolute inset-x-[6%] top-[8%] h-[44%]', panel)} />
          <div className={cn('absolute bottom-[10%] right-[8%] h-[24%] w-[36%]', panel)} />
        </>
      )}
    </div>
  );
}

export type CaptionSize = 'P' | 'M' | 'G';
export type CaptionPosition = 'top' | 'center' | 'bottom';

const sampleText: Partial<Record<CaptionTheme, string>> = {
  KARAOKE_PRO: 'PARA TUDO E OUVE',
  CREATOR_BOX: 'O SEGREDO REVELADO',
  CLEAN_EDITORIAL: 'Isso muda tudo.',
  MINIMAL: 'Isso muda tudo',
  STORY_IMPACT: 'A VIRADA QUE NINGUÉM VIU',
};

export function CaptionSample({
  theme,
  size = 'M',
  className,
}: {
  theme: CaptionTheme;
  size?: CaptionSize;
  className?: string;
}) {
  const text = sampleText[theme] ?? 'ISSO MUDA TUDO';
  const scale = size === 'P' ? 'text-[0.82em]' : size === 'G' ? 'text-[1.22em]' : 'text-[1em]';
  const outline = { textShadow: '2px 2px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000' };

  if (theme === 'KARAOKE_PRO') {
    const words = text.split(' ');
    return (
      <span className={cn('inline-block font-display font-extrabold uppercase leading-[1.08] text-white', scale, className)} style={outline}>
        {words.map((word, index) => (
          <span key={index} className={index === 1 ? 'text-accent' : undefined}>
            {word}{' '}
          </span>
        ))}
      </span>
    );
  }
  if (theme === 'NEON_TECH') {
    return (
      <span
        className={cn('inline-block font-mono font-bold uppercase tracking-[0.12em] leading-[1.2] text-accent', scale, className)}
        style={{ textShadow: '0 0 14px rgba(200,245,66,0.85)' }}
      >
        {text}
      </span>
    );
  }
  if (theme === 'CREATOR_BOX' || theme === 'PODCAST_PRO') {
    return (
      <span className={cn('inline-block rounded-[4px] bg-black/85 px-2 py-1 font-display font-extrabold uppercase leading-[1.12] text-white', scale, className)}>
        {text}
      </span>
    );
  }
  if (theme === 'CLEAN_EDITORIAL') {
    return (
      <span className={cn('inline-block rounded-[4px] bg-black/70 px-2 py-1 font-semibold normal-case leading-[1.25] text-white', scale, className)}>
        {text}
      </span>
    );
  }
  if (theme === 'MINIMAL') {
    return (
      <span className={cn('inline-block font-medium normal-case leading-[1.25] text-white', scale, className)} style={{ textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}>
        {text}
      </span>
    );
  }
  if (theme === 'BOLD_FOOTER') {
    return (
      <span className={cn('inline-block font-display font-extrabold uppercase leading-[1.08] text-[#FFC24B]', scale, className)} style={outline}>
        {text}
      </span>
    );
  }
  if (theme === 'CLEAN_FOOTER') {
    return (
      <span className={cn('inline-block font-semibold uppercase leading-[1.2] text-white', scale, className)} style={{ textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}>
        {text}
      </span>
    );
  }
  // BOLD_CREATOR, STORY_IMPACT e demais: estilo creator com contorno duro
  return (
    <span className={cn('inline-block font-display font-extrabold uppercase leading-[1.08] text-white', scale, className)} style={outline}>
      {text}
    </span>
  );
}

export function PhonePreview({
  layout,
  captionTheme,
  size = 'M',
  position = 'bottom',
  className,
  children,
}: {
  layout: RenderLayout;
  captionTheme: CaptionTheme;
  size?: CaptionSize;
  position?: CaptionPosition;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('relative aspect-[9/16] overflow-hidden rounded-card border border-hairline-subtle bg-[#101016]', className)}>
      <LayoutMiniPreview layout={layout} className="absolute inset-0 rounded-none" />
      <div
        className={cn(
          'absolute inset-x-3 z-10 text-center text-[15px]',
          position === 'top' ? 'top-[12%]' : position === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-[14%]',
        )}
      >
        <CaptionSample theme={captionTheme} size={size} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
        <div className="h-full w-3/5 bg-accent" />
      </div>
      {children}
    </div>
  );
}
