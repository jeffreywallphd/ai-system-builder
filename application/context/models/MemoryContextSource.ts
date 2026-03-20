import { DynamicContextSource, type DynamicContextSourceType } from "./DynamicContextSource";
import type { ContextVisibilityMode } from "./ContextVisibilityMode";

export type MemoryContextMessageRole = "system" | "user" | "assistant" | "tool";

export interface IMemoryContextMessage {
  readonly id?: string;
  readonly role: MemoryContextMessageRole;
  readonly content: string;
  readonly timestamp?: string | Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`MemoryContextSource.${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeTimestamp(value?: string | Date): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return normalizeOptional(value);
}

function roleLabel(role: MemoryContextMessageRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export class MemoryContextSource extends DynamicContextSource {
  public readonly messages: ReadonlyArray<IMemoryContextMessage>;
  public readonly conversationId?: string;
  public readonly sessionId?: string;

  constructor(params: {
    id: string;
    label?: string;
    order?: number;
    precedence?: number;
    visibility?: ContextVisibilityMode;
    metadata?: Readonly<Record<string, unknown>>;
    conversationId?: string;
    sessionId?: string;
    messages: ReadonlyArray<IMemoryContextMessage>;
  }) {
    const sourceType: DynamicContextSourceType = "memory";
    const conversationId = normalizeOptional(params.conversationId);
    const sessionId = normalizeOptional(params.sessionId);
    const messages = Object.freeze(
      (params.messages ?? []).map((message, index) => {
        const content = normalizeRequired(message.content, `messages[${index}].content`);
        const timestamp = normalizeTimestamp(message.timestamp);

        return Object.freeze({
          ...message,
          id: normalizeOptional(message.id) || `${params.id.trim()}:message:${index + 1}`,
          content,
          timestamp,
          metadata: Object.freeze({
            ...(message.metadata ?? {}),
            role: message.role,
            timestamp,
            conversationId,
            sessionId,
          }),
        });
      })
    );

    super({
      id: params.id,
      sourceType,
      label: params.label,
      order: params.order,
      precedence: params.precedence,
      visibility: params.visibility,
      metadata: {
        ...(params.metadata ?? {}),
        conversationId,
        sessionId,
      },
      fragments: messages.map((message, index) => ({
        id: message.id!,
        kind: "memory-snippets",
        title: `${roleLabel(message.role)} Message ${index + 1}`,
        content: `${roleLabel(message.role)}: ${message.content}`,
        order: index,
        metadata: message.metadata,
      })),
    });

    this.messages = messages;
    this.conversationId = conversationId;
    this.sessionId = sessionId;
  }
}
