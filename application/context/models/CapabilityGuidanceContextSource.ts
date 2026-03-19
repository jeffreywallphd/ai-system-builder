import { DynamicContextSource, type DynamicContextSourceType } from "./DynamicContextSource";
import type { ToolCapabilityProviderKind } from "../../tools/models/ToolCapabilityDescriptor";

export interface ICapabilityGuidanceFragment {
  readonly id?: string;
  readonly title?: string;
  readonly content: string;
  readonly kind?: "instructions" | "domain-notes" | "formatting-constraints";
  readonly toolInstructions?: string;
  readonly toolUsePolicy?: Readonly<Record<string, unknown>>;
  readonly providerKind?: ToolCapabilityProviderKind;
  readonly serverId?: string;
  readonly toolNames?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`CapabilityGuidanceContextSource.${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

export class CapabilityGuidanceContextSource extends DynamicContextSource {
  public readonly guidance: ReadonlyArray<ICapabilityGuidanceFragment>;

  constructor(params: {
    id: string;
    label?: string;
    order?: number;
    precedence?: number;
    metadata?: Readonly<Record<string, unknown>>;
    guidance: ReadonlyArray<ICapabilityGuidanceFragment>;
  }) {
    const sourceType: DynamicContextSourceType = "capability-guidance";
    const guidance = Object.freeze(
      (params.guidance ?? []).map((fragment, index) => {
        const providerKind = fragment.providerKind;
        const serverId = normalizeOptional(fragment.serverId);
        const toolNames = normalizeStringList(fragment.toolNames);
        const toolInstructions = normalizeOptional(fragment.toolInstructions) ?? normalizeRequired(fragment.content, `guidance[${index}].content`);
        const baseToolUsePolicy =
          fragment.toolUsePolicy && typeof fragment.toolUsePolicy === "object"
            ? (fragment.toolUsePolicy as Record<string, unknown>)
            : undefined;

        return Object.freeze({
          ...fragment,
          id: normalizeOptional(fragment.id) || `${params.id.trim()}:guidance:${index + 1}`,
          title: normalizeOptional(fragment.title),
          content: normalizeRequired(fragment.content, `guidance[${index}].content`),
          kind: fragment.kind ?? "instructions",
          toolInstructions,
          providerKind,
          serverId,
          toolNames,
          toolUsePolicy: Object.freeze({
            ...(baseToolUsePolicy ?? {}),
            allowedProviderKinds:
              providerKind && !Array.isArray(baseToolUsePolicy?.allowedProviderKinds)
                ? [providerKind]
                : baseToolUsePolicy?.allowedProviderKinds,
            mcp:
              serverId || toolNames
                ? {
                    ...((baseToolUsePolicy?.mcp as Record<string, unknown> | undefined) ?? {}),
                    allowedServerIds:
                      serverId && !Array.isArray((baseToolUsePolicy?.mcp as Record<string, unknown> | undefined)?.allowedServerIds)
                        ? [serverId]
                        : (baseToolUsePolicy?.mcp as Record<string, unknown> | undefined)?.allowedServerIds,
                    allowedToolNames:
                      toolNames && !Array.isArray((baseToolUsePolicy?.mcp as Record<string, unknown> | undefined)?.allowedToolNames)
                        ? toolNames
                        : (baseToolUsePolicy?.mcp as Record<string, unknown> | undefined)?.allowedToolNames,
                  }
                : baseToolUsePolicy?.mcp,
          }),
          metadata: Object.freeze({
            ...(fragment.metadata ?? {}),
            providerKind,
            serverId,
            toolNames,
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
      metadata: params.metadata,
      fragments: guidance.map((fragment, index) => ({
        id: fragment.id!,
        kind: fragment.kind!,
        title: fragment.title ?? `Capability Guidance ${index + 1}`,
        content: fragment.content,
        order: index,
        metadata: {
          ...(fragment.metadata ?? {}),
          toolInstructions: fragment.toolInstructions,
          toolUsePolicy: fragment.toolUsePolicy,
        },
      })),
    });

    this.guidance = guidance;
  }
}
