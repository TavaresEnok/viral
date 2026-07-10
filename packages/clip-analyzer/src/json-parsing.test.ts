import { describe, it, expect } from 'vitest';
import { parseJsonResilient, extractFirstBalancedObject } from './json-parsing.js';

describe('extractFirstBalancedObject', () => {
  it('extracts a simple JSON object', () => {
    const result = extractFirstBalancedObject('texto antes {"a": 1} depois');
    expect(result).toBe('{"a": 1}');
  });

  it('returns null when no object found', () => {
    const result = extractFirstBalancedObject('no braces here');
    expect(result).toBeNull();
  });

  it('handles nested objects', () => {
    const input = '{"a": {"b": 2}}';
    const result = extractFirstBalancedObject(input);
    expect(result).toBe(input);
  });

  it('handles strings with braces', () => {
    const input = '{"a": "texto {com} braces"}';
    const result = extractFirstBalancedObject(input);
    expect(result).toBe(input);
  });

  it('handles escaped quotes', () => {
    const input = '{"a": "texto \\"com\\" quotes"}';
    const result = extractFirstBalancedObject(input);
    expect(result).toBe(input);
  });
});

describe('parseJsonResilient', () => {
  it('parses valid JSON directly', () => {
    const result = parseJsonResilient('{"a": 1}');
    expect(result).toEqual({ a: 1 });
  });

  it('extracts JSON from surrounding text', () => {
    const result = parseJsonResilient('```json\n{"a": 1}\n```');
    expect(result).toEqual({ a: 1 });
  });

  it('returns null for empty string', () => {
    const result = parseJsonResilient('');
    expect(result).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    const result = parseJsonResilient('   ');
    expect(result).toBeNull();
  });

  it('returns null for invalid input', () => {
    const result = parseJsonResilient('not json at all');
    expect(result).toBeNull();
  });

  it('handles LLM-style response with markdown', () => {
    const input = 'Aqui estão os clips:\n\n```json\n{\n  "clips": [\n    {"title": "Clip 1", "start": 10, "end": 55}\n  ]\n}\n```';
    const result = parseJsonResilient(input);
    expect(result).toBeTruthy();
    expect(result).toHaveProperty('clips');
    expect(Array.isArray((result as Record<string, unknown>).clips)).toBe(true);
  });
});
