export function parseJsonResilient(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const extracted = extractFirstBalancedObject(trimmed);
    if (!extracted) {
      return null;
    }

    try {
      return JSON.parse(extracted);
    } catch {
      return null;
    }
  }
}

export function extractFirstBalancedObject(input: string): string | null {
  const start = input.indexOf('{');
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i += 1) {
    const char = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    // Skip unicode escape sequences like \u007B that represent { or }
    if (char === '\\' && i + 5 < input.length && input[i + 1] === 'u') {
      i += 5;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }

  return null;
}
