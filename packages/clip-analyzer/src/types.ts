export interface TranscriptSegment {
  id?: number | string;
  speaker?: string;
  start: number;
  end: number;
  text: string;
}
