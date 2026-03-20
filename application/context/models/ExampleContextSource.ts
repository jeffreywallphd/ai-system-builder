import { DynamicContextSource, type DynamicContextSourceType } from "./DynamicContextSource";

export interface IExampleContextItem {
  readonly id?: string;
  readonly title?: string;
  readonly input?: string;
  readonly output?: string;
  readonly content?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveExampleContent(example: IExampleContextItem, index: number): string {
  const directContent = normalizeOptional(example.content);
  if (directContent) {
    return directContent;
  }

  const input = normalizeOptional(example.input);
  const output = normalizeOptional(example.output);

  if (!input && !output) {
    throw new Error(`ExampleContextSource.examples[${index}] must include content or input/output.`);
  }

  return [
    input ? `Input:\n${input}` : undefined,
    output ? `Output:\n${output}` : undefined,
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n\n");
}

export class ExampleContextSource extends DynamicContextSource {
  public readonly examples: ReadonlyArray<IExampleContextItem>;

  constructor(params: {
    id: string;
    label?: string;
    order?: number;
    precedence?: number;
    metadata?: Readonly<Record<string, unknown>>;
    examples: ReadonlyArray<IExampleContextItem>;
  }) {
    const sourceType: DynamicContextSourceType = "example";
    const examples = Object.freeze(
      (params.examples ?? []).map((example, index) =>
        Object.freeze({
          ...example,
          id: normalizeOptional(example.id) || `${params.id.trim()}:example:${index + 1}`,
          title: normalizeOptional(example.title),
          input: normalizeOptional(example.input),
          output: normalizeOptional(example.output),
          content: resolveExampleContent(example, index),
          metadata: Object.freeze({
            ...(example.metadata ?? {}),
            exampleIndex: index,
          }),
        })
      )
    );

    super({
      id: params.id,
      sourceType,
      label: params.label,
      order: params.order,
      precedence: params.precedence,
      metadata: params.metadata,
      fragments: examples.map((example, index) => ({
        id: example.id!,
        kind: "examples",
        title: example.title ?? `Example ${index + 1}`,
        content: example.content!,
        order: index,
        metadata: example.metadata,
      })),
    });

    this.examples = examples;
  }
}
