import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateApiKeysDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  deepseekApiKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  openaiApiKey?: string;

  @IsOptional()
  @IsString()
  @IsIn(['deepseek-chat', 'deepseek-reasoner'])
  deepseekModel?: string;

  @IsOptional()
  @IsString()
  @IsIn(['whisper-1', 'gpt-4o-mini-transcribe'])
  openaiTranscriptionModel?: string;
}

export class UpsertAiProviderDto {
  @IsString()
  provider!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  @IsIn(['PASS1', 'TRANSCRIPTION', 'LLM_NATIVE'])
  role?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  active?: string;
}
