import { CaptionTheme, RenderLayout } from '@prisma/client';
import { IsEnum, IsHexColor, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateBrandKitDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @IsOptional()
  @IsEnum(CaptionTheme)
  captionTheme?: CaptionTheme;

  @IsOptional()
  @IsIn(['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center'])
  watermarkPos?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  watermarkOpacity?: number;
}

export class UpdateBrandKitDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @IsOptional()
  @IsEnum(CaptionTheme)
  captionTheme?: CaptionTheme;

  @IsOptional()
  @IsIn(['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center'])
  watermarkPos?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  watermarkOpacity?: number;
}

export class CreateCaptionTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsEnum(CaptionTheme)
  captionTheme!: CaptionTheme;

  @IsEnum(RenderLayout)
  renderLayout!: RenderLayout;
}
