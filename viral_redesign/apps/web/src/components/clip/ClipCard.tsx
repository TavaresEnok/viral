import { api } from '@/lib/api';
import { capture } from '@/lib/analytics';
import { formatDuration } from '@/lib/format';
import type { Clip } from '@/types/api.types';
import { ClipActions } from './ClipActions';
import { ClipFeedback } from './ClipFeedback';
import { ViralScoreBadge } from './ViralScoreBadge';
import { VideoPlayer } from './VideoPlayer';

export function ClipCard({ clip, positionInList }: { clip: Clip; positionInList: number }) {
  const videoUrl = api.clips.downloadUrl(clip.id);
  const finalScore = clip.finalScore || clip.viralScore;

  return (
    <article className="overflow-hidden rounded-2xl border border-hairline-subtle bg-surface shadow-elevated">
      {clip.status === 'COMPLETED' ? (
        <VideoPlayer
          src={videoUrl}
          onPlay={() =>
            capture('clip_played', {
              clipId: clip.id,
              projectId: clip.projectId,
              viralScore: clip.viralScore,
              finalScore,
              closingStrength: clip.closingStrength,
              positionInList,
            })
          }
        />
      ) : (
        <div className="flex aspect-[9/16] items-center justify-center bg-overlay text-sm text-ink-tertiary">
          {clip.status === 'FAILED' ? clip.errorMessage : 'Renderizando'}
        </div>
      )}
      <div className="space-y-4 p-5">
        <div className="flex gap-3">
          <ViralScoreBadge score={finalScore} />
          <div className="min-w-0">
            <h3 className="text-base font-medium text-ink-primary">{clip.title}</h3>
            <p className="mt-1 text-xs text-ink-secondary">
              {formatDuration(clip.duration)} | {clip.category}
            </p>
          </div>
        </div>
        {clip.hook && <p className="text-sm italic text-ink-secondary">&ldquo;{clip.hook}&rdquo;</p>}
        <p className="line-clamp-3 text-xs leading-relaxed text-ink-tertiary">{clip.reason}</p>
        {typeof clip.closingStrength === 'number' && (
          <p className="text-xs text-ink-tertiary">Fechamento: {clip.closingStrength}/100{clip.closingType ? ` | ${clip.closingType}` : ''}</p>
        )}
        {finalScore !== clip.viralScore && (
          <p className="text-xs text-ink-tertiary">Score IA bruto: {clip.viralScore}/100</p>
        )}
        {clip.status === 'COMPLETED' && (
          <div className="flex flex-wrap items-center gap-2">
            <ClipActions clip={clip} positionInList={positionInList} />
            <ClipFeedback clip={clip} positionInList={positionInList} />
          </div>
        )}
      </div>
    </article>
  );
}
