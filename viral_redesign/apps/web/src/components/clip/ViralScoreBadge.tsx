import { ProgressRing } from '@/components/ui/ProgressRing';

export function ViralScoreBadge({ score }: { score: number }) {
  return <ProgressRing value={score} size={42} className="shrink-0" />;
}
