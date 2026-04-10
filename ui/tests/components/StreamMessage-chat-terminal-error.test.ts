import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Pure-function extraction from StreamMessage.svelte reactive view state
// This mirrors the component's display derivation for startup/content/error
// without requiring Svelte component rendering.
// ---------------------------------------------------------------------------

type TerminalEventType = 'done' | 'error' | null | undefined;
type Variant = 'chat' | 'job';

type DeriveViewStateInput = {
  variant: Variant;
  finalText?: string | null;
  contentText?: string | null;
  sawStarted?: boolean;
  sawReasoning?: boolean;
  sawTools?: boolean;
  stepsCount?: number;
  terminalEventType?: TerminalEventType;
};

function deriveStreamViewState(input: DeriveViewStateInput) {
  const finalText = input.finalText ?? '';
  const contentText = input.contentText ?? '';
  const hasSteps = !!input.sawReasoning || !!input.sawTools || (input.stepsCount ?? 0) > 0;
  const hasContent = contentText.trim().length > 0;

  const showStartup =
    !!input.sawStarted &&
    !hasSteps &&
    !hasContent &&
    !finalText &&
    !input.terminalEventType;

  const showChatTerminalError =
    input.variant === 'chat' &&
    input.terminalEventType === 'error' &&
    !hasContent &&
    !finalText;

  const showContent = finalText.trim().length > 0 || hasContent;

  return {
    hasSteps,
    hasContent,
    showStartup,
    showChatTerminalError,
    showContent,
  };
}

describe('StreamMessage chat terminal error view state', () => {
  it('shows startup while the chat stream has started but has no content yet', () => {
    const view = deriveStreamViewState({
      variant: 'chat',
      sawStarted: true,
    });

    expect(view.showStartup).toBe(true);
    expect(view.showChatTerminalError).toBe(false);
    expect(view.showContent).toBe(false);
  });

  it('stops showing startup after a terminal error', () => {
    const view = deriveStreamViewState({
      variant: 'chat',
      sawStarted: true,
      terminalEventType: 'error',
    });

    expect(view.showStartup).toBe(false);
  });

  it('surfaces the terminal error in chat when no content was produced', () => {
    const view = deriveStreamViewState({
      variant: 'chat',
      sawStarted: true,
      terminalEventType: 'error',
    });

    expect(view.showChatTerminalError).toBe(true);
    expect(view.showContent).toBe(false);
  });

  it('does not show the chat terminal error block once streamed content exists', () => {
    const view = deriveStreamViewState({
      variant: 'chat',
      terminalEventType: 'error',
      contentText: 'partial response',
    });

    expect(view.hasContent).toBe(true);
    expect(view.showChatTerminalError).toBe(false);
    expect(view.showContent).toBe(true);
  });

  it('does not show the chat terminal error block once persisted final content exists', () => {
    const view = deriveStreamViewState({
      variant: 'chat',
      terminalEventType: 'error',
      finalText: 'final persisted message',
    });

    expect(view.showChatTerminalError).toBe(false);
    expect(view.showContent).toBe(true);
  });

  it('does not enable the chat-only terminal error block for job cards', () => {
    const view = deriveStreamViewState({
      variant: 'job',
      sawStarted: true,
      terminalEventType: 'error',
    });

    expect(view.showStartup).toBe(false);
    expect(view.showChatTerminalError).toBe(false);
  });
});
