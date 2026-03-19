import type { ContextFragmentKind } from "./ContextFragment";

export interface IContextFragmentProvenance {
  readonly sourceType: "direct" | "package";
  readonly packageId?: string;
  readonly packageName?: string;
  readonly packageAlias?: string;
  readonly fragmentId: string;
  readonly fragmentTitle?: string;
}

export interface IAssembledContextFragment {
  readonly id: string;
  readonly kind: ContextFragmentKind;
  readonly title?: string;
  readonly content: string;
  readonly order: number;
  readonly assemblyKey: string;
  readonly precedence: number;
  readonly provenance: ReadonlyArray<IContextFragmentProvenance>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IAssembledContextSection {
  readonly kind: ContextFragmentKind;
  readonly title: string;
  readonly fragments: ReadonlyArray<IAssembledContextFragment>;
  readonly content: string;
}

export interface IAssembledContext {
  readonly fragments: ReadonlyArray<IAssembledContextFragment>;
  readonly sections: ReadonlyArray<IAssembledContextSection>;
  readonly promptText: string;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`AssembledContext.${fieldName} cannot be empty.`);
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

function freezeProvenance(
  provenance?: ReadonlyArray<IContextFragmentProvenance>
): ReadonlyArray<IContextFragmentProvenance> {
  return Object.freeze(
    (provenance ?? []).map((entry) =>
      Object.freeze({
        ...entry,
        packageId: normalizeOptional(entry.packageId),
        packageName: normalizeOptional(entry.packageName),
        packageAlias: normalizeOptional(entry.packageAlias),
        fragmentId: normalizeRequired(entry.fragmentId, "provenance.fragmentId"),
        fragmentTitle: normalizeOptional(entry.fragmentTitle),
      })
    )
  );
}

function freezeFragments(
  fragments?: ReadonlyArray<IAssembledContextFragment>
): ReadonlyArray<IAssembledContextFragment> {
  return Object.freeze(
    (fragments ?? []).map((fragment) =>
      Object.freeze({
        ...fragment,
        id: normalizeRequired(fragment.id, "fragment.id"),
        title: normalizeOptional(fragment.title),
        content: normalizeRequired(fragment.content, "fragment.content"),
        assemblyKey: normalizeRequired(fragment.assemblyKey, "fragment.assemblyKey"),
        provenance: freezeProvenance(fragment.provenance),
        metadata: freezeMetadata(fragment.metadata),
      })
    )
  );
}

function freezeSections(
  sections?: ReadonlyArray<IAssembledContextSection>
): ReadonlyArray<IAssembledContextSection> {
  return Object.freeze(
    (sections ?? []).map((section) =>
      Object.freeze({
        ...section,
        title: normalizeRequired(section.title, "section.title"),
        content: normalizeRequired(section.content, "section.content"),
        fragments: freezeFragments(section.fragments),
      })
    )
  );
}

export class AssembledContext implements IAssembledContext {
  public readonly fragments: ReadonlyArray<IAssembledContextFragment>;
  public readonly sections: ReadonlyArray<IAssembledContextSection>;
  public readonly promptText: string;

  constructor(params: IAssembledContext) {
    this.fragments = freezeFragments(params.fragments);
    this.sections = freezeSections(params.sections);
    this.promptText = normalizeRequired(params.promptText, "promptText");
  }
}
