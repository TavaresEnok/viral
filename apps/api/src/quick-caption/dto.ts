import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const RENDER_LAYOUTS = [
  'BLURRED_BACKGROUND',
  'FILL_CROP',
  'CENTER_FIT',
  'TOP_FRAME',
  'SMART_REFRAME',
  'SMART_CENTER',
  'SPEAKER_CLOSEUP',
  'PODCAST_SPLIT_STATIC',
  'SCREEN_PLUS_FACE',
] as const;

const CAPTION_THEMES = [
  'CLEAN_FOOTER',
  'BOLD_FOOTER',
  'CREATOR_BOX',
  'MINIMAL',
  'BOLD_CREATOR',
  'CLEAN_EDITORIAL',
  'NEON_TECH',
  'KARAOKE_PRO',
  'PODCAST_PRO',
  'STORY_IMPACT',
] as const;

export class CreateBatchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(RENDER_LAYOUTS)
  renderLayout?: (typeof RENDER_LAYOUTS)[number];

  @IsOptional()
  @IsEnum(CAPTION_THEMES)
  captionTheme?: (typeof CAPTION_THEMES)[number];
}

export class UpdateBatchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(RENDER_LAYOUTS)
  renderLayout?: (typeof RENDER_LAYOUTS)[number];

  @IsOptional()
  @IsEnum(CAPTION_THEMES)
  captionTheme?: (typeof CAPTION_THEMES)[number];
}

export class UpdateItemDto {
  @IsString()
  @MaxLength(500)
  captionText!: string;
}
