import { CaptionTheme, ClipFeedbackReason, RenderLayout } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateClipFeedbackDto {
  @IsEnum(ClipFeedbackReason)
  reason!: ClipFeedbackReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateClipTimingDto {
  @IsNumber()
  @Min(0)
  start!: number;

  @IsNumber()
  @Min(0)
  end!: number;

  @IsOptional()
  @IsEnum(RenderLayout)
  renderLayout?: RenderLayout;

  @IsOptional()
  @IsEnum(CaptionTheme)
  captionTheme?: CaptionTheme;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  suggestedCaptionTitle?: string;
}

export class UpdateSubtitleSegmentsDto {
  /** Array of { start, end, text } — validated in service */
  segments!: Array<{ start: number; end: number; text: string }>;
}

export class RenderClipDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  start?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  end?: number;

  @IsOptional()
  @IsEnum(RenderLayout)
  renderLayout?: RenderLayout;

  @IsOptional()
  @IsEnum(CaptionTheme)
  captionTheme?: CaptionTheme;

  /** Render only the first N seconds — fast preview to validate theme/layout. Max 10s. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  previewSeconds?: number;

  /** Enable automatic emoji/SFX overlays (requires Remotion render engine). */
  @IsOptional()
  @IsBoolean()
  autoOverlays?: boolean;
}
