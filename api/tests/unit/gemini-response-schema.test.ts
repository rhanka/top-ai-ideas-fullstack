import { describe, expect, it } from 'vitest';

import { sanitizeGeminiResponseSchema } from '../../src/services/openai';

describe('sanitizeGeminiResponseSchema', () => {
  it('removes unsupported Gemini response schema keywords recursively', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        dossier: { type: 'string' },
        useCases: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              titre: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['titre', 'description'],
          },
        },
      },
      required: ['dossier', 'useCases'],
    } as Record<string, unknown>;

    const sanitized = sanitizeGeminiResponseSchema(schema);

    expect(sanitized).toEqual({
      type: 'object',
      properties: {
        dossier: { type: 'string' },
        useCases: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              titre: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['titre', 'description'],
          },
        },
      },
      required: ['dossier', 'useCases'],
    });
  });

  it('does not mutate the original schema object', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        additionalProperties: { type: 'string' },
      },
    } as Record<string, unknown>;

    const original = JSON.parse(JSON.stringify(schema));
    const sanitized = sanitizeGeminiResponseSchema(schema);

    expect(schema).toEqual(original);
    expect(sanitized).not.toBe(schema);
    expect(
      (sanitized.properties as Record<string, unknown>).additionalProperties
    ).toEqual({ type: 'string' });
    expect('additionalProperties' in sanitized).toBe(false);
  });
});
