export function cleanText(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;?/gi, '<')
    .replace(/&gt(?::;|;)?/gi, '>')
    .replace(/&quot;?/gi, '"')
    .replace(/&#(?:0*39|x0*27);?/gi, "'")
    .replace(/&apos;?/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/(?:^|\s)(?:pt|en|es)(?:-[a-z]{2})?\s*[:;>]+\s*/gi, ' ')
    .replace(/\b[a-z]{2}(?:-[a-z]{2})?\s*>\s*>/gi, ' ')
    .replace(/>{1,2}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
