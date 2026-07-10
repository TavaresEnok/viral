'use client';

import type { AdminGrowth } from '@/types/api.types';

/**
 * Gráfico de crescimento (30 dias): barras = novos usuários/dia, linha = total
 * acumulado. SVG próprio (sem dependência), eixos só visuais (sem números).
 */
export function GrowthChart({ series }: { series: AdminGrowth['series'] }) {
  const width = 760;
  const height = 190;
  const padX = 10;
  const padY = 16;
  const n = series.length;
  if (n === 0) return null;

  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const barSlot = innerW / n;
  const barW = Math.max(2, barSlot * 0.6);

  const maxNew = Math.max(1, ...series.map((point) => point.newUsers));
  const totals = series.map((point) => point.totalUsers);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);
  const totalRange = Math.max(1, maxTotal - minTotal);

  const x = (i: number) => padX + i * barSlot + (barSlot - barW) / 2;
  const lineX = (i: number) => padX + i * barSlot + barSlot / 2;
  const lineY = (value: number) => padY + innerH - ((value - minTotal) / totalRange) * innerH;

  const linePoints = series.map((point, i) => `${lineX(i).toFixed(1)},${lineY(point.totalUsers).toFixed(1)}`).join(' ');
  const areaPoints = `${padX + barSlot / 2},${padY + innerH} ${linePoints} ${padX + (n - 1) * barSlot + barSlot / 2},${padY + innerH}`;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Gráfico de crescimento de usuários">
        <defs>
          <linearGradient id="growthArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {series.map((point, i) => {
          const barH = (point.newUsers / maxNew) * innerH;
          return (
            <rect
              key={point.date}
              x={x(i)}
              y={padY + innerH - barH}
              width={barW}
              height={Math.max(0, barH)}
              rx={1.5}
              fill="var(--hairline-strong)"
            >
              <title>{`${point.date}: +${point.newUsers} usuários · ${point.totalUsers} total`}</title>
            </rect>
          );
        })}
        <polygon points={areaPoints} fill="url(#growthArea)" />
        <polyline points={linePoints} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
