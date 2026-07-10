import { CaptionTheme, ContentType, ClipStyle, RenderLayout } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsOptional()
  language: string = 'pt-BR';

  @IsEnum(ContentType)
  contentType!: ContentType;

  @IsEnum(ClipStyle)
  clipStyle!: ClipStyle;

  @IsInt()
  @Min(20)
  @Max(90)
  @IsOptional()
  preferredClipDuration: number = 45;

  @IsEnum(RenderLayout)
  @IsOptional()
  renderLayout: RenderLayout = RenderLayout.BLURRED_BACKGROUND;

  @IsEnum(CaptionTheme)
  @IsOptional()
  captionTheme: CaptionTheme = CaptionTheme.CLEAN_FOOTER;
}

export class UpdateProjectDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;
}

export class SubmitYoutubeUrlDto {
  @IsUrl({ require_protocol: true })
  youtubeUrl!: string;
}
