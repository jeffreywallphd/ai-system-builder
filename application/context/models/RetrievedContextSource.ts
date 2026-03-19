import { DynamicContextSource, type DynamicContextSourceType } from "./DynamicContextSource";

export interface IRetrievedContextDocument {
  readonly id?: string;
  readonly title?: string;
  readonly content?: string;
  readonly text?: string;
  readonly score?: number;
  readonly uri?: string;
  readonly source?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`RetrievedContextSource.${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveContent(document: IRetrievedContextDocument, index: number): string {
  const content = document.content ?? document.text;
  const normalized = content?.trim();

  if (!normalized) {
    throw new Error(`RetrievedContextSource.documents[${index}].content cannot be empty.`);
  }

  return normalized;
}

function resolveMetadata(document: IRetrievedContextDocument): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ...(document.metadata ?? {}),
    score: typeof document.score === "number" ? document.score : undefined,
    uri: normalizeOptional(document.uri),
    source: normalizeOptional(document.source),
  });
}

export class RetrievedContextSource extends DynamicContextSource {
  public readonly documents: ReadonlyArray<IRetrievedContextDocument>;

  constructor(params: {
    id: string;
    label?: string;
    order?: number;
    precedence?: number;
    metadata?: Readonly<Record<string, unknown>>;
    documents: ReadonlyArray<IRetrievedContextDocument>;
  }) {
    const sourceType: DynamicContextSourceType = "retrieved";
    const documents = Object.freeze(
      (params.documents ?? []).map((document, index) =>
        Object.freeze({
          ...document,
          id: normalizeOptional(document.id) || `${params.id.trim()}:doc:${index + 1}`,
          title: normalizeOptional(document.title),
          content: resolveContent(document, index),
          text: undefined,
          uri: normalizeOptional(document.uri),
          source: normalizeOptional(document.source),
          score: typeof document.score === "number" ? document.score : undefined,
          metadata: resolveMetadata(document),
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
      fragments: documents.map((document, index) => ({
        id: normalizeRequired(document.id!, `documents[${index}].id`),
        kind: "retrieved-context",
        title: document.title,
        content: document.content!,
        order: index,
        metadata: document.metadata,
      })),
    });

    this.documents = documents;
  }
}
