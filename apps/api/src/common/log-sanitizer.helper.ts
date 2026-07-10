const SENSITIVE_PATTERNS = [
  /(api[_-]?key|secret|password|token|jwt|encryption[_-]?secret|authorization)\s*[:=]?\s*['"]?[a-zA-Z0-9_.-]{8,}/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /deepseek[a-zA-Z0-9_-]{20,}/gi,
  /openai[a-zA-Z0-9_-]{20,}/gi,
];

export function sanitizeLogValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let sanitized = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => {
        if (match.length <= 8) return match;
        return match.slice(0, 4) + '****' + match.slice(-4);
      });
    }
    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeLogValue);
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('authorization')
      ) {
        sanitized[key] = val && typeof val === 'string' && val.length > 8
          ? val.slice(0, 4) + '****' + val.slice(-4)
          : val;
      } else {
        sanitized[key] = sanitizeLogValue(val);
      }
    }
    return sanitized;
  }

  return value;
}
