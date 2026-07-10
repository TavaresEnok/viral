export interface ScoreBreakdown {
  openingScore: number;
  closingScore: number;
  contextScore: number;
  emotionalScore: number;
  quotabilityScore: number;
  rankScore: number;
  [key: string]: number;
}

export interface StageTimings {
  [stage: string]: number;
}

export interface RenderEngines {
  [engine: string]: number;
}

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export interface FaceTrackFrame {
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
