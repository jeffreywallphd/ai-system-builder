import type { TaxonomySemanticRole } from "../../domain/taxonomy/CompositionTaxonomy";

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function freezeRecord(record?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (!record) {
    return undefined;
  }
  return Object.freeze({ ...record });
}

export const StudioLaunchHandoffSchemaVersion = "ai-loom.studio-launch-handoff.v1";
export const StudioLaunchHandoffQueryParam = "studioHandoff";

export const StudioLaunchHandoffOutcomeKinds = Object.freeze({
  created: "created",
  cancelled: "cancelled",
  noSelection: "no-selection",
  abandoned: "abandoned",
});

export type StudioLaunchHandoffOutcomeKind =
  typeof StudioLaunchHandoffOutcomeKinds[keyof typeof StudioLaunchHandoffOutcomeKinds];

export interface StudioLaunchMetadata {
  readonly schemaVersion: typeof StudioLaunchHandoffSchemaVersion;
  readonly handoffId: string;
  readonly launchedAt: string;
  readonly launchSource: string;
  readonly launchIntent: "create-new-asset";
}

export interface StudioOriginRouteContext {
  readonly path: string;
  readonly search?: string;
  readonly hash?: string;
}

export interface WorkflowDraftReference {
  readonly studioId: string;
  readonly draftId?: string;
  readonly sessionId?: string;
  readonly assetId?: string;
  readonly versionId?: string;
}

export interface WorkflowAuthoringResumeContext {
  readonly modeId?: string;
  readonly wizardPageId?: string;
  readonly draftReference?: WorkflowDraftReference;
  readonly draftState?: string;
}

export interface StudioOriginMetadata {
  readonly studioType: string;
  readonly studioId?: string;
  readonly route: StudioOriginRouteContext;
  readonly workflowAuthoring?: WorkflowAuthoringResumeContext;
}

export interface StudioSelectorTargetContext {
  readonly selectorSessionId: string;
  readonly assetType: TaxonomySemanticRole;
  readonly originatingField?: string;
  readonly usageContext?: string;
  readonly selectorTargetId?: string;
}

export interface StudioReturnTarget {
  readonly routePath: string;
  readonly contextId?: string;
}

export interface StudioReturnContract {
  readonly target: StudioReturnTarget;
  readonly outcomes: ReadonlyArray<StudioLaunchHandoffOutcomeKind>;
}

export interface StudioResumeContract {
  readonly destinationRoutePath: string;
  readonly state?: Readonly<Record<string, unknown>>;
}

export interface StudioLaunchHandoffContract {
  readonly launch: StudioLaunchMetadata;
  readonly origin: StudioOriginMetadata;
  readonly target: {
    readonly selector: StudioSelectorTargetContext;
  };
  readonly returnContract: StudioReturnContract;
  readonly resume: StudioResumeContract;
}

function normalizeWorkflowDraftReference(reference: WorkflowDraftReference): WorkflowDraftReference {
  return Object.freeze({
    studioId: normalizeRequired(reference.studioId, "Workflow draft reference studio id"),
    draftId: normalizeOptional(reference.draftId),
    sessionId: normalizeOptional(reference.sessionId),
    assetId: normalizeOptional(reference.assetId),
    versionId: normalizeOptional(reference.versionId),
  });
}

function normalizeWorkflowAuthoringContext(
  context?: WorkflowAuthoringResumeContext,
): WorkflowAuthoringResumeContext | undefined {
  if (!context) {
    return undefined;
  }

  return Object.freeze({
    modeId: normalizeOptional(context.modeId),
    wizardPageId: normalizeOptional(context.wizardPageId),
    draftReference: context.draftReference
      ? normalizeWorkflowDraftReference(context.draftReference)
      : undefined,
    draftState: normalizeOptional(context.draftState),
  });
}

function normalizeOutcomes(
  outcomes: ReadonlyArray<StudioLaunchHandoffOutcomeKind> | undefined,
): ReadonlyArray<StudioLaunchHandoffOutcomeKind> {
  const normalized = new Set<StudioLaunchHandoffOutcomeKind>();
  for (const outcome of outcomes ?? []) {
    if (Object.values(StudioLaunchHandoffOutcomeKinds).includes(outcome)) {
      normalized.add(outcome);
    }
  }
  if (normalized.size === 0) {
    normalized.add(StudioLaunchHandoffOutcomeKinds.created);
    normalized.add(StudioLaunchHandoffOutcomeKinds.cancelled);
    normalized.add(StudioLaunchHandoffOutcomeKinds.noSelection);
    normalized.add(StudioLaunchHandoffOutcomeKinds.abandoned);
  }
  return Object.freeze([...normalized.values()]);
}

export function createStudioLaunchHandoffContract(input: {
  readonly handoffId: string;
  readonly launchedAt?: Date;
  readonly launchSource: string;
  readonly origin: StudioOriginMetadata;
  readonly target: StudioSelectorTargetContext;
  readonly returnTarget: StudioReturnTarget;
  readonly outcomes?: ReadonlyArray<StudioLaunchHandoffOutcomeKind>;
  readonly resumeState?: Readonly<Record<string, unknown>>;
}): StudioLaunchHandoffContract {
  const originPath = normalizeRequired(input.origin.route.path, "Studio handoff origin route path");
  const returnRoutePath = normalizeRequired(input.returnTarget.routePath, "Studio handoff return route path");

  return Object.freeze({
    launch: Object.freeze({
      schemaVersion: StudioLaunchHandoffSchemaVersion,
      handoffId: normalizeRequired(input.handoffId, "Studio handoff id"),
      launchedAt: (input.launchedAt ?? new Date()).toISOString(),
      launchSource: normalizeRequired(input.launchSource, "Studio handoff launch source"),
      launchIntent: "create-new-asset",
    }),
    origin: Object.freeze({
      studioType: normalizeRequired(input.origin.studioType, "Studio handoff origin studio type"),
      studioId: normalizeOptional(input.origin.studioId),
      route: Object.freeze({
        path: originPath,
        search: normalizeOptional(input.origin.route.search),
        hash: normalizeOptional(input.origin.route.hash),
      }),
      workflowAuthoring: normalizeWorkflowAuthoringContext(input.origin.workflowAuthoring),
    }),
    target: Object.freeze({
      selector: Object.freeze({
        selectorSessionId: normalizeRequired(input.target.selectorSessionId, "Studio handoff selector session id"),
        assetType: normalizeRequired(input.target.assetType, "Studio handoff selector asset type") as TaxonomySemanticRole,
        originatingField: normalizeOptional(input.target.originatingField),
        usageContext: normalizeOptional(input.target.usageContext),
        selectorTargetId: normalizeOptional(input.target.selectorTargetId),
      }),
    }),
    returnContract: Object.freeze({
      target: Object.freeze({
        routePath: returnRoutePath,
        contextId: normalizeOptional(input.returnTarget.contextId),
      }),
      outcomes: normalizeOutcomes(input.outcomes),
    }),
    resume: Object.freeze({
      destinationRoutePath: returnRoutePath,
      state: freezeRecord(input.resumeState),
    }),
  });
}

export function serializeStudioLaunchHandoffContract(contract: StudioLaunchHandoffContract): string {
  return encodeURIComponent(JSON.stringify(contract));
}

export function parseStudioLaunchHandoffContract(serialized: string): StudioLaunchHandoffContract | undefined {
  const normalized = serialized.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    const decoded = decodeURIComponent(normalized);
    const parsed = JSON.parse(decoded) as Partial<StudioLaunchHandoffContract>;
    if (parsed?.launch?.schemaVersion !== StudioLaunchHandoffSchemaVersion) {
      return undefined;
    }

    return createStudioLaunchHandoffContract({
      handoffId: parsed.launch.handoffId,
      launchedAt: parsed.launch.launchedAt ? new Date(parsed.launch.launchedAt) : undefined,
      launchSource: parsed.launch.launchSource,
      origin: {
        studioType: parsed.origin?.studioType ?? "",
        studioId: parsed.origin?.studioId,
        route: {
          path: parsed.origin?.route?.path ?? "",
          search: parsed.origin?.route?.search,
          hash: parsed.origin?.route?.hash,
        },
        workflowAuthoring: parsed.origin?.workflowAuthoring,
      },
      target: {
        selectorSessionId: parsed.target?.selector.selectorSessionId ?? "",
        assetType: (parsed.target?.selector.assetType ?? "") as TaxonomySemanticRole,
        originatingField: parsed.target?.selector.originatingField,
        usageContext: parsed.target?.selector.usageContext,
        selectorTargetId: parsed.target?.selector.selectorTargetId,
      },
      returnTarget: {
        routePath: parsed.returnContract?.target.routePath ?? "",
        contextId: parsed.returnContract?.target.contextId,
      },
      outcomes: parsed.returnContract?.outcomes,
      resumeState: parsed.resume?.state,
    });
  } catch {
    return undefined;
  }
}

