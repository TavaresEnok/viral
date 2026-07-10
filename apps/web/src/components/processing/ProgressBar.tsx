export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-pill bg-elevated">
      <div className="h-full rounded-pill bg-progress-viral transition-all duration-200 ease-smooth" style={{ width: `${value}%` }} />
    </div>
  );
}
