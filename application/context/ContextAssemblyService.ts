import { AssembledContext, type IAssembledContextFragment, type IAssembledContextSection, type IContextFragmentProvenance } from "./models/AssembledContext";
import { ContextAssemblyRequest, type IContextAssemblyRequest } from "./models/ContextAssemblyRequest";
import { ContextAssemblyResult, type IContextAssemblyDecision } from "./models/ContextAssemblyResult";
import { ContextFragment, type ContextFragmentKind } from "./models/ContextFragment";

const SECTION_TITLES: Readonly<Record<ContextFragmentKind, string>> = Object.freeze({
  instructions: "System Instructions",
  persona: "Persona",
  "domain-notes": "Domain Notes",
  "retrieved-context": "Retrieved Knowledge",
  examples: "Examples",
  "memory-snippets": "Memory & History",
  "formatting-constraints": "Formatting Constraints",
});

type ContextAssemblyPackageSelection = ContextAssemblyRequest["packages"][number];

interface IAssemblyCandidate {
  readonly fragment: ContextFragment;
  readonly sourceType: "direct" | "package";
  readonly sourceOrder: number;
  readonly packageInput?: ContextAssemblyPackageSelection;
  readonly assemblyKey: string;
  readonly precedence: number;
  readonly provenance: ReadonlyArray<IContextFragmentProvenance>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}


function getAssemblyKey(fragment: ContextFragment): string {
  const metadataValue = fragment.metadata?.assemblyKey;
  return typeof metadataValue === "string" && metadataValue.trim()
    ? metadataValue.trim()
    : `${fragment.kind}:${fragment.id}`;
}

function getPrecedence(fragment: ContextFragment): number {
  const metadataValue = fragment.metadata?.precedence;
  return typeof metadataValue === "number" && Number.isFinite(metadataValue) ? metadataValue : 0;
}

function compareCandidates(left: IAssemblyCandidate, right: IAssemblyCandidate): number {
  return (
    right.precedence - left.precedence ||
    (left.sourceType === right.sourceType ? 0 : left.sourceType === "direct" ? -1 : 1) ||
    left.sourceOrder - right.sourceOrder ||
    left.fragment.order - right.fragment.order ||
    left.fragment.id.localeCompare(right.fragment.id)
  );
}

function compareAssembledFragments(
  left: IAssembledContextFragment,
  right: IAssembledContextFragment,
  kindOrder: ReadonlyArray<ContextFragmentKind>
): number {
  return (
    kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind) ||
    left.order - right.order ||
    left.id.localeCompare(right.id)
  );
}

function shouldIncludeByKind(
  fragmentKind: ContextFragmentKind,
  request: ContextAssemblyRequest
): boolean {
  if (request.includeKinds.length > 0 && !request.includeKinds.includes(fragmentKind)) {
    return false;
  }

  return !request.excludeKinds.includes(fragmentKind);
}

function shouldIncludeById(fragmentId: string, request: ContextAssemblyRequest): boolean {
  const includeIds = request.includeFragmentIds;

  if (includeIds.length > 0 && !includeIds.includes(fragmentId)) {
    return false;
  }

  return !request.excludeFragmentIds.includes(fragmentId);
}

function shouldIncludeFromPackage(candidate: IAssemblyCandidate): boolean {
  if (candidate.sourceType !== "package" || !candidate.packageInput) {
    return true;
  }

  const includeIds = candidate.packageInput.includeFragmentIds;
  if (includeIds && includeIds.length > 0 && !includeIds.includes(candidate.fragment.id)) {
    return false;
  }

  const excludeIds = candidate.packageInput.excludeFragmentIds;
  return !(excludeIds && excludeIds.includes(candidate.fragment.id));
}

function createDecision(
  candidate: IAssemblyCandidate,
  reason: IContextAssemblyDecision["reason"]
): IContextAssemblyDecision {
  return Object.freeze({
    id: candidate.fragment.id,
    kind: candidate.fragment.kind,
    title: candidate.fragment.title,
    content: candidate.fragment.content,
    order: candidate.fragment.order,
    precedence: candidate.precedence,
    assemblyKey: candidate.assemblyKey,
    reason,
    provenance: candidate.provenance,
  });
}

function buildProvenance(candidate: {
  readonly fragment: ContextFragment;
  readonly sourceType: "direct" | "package";
  readonly packageId?: string;
  readonly packageName?: string;
  readonly packageAlias?: string;
}): ReadonlyArray<IContextFragmentProvenance> {
  return Object.freeze([
    Object.freeze({
      sourceType: candidate.sourceType,
      packageId: normalizeOptional(candidate.packageId),
      packageName: normalizeOptional(candidate.packageName),
      packageAlias: normalizeOptional(candidate.packageAlias),
      fragmentId: candidate.fragment.id,
      fragmentTitle: normalizeOptional(candidate.fragment.title),
    }),
  ]);
}

export class ContextAssemblyService {
  public assemble(request: IContextAssemblyRequest = {}): ContextAssemblyResult {
    const normalizedRequest = new ContextAssemblyRequest(request);
    const candidates: IAssemblyCandidate[] = [];
    const includedFragments: IContextAssemblyDecision[] = [];
    const excludedFragments: IContextAssemblyDecision[] = [];

    for (const [index, fragment] of normalizedRequest.fragments.entries()) {
      candidates.push({
        fragment,
        sourceType: "direct",
        sourceOrder: index,
        assemblyKey: getAssemblyKey(fragment),
        precedence: getPrecedence(fragment),
        provenance: buildProvenance({ fragment, sourceType: "direct" }),
      });
    }

    for (const packageInput of normalizedRequest.packages) {
      for (const fragment of packageInput.contextPackage.fragments) {
        candidates.push({
          fragment,
          sourceType: "package",
          sourceOrder: packageInput.order,
          packageInput,
          assemblyKey: getAssemblyKey(fragment),
          precedence: getPrecedence(fragment),
          provenance: buildProvenance({
            fragment,
            sourceType: "package",
            packageId: packageInput.contextPackage.id,
            packageName: packageInput.contextPackage.name,
            packageAlias: packageInput.alias,
          }),
        });
      }
    }

    const eligibleCandidates: IAssemblyCandidate[] = [];

    for (const candidate of candidates) {
      if (!shouldIncludeByKind(candidate.fragment.kind, normalizedRequest)) {
        excludedFragments.push(createDecision(candidate, "excluded-by-kind"));
        continue;
      }

      if (!shouldIncludeById(candidate.fragment.id, normalizedRequest)) {
        excludedFragments.push(createDecision(candidate, "excluded-by-fragment-id"));
        continue;
      }

      if (!shouldIncludeFromPackage(candidate)) {
        excludedFragments.push(createDecision(candidate, "excluded-by-package-filter"));
        continue;
      }

      eligibleCandidates.push(candidate);
    }

    const groupedCandidates = new Map<string, IAssemblyCandidate[]>();

    for (const candidate of eligibleCandidates) {
      const group = groupedCandidates.get(candidate.assemblyKey) ?? [];
      group.push(candidate);
      groupedCandidates.set(candidate.assemblyKey, group);
    }

    const assembledFragments: IAssembledContextFragment[] = [];

    for (const group of groupedCandidates.values()) {
      const orderedGroup = [...group].sort(compareCandidates);
      const winner = orderedGroup[0];
      const shadowed = orderedGroup.slice(1);

      assembledFragments.push(
        Object.freeze({
          id: winner.fragment.id,
          kind: winner.fragment.kind,
          title: winner.fragment.title,
          content: winner.fragment.content,
          order: winner.fragment.order,
          assemblyKey: winner.assemblyKey,
          precedence: winner.precedence,
          provenance: Object.freeze(orderedGroup.flatMap((candidate) => candidate.provenance)),
          metadata: winner.fragment.metadata,
        })
      );

      includedFragments.push(createDecision(winner, "included"));
      excludedFragments.push(...shadowed.map((candidate) => createDecision(candidate, "shadowed-by-precedence")));
    }

    const orderedFragments = Object.freeze(
      [...assembledFragments].sort((left, right) =>
        compareAssembledFragments(left, right, normalizedRequest.kindOrder)
      )
    );

    const sections: IAssembledContextSection[] = [];

    for (const kind of normalizedRequest.kindOrder) {
      const fragments = orderedFragments.filter((fragment) => fragment.kind === kind);

      if (fragments.length === 0) {
        continue;
      }

      sections.push(
        Object.freeze({
          kind,
          title: SECTION_TITLES[kind] ?? kind,
          fragments,
          content: fragments.map((fragment) => fragment.content).join(normalizedRequest.separator),
        })
      );
    }

    const promptText = sections.map((section) => `${section.title}:\n${section.content}`).join(normalizedRequest.separator);

    return new ContextAssemblyResult({
      assembledContext: new AssembledContext({
        fragments: orderedFragments,
        sections,
        promptText: promptText || "Context assembly produced no fragments.",
      }),
      includedFragments: Object.freeze(
        [...includedFragments].sort(
          (left, right) =>
            normalizedRequest.kindOrder.indexOf(left.kind) - normalizedRequest.kindOrder.indexOf(right.kind) ||
            left.id.localeCompare(right.id)
        )
      ),
      excludedFragments: Object.freeze(
        [...excludedFragments].sort(
          (left, right) =>
            normalizedRequest.kindOrder.indexOf(left.kind) - normalizedRequest.kindOrder.indexOf(right.kind) ||
            left.id.localeCompare(right.id)
        )
      ),
    });
  }
}
