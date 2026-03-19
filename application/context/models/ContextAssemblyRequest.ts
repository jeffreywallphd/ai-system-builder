import {
  ContextFragment,
  type ContextFragmentKind,
  type IContextFragment,
} from "./ContextFragment";
import { ContextPackage, type IContextPackage } from "./ContextPackage";

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

export interface IContextAssemblyRequest {
  readonly packages?: ReadonlyArray<IContextAssemblyPackageInput>;
  readonly fragments?: ReadonlyArray<IContextFragment>;
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

export class ContextAssemblyRequest implements IContextAssemblyRequest {
  public readonly packages: ReadonlyArray<{
    readonly contextPackage: ContextPackage;
    readonly alias?: string;
    readonly includeFragmentIds?: ReadonlyArray<string>;
    readonly excludeFragmentIds?: ReadonlyArray<string>;
    readonly order: number;
  }>;
  public readonly fragments: ReadonlyArray<ContextFragment>;
  public readonly includeKinds: ReadonlyArray<ContextFragmentKind>;
  public readonly excludeKinds: ReadonlyArray<ContextFragmentKind>;
  public readonly includeFragmentIds: ReadonlyArray<string>;
  public readonly excludeFragmentIds: ReadonlyArray<string>;
  public readonly kindOrder: ReadonlyArray<ContextFragmentKind>;
  public readonly separator: string;

  constructor(params: IContextAssemblyRequest = {}) {
    this.packages = freezePackages(params.packages);
    this.fragments = freezeFragments(params.fragments);
    this.includeKinds = freezeKinds(params.includeKinds);
    this.excludeKinds = freezeKinds(params.excludeKinds);
    this.includeFragmentIds = freezeIds(params.includeFragmentIds);
    this.excludeFragmentIds = freezeIds(params.excludeFragmentIds);
    this.kindOrder = freezeKinds(params.kindOrder, DEFAULT_CONTEXT_ASSEMBLY_KIND_ORDER);
    this.separator = params.separator ?? "\n\n";
  }
}
