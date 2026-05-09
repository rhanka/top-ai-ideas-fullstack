import { describe, expect, it } from 'vitest';

import { buildGeminiRequestBody } from '../../src/services/llm-runtime';

describe('buildGeminiRequestBody', () => {
  it('keeps Gemini 3 thoughts out of visible response parts by default', () => {
    const body = buildGeminiRequestBody({
      model: 'gemini-3.1-pro-preview-customtools',
      messages: [{ role: 'user', content: 'Say OK' }],
    }) as {
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: string;
          includeThoughts: boolean;
        };
      };
    };

    expect(body.generationConfig.thinkingConfig).toEqual({
      thinkingLevel: 'low',
      includeThoughts: false,
    });
  });

  it('uses high Gemini 3 thinking without exposing thought summaries', () => {
    const body = buildGeminiRequestBody({
      model: 'gemini-3.1-pro-preview-customtools',
      messages: [{ role: 'user', content: 'Analyze deeply' }],
      reasoningEffort: 'high',
    }) as {
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: string;
          includeThoughts: boolean;
        };
      };
    };

    expect(body.generationConfig.thinkingConfig).toEqual({
      thinkingLevel: 'high',
      includeThoughts: false,
    });
  });

  it('omits leaked Gemini internal thought markers from assistant history', () => {
    const body = buildGeminiRequestBody({
      model: 'gemini-3.1-pro-preview-customtools',
      messages: [
        {
          role: 'assistant',
          content:
            '...94>thought CRITICAL INSTRUCTION 1: internal. CRITICAL INSTRUCTION 2: internal.OK',
        },
        { role: 'user', content: 'Continue' },
      ],
    }) as { contents: Array<Record<string, unknown>> };

    expect(body.contents).toEqual([
      {
        role: 'model',
        parts: [
          {
            text: '[Previous assistant response omitted: provider-internal reasoning marker was removed.]',
          },
        ],
      },
      {
        role: 'user',
        parts: [{ text: 'Continue' }],
      },
    ]);
  });

  it('keeps textual fallback even when tool metadata is present', () => {
    const body = buildGeminiRequestBody({
      messages: [
        { role: 'system', content: 'SYS' },
        { role: 'user', content: 'Read the repo file' },
      ],
      rawInput: [
        {
          type: 'function_call_output',
          call_id: 'call_local_file_read_1',
          name: 'file_read',
          args: { path: 'README.md' },
          output: JSON.stringify({ status: 'completed', content: 'ok' }),
        },
      ],
    }) as {
      contents: Array<Record<string, unknown>>;
      systemInstruction: Record<string, unknown>;
    };

    expect(body.systemInstruction).toEqual({
      parts: [{ text: 'SYS' }],
    });
    expect(body.contents).toEqual([
      {
        role: 'user',
        parts: [{ text: 'Read the repo file' }],
      },
      {
        role: 'user',
        parts: [
          {
            text:
              'Tool output (call_local_file_read_1): {"status":"completed","content":"ok"}',
          },
        ],
      },
    ]);
  });

  it('keeps textual fallback when function metadata is missing', () => {
    const body = buildGeminiRequestBody({
      messages: [{ role: 'user', content: 'Read the repo file' }],
      rawInput: [
        {
          type: 'function_call_output',
          call_id: 'call_local_file_read_1',
          output: '{"status":"completed"}',
        },
      ],
    }) as { contents: Array<Record<string, unknown>> };

    expect(body.contents).toEqual([
      {
        role: 'user',
        parts: [{ text: 'Read the repo file' }],
      },
      {
        role: 'user',
        parts: [{ text: 'Tool output (call_local_file_read_1): {"status":"completed"}' }],
      },
    ]);
  });
});
