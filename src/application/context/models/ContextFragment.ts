export type ContextFragmentKind =
  | "instructions"
  | "persona"
  | "domain-notes"
  | "retrieved-context"
  | "examples"
  | "memory-snippets"
  | "formatting-constraints";

export interface IContextFragment {
  readonly id: string;
  readonly kind: ContextFragmentKind;
  readonly title?: string;
  readonly content: string;
  readonly order: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`ContextFragment.${fieldName} cannot be empty.`);
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

export class ContextFragment implements IContextFragment {
  public readonly id: string;
  public readonly kind: ContextFragmentKind;
  public readonly title?: string;
  public readonly content: string;
  public readonly order: number;
  public readonly metadata?: Readonly<Record<string, unknown>>;

  constructor(params: {
    id: string;
    kind: ContextFragmentKind;
    title?: string;
    content: string;
    order?: number;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.id = normalizeRequired(params.id, "id");
    this.kind = params.kind;
    this.title = normalizeOptional(params.title);
    this.content = normalizeRequired(params.content, "content");
    this.order = params.order ?? 0;
    this.metadata = freezeMetadata(params.metadata);
  }

  public static from(fragment: IContextFragment): ContextFragment {
    return new ContextFragment({
      id: fragment.id,
      kind: fragment.kind,
      title: fragment.title,
      content: fragment.content,
      order: fragment.order,
      metadata: fragment.metadata,
    });
  }
}
