/**
 * Утилита защиты от XSS (Cross-Site Scripting) и вредоносных HTML-инъекций
 */

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=/gi, // onerror=, onclick=, onload=
  /<iframe\b[^>]*>/gi,
  /<object\b[^>]*>/gi,
  /<embed\b[^>]*>/gi
];

/**
 * Очищает простой текст (заголовки, ники, отзывы, названия команд) от любых HTML-тегов
 */
export function sanitizePlainText(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, '') // Удаление любых HTML-тегов
    .replace(/["'&<>]/g, (char) => {
      switch (char) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#x27;';
        default: return char;
      }
    })
    .trim();
}

/**
 * Очищает Rich Text / Markdown описания от вредоносных JS-скриптов и обработчиков событий
 */
export function sanitizeRichText(input?: string | null): string {
  if (!input) return '';
  let sanitized = input;

  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized.trim();
}
