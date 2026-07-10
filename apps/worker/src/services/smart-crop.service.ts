import { Injectable, Logger } from '@nestjs/common';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

export interface FaceTrackPoint {
  time: number;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
}

export interface SmoothedCrop {
  /** Normalized center X of face (0–1 relative to original frame width) */
  cx: number;
  /** Normalized center Y of face (0–1 relative to original frame height) */
  cy: number;
  /** Fraction of frames that had a detected face (0–1) */
  coverageRatio: number;
}

const EMA_ALPHA = 0.25; // lower = smoother, slower to react

/** Applies exponential moving average to a series of values. */
function applyEma(values: number[], alpha = EMA_ALPHA): number {
  if (!values.length) return 0.5;
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
  }
  return ema;
}

/** Clamp to keep crop inside frame. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

@Injectable()
export class SmartCropService {
  private readonly logger = new Logger(SmartCropService.name);

  /**
   * Compute EMA-smoothed crop center from raw face track data.
   * Returns a single (cx, cy) for static FFmpeg crop, or null if no faces.
   */
  smooth(faces: FaceTrackPoint[]): SmoothedCrop | null {
    if (!faces.length) return null;

    const cxValues = faces.map((f) => clamp(f.x + f.w / 2, 0, 1));
    const cyValues = faces.map((f) => clamp(f.y + f.h / 2, 0, 1));

    const cx = applyEma(cxValues);
    const cy = applyEma(cyValues);

    return { cx, cy, coverageRatio: 1 };
  }

  /**
   * Load cached faceTrack.json for a clip, or return null if not cached.
   * Cache lives at <clipDir>/face-track.json.
   */
  async loadCache(clipDir: string): Promise<FaceTrackPoint[] | null> {
    try {
      const path = resolve(clipDir, 'face-track.json');
      const raw = await readFile(path, 'utf8');
      return JSON.parse(raw) as FaceTrackPoint[];
    } catch {
      return null;
    }
  }

  /** Persist face tracking data to disk so re-renders skip detection. */
  async saveCache(clipDir: string, faces: FaceTrackPoint[]): Promise<void> {
    try {
      await mkdir(clipDir, { recursive: true });
      const path = resolve(clipDir, 'face-track.json');
      await writeFile(path, JSON.stringify(faces));
    } catch (error) {
      this.logger.warn({ msg: 'Failed to save face-track cache', error: (error as Error).message, clipDir });
    }
  }

  /**
   * Cluster multi-face track data into N groups by horizontal position,
   * then smooth each cluster independently. Returns crops sorted left→right.
   *
   * Used by PODCAST_SPLIT_STATIC to track left speaker and right speaker.
   */
  clusterFaces(faces: FaceTrackPoint[], n: number): SmoothedCrop[] {
    if (!faces.length) return [];

    // k-means in 1D on cx, initialized with equidistant centers
    const toCenter = (f: FaceTrackPoint) => clamp(f.x + f.w / 2, 0, 1);
    let centers = Array.from({ length: n }, (_, i) => (i + 0.5) / n);

    for (let iter = 0; iter < 10; iter++) {
      const sums = Array(n).fill(0);
      const counts = Array(n).fill(0);
      for (const f of faces) {
        const cx = toCenter(f);
        let best = 0;
        let bestDist = Math.abs(cx - centers[0]);
        for (let k = 1; k < n; k++) {
          const d = Math.abs(cx - centers[k]);
          if (d < bestDist) { bestDist = d; best = k; }
        }
        sums[best] += cx;
        counts[best]++;
      }
      const next = centers.map((c, k) => counts[k] > 0 ? sums[k] / counts[k] : c);
      if (next.every((c, k) => Math.abs(c - centers[k]) < 1e-4)) break;
      centers = next;
    }

    // Assign each face to its cluster and smooth independently
    const clusters: FaceTrackPoint[][] = Array.from({ length: n }, () => []);
    for (const f of faces) {
      const cx = toCenter(f);
      let best = 0;
      let bestDist = Math.abs(cx - centers[0]);
      for (let k = 1; k < n; k++) {
        const d = Math.abs(cx - centers[k]);
        if (d < bestDist) { bestDist = d; best = k; }
      }
      clusters[best].push(f);
    }

    return clusters
      .map((cluster) => this.smooth(cluster))
      .map((s, i) => s ?? { cx: centers[i], cy: 0.5, coverageRatio: 0 })
      .sort((a, b) => a.cx - b.cx); // left→right order
  }

  /**
   * Returns the clip directory path for a given project input file + clip id.
   * Mirrors the convention used in rendering.service.ts.
   */
  clipDir(inputPath: string, clipId: string): string {
    return resolve(dirname(inputPath), 'clips', clipId);
  }
}
