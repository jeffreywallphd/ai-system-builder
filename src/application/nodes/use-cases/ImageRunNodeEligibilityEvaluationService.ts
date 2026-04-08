import {
  evaluateImageExecutionNodeCompatibility,
  ImageExecutionNodeCompatibilityFindingKinds,
  type ExecutionNodeRecord,
  type ImageExecutionNodeCompatibilityRequirements,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  ExecutionNodeEligibilityDecisionKinds,
  type ExecutionNodeEligibilityDecisionKind,
  type ExecutionNodeEligibilityEvaluation,
  type ExecutionNodeListQuery,
  type ExecutionNodeSelectionHint,
  type IExecutionNodeEligibilityEvaluationServicePort,
  type IExecutionNodeRepository,
  type IExecutionNodeSelectionHintsServicePort,
  type IImageRunNodeEligibilityEvaluationServicePort,
  type ImageRunNodeCompatibilityHints,
  type ImageRunNodeEligibilityRequirements,
  type ImageRunNodeEligibilityResult,
  type ImageRunNodeEligibilityRunContext,
  type ImageRunNodeEligibilitySummary,
} from "@application/nodes/ports/ExecutionNodeManagementPorts";

interface ImageRunNodeEligibilityEvaluationServiceDependencies {
  readonly nodeRepository: Pick<IExecutionNodeRepository, "findExecutionNodeById" | "listExecutionNodes">;
}

const UnknownRunContext = Object.freeze({
  runId: "run:unknown",
  workspaceId: "workspace:unknown",
} as const satisfies ImageRunNodeEligibilityRunContext);

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeArray(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const value of values ?? []) {
    const normalized = normalizeOptional(value)?.toLowerCase();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped.values()]);
}

function mergeRequiredArrays(
  requiredValues: ReadonlyArray<string>,
  hintedValues: ReadonlyArray<string>,
): ReadonlyArray<string> {
  if (requiredValues.length === 0) {
    return hintedValues;
  }
  if (hintedValues.length === 0) {
    return requiredValues;
  }
  return Object.freeze([...new Set([...requiredValues, ...hintedValues])]);
}

function toDecision(input: {
  readonly compatible: boolean;
  readonly routable: boolean;
}): ExecutionNodeEligibilityDecisionKind {
  if (input.routable) {
    return ExecutionNodeEligibilityDecisionKinds.eligible;
  }
  if (input.compatible) {
    return ExecutionNodeEligibilityDecisionKinds.unavailable;
  }
  return ExecutionNodeEligibilityDecisionKinds.incompatible;
}

function toDecisionRank(decision: ExecutionNodeEligibilityDecisionKind): number {
  if (decision === ExecutionNodeEligibilityDecisionKinds.eligible) {
    return 0;
  }
  if (decision === ExecutionNodeEligibilityDecisionKinds.unavailable) {
    return 1;
  }
  return 2;
}

function normalizeHints(
  hints: ImageRunNodeCompatibilityHints | undefined,
): ImageRunNodeCompatibilityHints | undefined {
  if (!hints) {
    return undefined;
  }

  const normalized: ImageRunNodeCompatibilityHints = Object.freeze({
    requiredOperationCapability: normalizeOptional(hints.requiredOperationCapability)?.toLowerCase(),
    requiredInputKinds: normalizeArray(hints.requiredInputKinds),
    requiredOutputKinds: normalizeArray(hints.requiredOutputKinds),
    translationBackendFamilies: normalizeArray(hints.translationBackendFamilies),
    readinessChecks: Object.freeze({
      operationCapability: hints.readinessChecks?.operationCapability,
      inputKinds: hints.readinessChecks?.inputKinds,
      outputKinds: hints.readinessChecks?.outputKinds,
      translationBackendFamily: hints.readinessChecks?.translationBackendFamily,
    }),
  });

  return normalized;
}

function normalizeRequirements(
  requirements: ImageRunNodeEligibilityRequirements | undefined,
): ImageExecutionNodeCompatibilityRequirements {
  const hints = normalizeHints(requirements?.compatibilityHints);
  const hintedBackendFamilies = hints?.readinessChecks?.translationBackendFamily
    ? (hints.translationBackendFamilies ?? [])
    : [];
  const hintedInputKinds = hints?.readinessChecks?.inputKinds
    ? (hints.requiredInputKinds ?? [])
    : [];
  const hintedOutputKinds = hints?.readinessChecks?.outputKinds
    ? (hints.requiredOutputKinds ?? [])
    : [];
  const hintedOperationCapability = hints?.readinessChecks?.operationCapability
    ? hints.requiredOperationCapability
    : undefined;

  return Object.freeze({
    requiredBackendFamilies: mergeRequiredArrays(
      normalizeArray(requirements?.requiredBackendFamilies),
      hintedBackendFamilies,
    ),
    requiredExecutionTarget: normalizeOptional(requirements?.requiredExecutionTarget)?.toLowerCase(),
    requiredNodeCapabilities: requirements?.requiredNodeCapabilities,
    requiresRemoteScheduling: requirements?.requiresRemoteScheduling,
    requiredOperationKind: normalizeOptional(requirements?.requiredOperationKind)?.toLowerCase(),
    requiredOperationCapability:
      normalizeOptional(requirements?.requiredOperationCapability)?.toLowerCase()
      ?? hintedOperationCapability,
    requiredInputKinds: mergeRequiredArrays(
      normalizeArray(requirements?.requiredInputKinds),
      hintedInputKinds,
    ),
    requiredOutputKinds: mergeRequiredArrays(
      normalizeArray(requirements?.requiredOutputKinds),
      hintedOutputKinds,
    ),
    requiredTranslationContractVersion:
      normalizeOptional(requirements?.requiredTranslationContractVersion)?.toLowerCase(),
    preferredResourceClassHints: normalizeArray(requirements?.preferredResourceClassHints),
    allowDegraded: requirements?.allowDegraded,
    maxLastSeenAgeMs: requirements?.maxLastSeenAgeMs,
  });
}

function toEligibilitySummary(
  findings: ReadonlyArray<ImageRunNodeEligibilityResult["findings"][number]>,
): ImageRunNodeEligibilitySummary {
  const blockingReasonCodes = findings
    .filter((finding) => finding.blocking)
    .map((finding) => finding.code);
  const advisoryReasonCodes = findings
    .filter((finding) => finding.kind === ImageExecutionNodeCompatibilityFindingKinds.softAdvisory)
    .map((finding) => finding.code);
  const transientAvailabilityReasonCodes = findings
    .filter((finding) => finding.kind === ImageExecutionNodeCompatibilityFindingKinds.transientAvailability)
    .map((finding) => finding.code);

  return Object.freeze({
    blockingReasonCodes: Object.freeze(blockingReasonCodes),
    advisoryReasonCodes: Object.freeze(advisoryReasonCodes),
    transientAvailabilityReasonCodes: Object.freeze(transientAvailabilityReasonCodes),
    findingCount: findings.length,
  });
}

export class ImageRunNodeEligibilityEvaluationService
implements
  IImageRunNodeEligibilityEvaluationServicePort,
  IExecutionNodeEligibilityEvaluationServicePort,
  IExecutionNodeSelectionHintsServicePort {
  public constructor(private readonly dependencies: ImageRunNodeEligibilityEvaluationServiceDependencies) {}

  public async evaluateRunToNodeEligibility(input: {
    readonly asOf: string;
    readonly run: ImageRunNodeEligibilityRunContext;
    readonly nodeId: string;
    readonly requirements?: ImageRunNodeEligibilityRequirements;
  }): Promise<ImageRunNodeEligibilityResult> {
    const nodeId = normalizeOptional(input.nodeId) ?? input.nodeId;
    const node = await this.dependencies.nodeRepository.findExecutionNodeById(nodeId);
    if (!node) {
      return Object.freeze({
        run: Object.freeze({ ...input.run }),
        nodeId,
        decision: ExecutionNodeEligibilityDecisionKinds.incompatible,
        eligible: false,
        compatible: false,
        routable: false,
        findings: Object.freeze([Object.freeze({
          code: "node-not-found",
          kind: ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility,
          message: `Execution node '${nodeId}' was not found.`,
          blocking: true,
        })]),
        blockingReasons: Object.freeze([Object.freeze({
          code: "node-not-found",
          kind: ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility,
          message: `Execution node '${nodeId}' was not found.`,
          blocking: true,
        })]),
        advisories: Object.freeze([]),
        transientAvailabilityIssues: Object.freeze([]),
        normalizedRequirements: normalizeRequirements(input.requirements),
        summary: Object.freeze({
          blockingReasonCodes: Object.freeze(["node-not-found"]),
          advisoryReasonCodes: Object.freeze([]),
          transientAvailabilityReasonCodes: Object.freeze([]),
          findingCount: 1,
        }),
      });
    }

    return this.evaluateNodeAgainstRun({
      asOf: input.asOf,
      run: input.run,
      node,
      requirements: input.requirements,
    });
  }

  public async evaluateRunToCandidateNodes(input: {
    readonly asOf: string;
    readonly run: ImageRunNodeEligibilityRunContext;
    readonly requirements?: ImageRunNodeEligibilityRequirements;
    readonly candidateNodeIds?: ReadonlyArray<string>;
    readonly query?: ExecutionNodeListQuery;
  }): Promise<ReadonlyArray<ImageRunNodeEligibilityResult>> {
    const candidates = await this.resolveCandidates({
      query: input.query,
      candidateNodeIds: input.candidateNodeIds,
    });

    const evaluations = await Promise.all(candidates.map((node) => this.evaluateNodeAgainstRun({
      asOf: input.asOf,
      run: input.run,
      node,
      requirements: input.requirements,
    })));

    return Object.freeze(evaluations);
  }

  public async evaluateExecutionNodeEligibility(input: {
    readonly asOf: string;
    readonly requirements?: ImageExecutionNodeCompatibilityRequirements;
    readonly candidateNodeIds?: ReadonlyArray<string>;
    readonly query?: ExecutionNodeListQuery;
  }): Promise<ReadonlyArray<ExecutionNodeEligibilityEvaluation>> {
    const runEvaluations = await this.evaluateRunToCandidateNodes({
      asOf: input.asOf,
      run: UnknownRunContext,
      requirements: input.requirements,
      candidateNodeIds: input.candidateNodeIds,
      query: input.query,
    });

    return Object.freeze(runEvaluations.map((evaluation) => Object.freeze({
      nodeId: evaluation.nodeId,
      decision: evaluation.decision,
      compatibility: Object.freeze({
        compatible: evaluation.compatible,
        routable: evaluation.routable,
        findings: Object.freeze(evaluation.findings),
        hardIncompatibilities: Object.freeze(
          evaluation.findings.filter((finding) => finding.kind === ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility),
        ),
        softAdvisories: Object.freeze(evaluation.advisories),
        transientAvailabilityIssues: Object.freeze(evaluation.transientAvailabilityIssues),
        matchedBackendFamily: evaluation.matchedBackendFamily,
        matchedExecutionTarget: evaluation.matchedExecutionTarget,
      }),
    })));
  }

  public async suggestExecutionNodeSelectionHints(input: {
    readonly asOf: string;
    readonly requirements?: ImageExecutionNodeCompatibilityRequirements;
    readonly candidateNodeIds?: ReadonlyArray<string>;
    readonly query?: ExecutionNodeListQuery;
    readonly limit?: number;
  }): Promise<ReadonlyArray<ExecutionNodeSelectionHint>> {
    const evaluations = await this.evaluateRunToCandidateNodes({
      asOf: input.asOf,
      run: UnknownRunContext,
      requirements: input.requirements,
      candidateNodeIds: input.candidateNodeIds,
      query: input.query,
    });

    const ranked = evaluations
      .slice()
      .sort((left, right) => {
        const decisionRank = toDecisionRank(left.decision) - toDecisionRank(right.decision);
        if (decisionRank !== 0) {
          return decisionRank;
        }
        return left.summary.findingCount - right.summary.findingCount;
      })
      .map((evaluation, index) => Object.freeze({
        nodeId: evaluation.nodeId,
        rank: index + 1,
        decision: evaluation.decision,
        matchedBackendFamily: evaluation.matchedBackendFamily,
        matchedExecutionTarget: evaluation.matchedExecutionTarget,
        reasonCodes: Object.freeze(evaluation.findings.map((finding) => finding.code)),
      }));

    const limit = typeof input.limit === "number" && input.limit > 0 ? input.limit : undefined;
    return Object.freeze(limit ? ranked.slice(0, limit) : ranked);
  }

  private async evaluateNodeAgainstRun(input: {
    readonly asOf: string;
    readonly run: ImageRunNodeEligibilityRunContext;
    readonly node: ExecutionNodeRecord;
    readonly requirements?: ImageRunNodeEligibilityRequirements;
  }): Promise<ImageRunNodeEligibilityResult> {
    const normalizedRequirements = normalizeRequirements(input.requirements);
    const compatibility = evaluateImageExecutionNodeCompatibility(input.node, {
      ...normalizedRequirements,
      now: input.asOf,
    });
    const decision = toDecision({
      compatible: compatibility.compatible,
      routable: compatibility.routable,
    });

    const findings = compatibility.findings;
    const blockingReasons = findings.filter((finding) => finding.blocking);
    const advisories = findings.filter(
      (finding) => finding.kind === ImageExecutionNodeCompatibilityFindingKinds.softAdvisory,
    );
    const transientAvailabilityIssues = findings.filter(
      (finding) => finding.kind === ImageExecutionNodeCompatibilityFindingKinds.transientAvailability,
    );

    return Object.freeze({
      run: Object.freeze({ ...input.run }),
      nodeId: input.node.nodeId,
      decision,
      eligible: decision === ExecutionNodeEligibilityDecisionKinds.eligible,
      compatible: compatibility.compatible,
      routable: compatibility.routable,
      matchedBackendFamily: compatibility.matchedBackendFamily,
      matchedExecutionTarget: compatibility.matchedExecutionTarget,
      findings: Object.freeze(findings),
      blockingReasons: Object.freeze(blockingReasons),
      advisories: Object.freeze(advisories),
      transientAvailabilityIssues: Object.freeze(transientAvailabilityIssues),
      normalizedRequirements,
      summary: toEligibilitySummary(findings),
    });
  }

  private async resolveCandidates(input: {
    readonly query?: ExecutionNodeListQuery;
    readonly candidateNodeIds?: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    const queried = input.query
      ? await this.dependencies.nodeRepository.listExecutionNodes(input.query)
      : await this.dependencies.nodeRepository.listExecutionNodes(Object.freeze({}));

    if (!input.candidateNodeIds || input.candidateNodeIds.length === 0) {
      return queried;
    }

    const candidateNodeSet = new Set(input.candidateNodeIds.map((nodeId) => normalizeOptional(nodeId)).filter(Boolean));
    return queried.filter((node) => candidateNodeSet.has(node.nodeId));
  }
}
