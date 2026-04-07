import type { ContextFragmentKind } from "./ContextFragment";
import { type ContextVisibilityMode, isContextVisibilityMode } from "./ContextVisibilityMode";

export interface IContextTrimmingPolicy {
  readonly visibilityMode?: ContextVisibilityMode;
  readonly includeKinds?: ReadonlyArray<ContextFragmentKind>;
  readonly excludeKinds?: ReadonlyArray<ContextFragmentKind>;
  readonly includeSources?: ReadonlyArray<string>;
  readonly excludeSources?: ReadonlyArray<string>;
}

function freezeKinds(values?: ReadonlyArray<ContextFragmentKind>): ReadonlyArray<ContextFragmentKind> {
  return Object.freeze([...(values ?? [])]);
}

function freezeStrings(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze(
    [...new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))]
  );
}

export class ContextTrimmingPolicy implements IContextTrimmingPolicy {
  public readonly visibilityMode: ContextVisibilityMode;
  public readonly includeKinds: ReadonlyArray<ContextFragmentKind>;
  public readonly excludeKinds: ReadonlyArray<ContextFragmentKind>;
  public readonly includeSources: ReadonlyArray<string>;
  public readonly excludeSources: ReadonlyArray<string>;

  constructor(params: IContextTrimmingPolicy = {}) {
    if (params.visibilityMode !== undefined && !isContextVisibilityMode(params.visibilityMode)) {
      throw new Error("ContextTrimmingPolicy.visibilityMode must be 'basic' or 'advanced'.");
    }

    this.visibilityMode = params.visibilityMode ?? "advanced";
    this.includeKinds = freezeKinds(params.includeKinds);
    this.excludeKinds = freezeKinds(params.excludeKinds);
    this.includeSources = freezeStrings(params.includeSources);
    this.excludeSources = freezeStrings(params.excludeSources);
  }
}
