import { CaptionTheme, ClipStyle, ContentType, RenderLayout, SocialChannelPlatform } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class CreateChannelImportDto {
  @IsEnum(SocialChannelPlatform)
  platform!: SocialChannelPlatform;

  @IsUrl({ require_protocol: true })
  channelUrl!: string;
}

export class ImportSelectedVideosDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsUrl({ require_protocol: true }, { each: true })
  selectedUrls!: string[];

  @IsEnum(ContentType)
  contentType!: ContentType;

  @IsEnum(ClipStyle)
  clipStyle!: ClipStyle;

  @IsString()
  @IsOptional()
  language: string = 'pt-BR';

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
