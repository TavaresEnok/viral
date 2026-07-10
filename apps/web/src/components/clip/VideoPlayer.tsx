'use client';

import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { Maximize, Pause, Play, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDuration } from '@/lib/format';
import { authenticatedFetch } from '@/lib/api';

interface VideoPlayerProps {
  src: string;
  poster?: string | null;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (time: number) => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(function VideoPlayer(
  { src, poster, onPlay, onPause, onTimeUpdate },
  ref,
) {
  const innerRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState(false);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    if (!src) return;
    setLoading(true);
    setError(false);
    setBlobSrc(null);
    authenticatedFetch(src)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load video');
        return res.blob();
      })
      .then((blob) => {
        if (active) {
          url = URL.createObjectURL(blob);
          setBlobSrc(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  useImperativeHandle(ref, () => innerRef.current as HTMLVideoElement, []);

  function togglePlay() {
    const video = innerRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  function seek(value: number) {
    const video = innerRef.current;
    if (!video || !Number.isFinite(duration)) return;
    video.currentTime = Math.max(0, Math.min(duration, value));
  }

  function changeRate() {
    const next = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(next);
    if (innerRef.current) innerRef.current.playbackRate = next;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="group relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-4 text-center text-white">
          <div>
            <span className="mx-auto mb-3 block text-3xl">⚠️</span>
            <p className="text-sm font-medium">Vídeo indisponível</p>
            <p className="mt-1 text-xs text-white/60">Não foi possível carregar o clip</p>
          </div>
        </div>
      ) : loading ? (
        <div className="absolute inset-0 grid place-items-center bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        </div>
      ) : blobSrc ? (
        <video
          preload="metadata"
          poster={poster ?? undefined}
          src={blobSrc}
          onPlay={() => {
            setPlaying(true);
            onPlay?.();
          }}
          onPause={() => { setPlaying(false); onPause?.(); }}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime);
            onTimeUpdate?.(event.currentTarget.currentTime);
          }}
          onError={() => setError(true)}
          className="h-full w-full bg-black object-contain"
          ref={innerRef}
        />
      ) : null}

      {!error && !loading && (
        <button
          type="button"
          aria-label={playing ? 'Pausar' : 'Reproduzir'}
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/10 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-black/55 backdrop-blur-sm shadow-glow">
            {playing ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
          </span>
        </button>
      )}

      {!error && !loading && (
        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-black/65 p-3 opacity-100 backdrop-blur-md transition md:opacity-0 md:group-hover:opacity-100">
          <input
            aria-label="Progresso do vídeo"
            type="range"
            min={0}
            max={duration || 0}
            step="0.05"
            value={currentTime}
            onChange={(event) => seek(Number(event.target.value))}
            className="mb-2 h-1 w-full accent-[#C8F542]"
            style={{ background: `linear-gradient(90deg, var(--accent) ${progress}%, rgba(255,255,255,.18) ${progress}%)` }}
          />
          <div className="flex items-center justify-between gap-2 text-xs text-white/80">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" aria-label={playing ? 'Pausar' : 'Reproduzir'} className="h-8 w-8 p-0 text-white hover:bg-white/10" onClick={togglePlay}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <span>{formatDuration(currentTime)} / {formatDuration(duration)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Volume2 className="h-4 w-4" />
              <Button type="button" variant="ghost" className="h-8 px-2 text-white hover:bg-white/10" onClick={changeRate}>{playbackRate}x</Button>
              <Button type="button" variant="ghost" aria-label="Tela cheia" className="h-8 w-8 p-0 text-white hover:bg-white/10" onClick={() => innerRef.current?.requestFullscreen().catch(() => {})}>
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
