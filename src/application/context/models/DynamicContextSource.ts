import { ContextFragment, type ContextFragmentKind, type IContextFragment } from "./ContextFragment";
import type { ContextVisibilityMode } from "./ContextVisibilityMode";

export type DynamicContextSourceType =
  | "retrieved"
  | "memory"
  | "example"
  | "capability-guidance"
  | "runtime";

export interface IDynamicContextSourceFragmentInput {
  readonly id: string;
  readonly kind: ContextFragmentKind;
  readonly title?: string;
  readonly content: string;
  readonly order?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IDynamicContextSource {
  readonly id: string;
  readonly sourceType: DynamicContextSourceType;
  readonly label?: string;
  readonly order: number;
  readonly precedence: number;
  readonly visibility?: ContextVisibilityMode;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly fragments: ReadonlyArray<IContextFragment>;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`DynamicContextSource.${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function freezeMetadata(
  metadata?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | undefined {
  return metadata ? Object.freeze({ ...metadata }) : undefined;
}

function normalizeFragmentMetadata(
  source: {
    readonly id: string;
    readonly sourceType: DynamicContextSourceType;
    readonly label?: string;
    readonly precedence: number;
    readonly visibility?: ContextVisibilityMode;
    readonly metadata?: Readonly<Record<string, unknown>>;
  },
  fragment: IDynamicContextSourceFragmentInput,
  fragmentIndex: number
): Readonly<Record<string, unknown>> {
  const metadata = {
    ...(source.metadata ?? {}),
    ...(fragment.metadata ?? {}),
    sourceType: "dynamic",
    dynamicSourceId: source.id,
    dynamicSourceType: source.sourceType,
    dynamicSourceLabel: source.label,
    dynamicSourcePrecedence: source.precedence,
    dynamicSourceFragmentIndex: fragmentIndex,
    visibility: fragment.metadata?.visibility ?? source.visibility,
  } satisfies Record<string, unknown>;

  return Object.freeze(
    Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined))
  );
}

function freezeFragments(
  source: {
    readonly id: string;
    readonly sourceType: DynamicContextSourceType;
    readonly label?: string;
    readonly precedence: number;
    readonly visibility?: ContextVisibilityMode;
    readonly metadata?: Readonly<Record<string, unknown>>;
  },
  fragments?: ReadonlyArray<IDynamicContextSourceFragmentInput>
): ReadonlyArray<ContextFragment> {
  return Object.freeze(
    (fragments ?? []).map((fragment, index) =>
      new ContextFragment({
        id: normalizeRequired(fragment.id, `fragments[${index}].id`),
        kind: fragment.kind,
        title: normalizeOptional(fragment.title),
        content: normalizeRequired(fragment.content, `fragments[${index}].content`),
        order: fragment.order ?? index,
        metadata: normalizeFragmentMetadata(source, fragment, index),
      })
    )
  );
}

export class DynamicContextSource implements IDynamicContextSource {
  public readonly id: string;
  public readonly sourceType: DynamicContextSourceType;
  public readonly label?: string;
  public readonly order: number;
  public readonly precedence: number;
  public readonly visibility?: ContextVisibilityMode;
  public readonly metadata?: Readonly<Record<string, unknown>>;
  public readonly fragments: ReadonlyArray<ContextFragment>;

  constructor(params: {
    id: string;
    sourceType: DynamicContextSourceType;
    label?: string;
    order?: number;
    precedence?: number;
    visibility?: ContextVisibilityMode;
    metadata?: Readonly<Record<string, unknown>>;
    fragments?: ReadonlyArray<IDynamicContextSourceFragmentInput>;
  }) {
    this.id = normalizeRequired(params.id, "id");
    this.sourceType = params.sourceType;
    this.label = normalizeOptional(params.label);
    this.order = params.order ?? 0;
    this.precedence = Number.isFinite(params.precedence) ? Number(params.precedence) : 0;
    this.visibility = params.visibility;
    this.metadata = freezeMetadata(params.metadata);
    this.fragments = freezeFragments(this, params.fragments);
  }
}
