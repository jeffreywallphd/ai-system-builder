import {
  ContextFragment,
  type ContextFragmentKind,
  type IContextFragment,
} from "./ContextFragment";
import { ContextPackage, type IContextPackage } from "./ContextPackage";
import { DynamicContextSource, type IDynamicContextSource } from "./DynamicContextSource";
import { RetrievedContextSource, type IRetrievedContextDocument } from "./RetrievedContextSource";
import { MemoryContextSource, type IMemoryContextMessage } from "./MemoryContextSource";
import { ExampleContextSource, type IExampleContextItem } from "./ExampleContextSource";
import { CapabilityGuidanceContextSource, type ICapabilityGuidanceFragment } from "./CapabilityGuidanceContextSource";

export const DEFAULT_CONTEXT_ASSEMBLY_KIND_ORDER = Object.freeze<ReadonlyArray<ContextFragmentKind>>([
  "instructions",
  "persona",
  "domain-notes",
  "retrieved-context",
  "examples",
  "memory-snippets",
  "formatting-constraints",
]);

export interface IContextAssemblyPackageInput {
  readonly contextPackage: ContextPackage | IContextPackage;
  readonly alias?: string;
  readonly includeFragmentIds?: ReadonlyArray<string>;
  readonly excludeFragmentIds?: ReadonlyArray<string>;
  readonly order?: number;
}

interface IDynamicContextSourceInputBase {
  readonly id: string;
  readonly label?: string;
  readonly order?: number;
  readonly precedence?: number;
  readonly visibility?: IDynamicContextSource["visibility"];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type DynamicContextSourceInput =
  | DynamicContextSource
  | IDynamicContextSource
  | ({ readonly sourceType: "retrieved"; readonly documents: ReadonlyArray<IRetrievedContextDocument> } & IDynamicContextSourceInputBase)
  | ({
      readonly sourceType: "memory";
      readonly conversationId?: string;
      readonly sessionId?: string;
      readonly messages: ReadonlyArray<IMemoryContextMessage>;
    } & IDynamicContextSourceInputBase)
  | ({ readonly sourceType: "example"; readonly examples: ReadonlyArray<IExampleContextItem> } & IDynamicContextSourceInputBase)
  | ({ readonly sourceType: "capability-guidance"; readonly guidance: ReadonlyArray<ICapabilityGuidanceFragment> } & IDynamicContextSourceInputBase);

export interface IContextAssemblyRequest {
  readonly packages?: ReadonlyArray<IContextAssemblyPackageInput>;
  readonly fragments?: ReadonlyArray<IContextFragment>;
  readonly dynamicSources?: ReadonlyArray<DynamicContextSourceInput>;
  readonly includeKinds?: ReadonlyArray<ContextFragmentKind>;
  readonly excludeKinds?: ReadonlyArray<ContextFragmentKind>;
  readonly includeFragmentIds?: ReadonlyArray<string>;
  readonly excludeFragmentIds?: ReadonlyArray<string>;
  readonly kindOrder?: ReadonlyArray<ContextFragmentKind>;
  readonly separator?: string;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function freezeIds(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]);
}

function freezeKinds(
  values: ReadonlyArray<ContextFragmentKind> | undefined,
  fallback: ReadonlyArray<ContextFragmentKind> = []
): ReadonlyArray<ContextFragmentKind> {
  const resolved = values ?? fallback;
  return Object.freeze([...new Set(resolved)]);
}

function freezePackages(
  packages?: ReadonlyArray<IContextAssemblyPackageInput>
): ReadonlyArray<{
  readonly contextPackage: ContextPackage;
  readonly alias?: string;
  readonly includeFragmentIds?: ReadonlyArray<string>;
  readonly excludeFragmentIds?: ReadonlyArray<string>;
  readonly order: number;
}> {
  return Object.freeze(
    (packages ?? []).map((entry, index) =>
      Object.freeze({
        contextPackage: ContextPackage.from(entry.contextPackage),
        alias: normalizeOptional(entry.alias),
        includeFragmentIds:
          entry.includeFragmentIds && entry.includeFragmentIds.length > 0
            ? freezeIds(entry.includeFragmentIds)
            : undefined,
        excludeFragmentIds:
          entry.excludeFragmentIds && entry.excludeFragmentIds.length > 0
            ? freezeIds(entry.excludeFragmentIds)
            : undefined,
        order: entry.order ?? index,
      })
    )
  );
}

function freezeFragments(
  fragments?: ReadonlyArray<IContextFragment>
): ReadonlyArray<ContextFragment> {
  return Object.freeze((fragments ?? []).map((fragment) => ContextFragment.from(fragment)));
}


function freezeDynamicSources(
  sources?: ReadonlyArray<DynamicContextSourceInput>
): ReadonlyArray<DynamicContextSource> {
  return Object.freeze((sources ?? []).map((source, index) => createDynamicContextSource(source, index)));
}

function createDynamicContextSource(source: DynamicContextSourceInput, index: number): DynamicContextSource {
  if (source instanceof DynamicContextSource) {
    return source;
  }

  if (source.sourceType === "retrieved" && "documents" in source) {
    return new RetrievedContextSource({
      id: source.id,
      label: source.label,
      order: source.order ?? index,
      precedence: source.precedence,
      metadata: source.metadata,
      documents: source.documents,
    });
  }

  if (source.sourceType === "memory" && "messages" in source) {
    return new MemoryContextSource({
      id: source.id,
      label: source.label,
      order: source.order ?? index,
      precedence: source.precedence,
      visibility: source.visibility,
      metadata: source.metadata,
      conversationId: source.conversationId,
      sessionId: source.sessionId,
      messages: source.messages,
    });
  }

  if (source.sourceType === "example" && "examples" in source) {
    return new ExampleContextSource({
      id: source.id,
      label: source.label,
      order: source.order ?? index,
      precedence: source.precedence,
      metadata: source.metadata,
      examples: source.examples,
    });
  }

  if (source.sourceType === "capability-guidance" && "guidance" in source) {
    return new CapabilityGuidanceContextSource({
      id: source.id,
      label: source.label,
      order: source.order ?? index,
      precedence: source.precedence,
      metadata: source.metadata,
      guidance: source.guidance,
    });
  }

  return new DynamicContextSource({
    id: source.id,
    sourceType: source.sourceType,
    label: source.label,
    order: source.order ?? index,
    precedence: source.precedence,
    visibility: source.visibility,
    metadata: source.metadata,
    fragments: source.fragments,
  });
}

export class ContextAssemblyRequest implements IContextAssemblyRequest {
  public readonly packages: ReadonlyArray<{
    readonly contextPackage: ContextPackage;
    readonly alias?: string;
    readonly includeFragmentIds?: ReadonlyArray<string>;
    readonly excludeFragmentIds?: ReadonlyArray<string>;
    readonly order: number;
  }>;
  public readonly fragments: ReadonlyArray<ContextFragment>;
  public readonly dynamicSources: ReadonlyArray<DynamicContextSource>;
  public readonly includeKinds: ReadonlyArray<ContextFragmentKind>;
  public readonly excludeKinds: ReadonlyArray<ContextFragmentKind>;
  public readonly includeFragmentIds: ReadonlyArray<string>;
  public readonly excludeFragmentIds: ReadonlyArray<string>;
  public readonly kindOrder: ReadonlyArray<ContextFragmentKind>;
  public readonly separator: string;

  constructor(params: IContextAssemblyRequest = {}) {
    this.packages = freezePackages(params.packages);
    this.fragments = freezeFragments(params.fragments);
    this.dynamicSources = freezeDynamicSources(params.dynamicSources);
    this.includeKinds = freezeKinds(params.includeKinds);
    this.excludeKinds = freezeKinds(params.excludeKinds);
    this.includeFragmentIds = freezeIds(params.includeFragmentIds);
    this.excludeFragmentIds = freezeIds(params.excludeFragmentIds);
    this.kindOrder = freezeKinds(params.kindOrder, DEFAULT_CONTEXT_ASSEMBLY_KIND_ORDER);
    this.separator = params.separator ?? "\n\n";
  }
}
