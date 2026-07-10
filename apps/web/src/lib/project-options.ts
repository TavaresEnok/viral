import type { CaptionTheme, RenderLayout } from '@/types/api.types';

/**
 * Curadoria de lançamento: expomos apenas os 4 melhores layouts e 4 melhores
 * estilos de legenda para manter a criação simples (menos paralisia de escolha
 * que os concorrentes). Os demais valores do enum continuam válidos no backend
 * para projetos/cortes já criados — só não são oferecidos em novas seleções.
 */
export function isLayoutAvailable(layout: RenderLayout): boolean {
  return renderLayoutOptions.some((opt) => opt.value === layout && !opt.comingSoon);
}

export const renderLayoutOptions: Array<{
  label: string;
  value: RenderLayout;
  description?: string;
  comingSoon?: boolean;
}> = [
  { label: 'Reframe inteligente', value: 'SMART_REFRAME', description: 'Seguimento automático do rosto (IA)' },
  { label: 'Zoom tela cheia', value: 'FILL_CROP', description: 'Preenche 9:16 com crop' },
  { label: 'Blur vertical', value: 'BLURRED_BACKGROUND', description: 'Fundo desfocado com vídeo central' },
  { label: 'Rosto no terço superior', value: 'SMART_CENTER', description: 'Espaço seguro para legenda' },
];

/** Apenas layouts disponíveis para seleção em novos projetos */
export const availableRenderLayoutOptions = renderLayoutOptions.filter((opt) => !opt.comingSoon);

export const captionThemeOptions: Array<{ label: string; value: CaptionTheme; group: 'Premium' | 'Clássico' }> = [
  { label: 'Bold Creator', value: 'BOLD_CREATOR', group: 'Premium' },
  { label: 'Karaoke Pro', value: 'KARAOKE_PRO', group: 'Premium' },
  { label: 'Clean Editorial', value: 'CLEAN_EDITORIAL', group: 'Premium' },
  { label: 'Neon Tech', value: 'NEON_TECH', group: 'Premium' },
];

export const captionThemeSelectOptions = captionThemeOptions.map((option) => ({
  label: option.label,
  value: option.value,
}));

/**
 * Idiomas oferecidos. Restrito a escrita LATINA de propósito: as fontes das
 * legendas queimadas (Arial / Arial Black / Impact) só têm glifos latinos —
 * CJK (日本語/中文/한국어), árabe, hindi e cirílico renderizariam como tofu (□□□).
 * Para liberar esses idiomas é preciso antes embutir uma fonte com esses glifos
 * no engine de render. A transcrição (Whisper) já suporta todos esses códigos.
 */
export const languageOptions: Array<{ label: string; value: string }> = [
  { label: 'Português', value: 'pt-BR' },
  { label: 'English', value: 'en' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Italiano', value: 'it' },
  { label: 'Nederlands', value: 'nl' },
  { label: 'Polski', value: 'pl' },
  { label: 'Română', value: 'ro' },
  { label: 'Türkçe', value: 'tr' },
  { label: 'Tiếng Việt', value: 'vi' },
  { label: 'Indonesia', value: 'id' },
];
