export type JsonObjectSchema = Record<string, unknown>;

export interface FunctionToolDefinition {
  type: 'function';
  name: string;
  description?: string;
  inputSchema: JsonObjectSchema;
  strict?: boolean;
  metadata?: Record<string, unknown>;
}

export type ToolDefinition = FunctionToolDefinition;

export type ToolChoice =
  | 'auto'
  | 'required'
  | 'none'
  | {
      type: 'tool';
      name: string;
    };

export interface ToolCall {
  toolCallId: string;
  name: string;
  argumentsText: string;
  arguments?: unknown;
  providerCallId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCallDelta {
  toolCallId: string;
  delta: string;
  name?: string;
  providerCallId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name?: string;
  output: unknown;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}
