import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { CompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";

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

function normalizeRecord(value?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (!value) {
    return undefined;
  }
  return Object.freeze({ ...value });
}

export class StudioHandoffContractId {
  public readonly value: string;

  constructor(value: string) {
    this.value = normalizeRequired(value, "Studio handoff contract id");
  }

  public equals(other: StudioHandoffContractId | string): boolean {
    const compared = typeof other === "string" ? other.trim() : other.value;
    return this.value === compared;
  }

  public toString(): string {
    return this.value;
  }

  public static from(value: string | StudioHandoffContractId): StudioHandoffContractId {
    return value instanceof StudioHandoffContractId ? value : new StudioHandoffContractId(value);
  }
}

export const StudioHandoffIntentKinds = Object.freeze({
  authoringContinuation: "authoring-continuation",
  compositionAssembly: "composition-assembly",
  validationReview: "validation-review",
  systemIntegration: "system-integration",
});

export type StudioHandoffIntentKind =
  typeof StudioHandoffIntentKinds[keyof typeof StudioHandoffIntentKinds];

export interface StudioHandoffIntent {
  readonly kind: StudioHandoffIntentKind;
  readonly description?: string;
  readonly labels?: ReadonlyArray<string>;
}

export interface StudioHandoffSource {
  readonly studioId: string;
  readonly studioType: string;
  readonly draftId?: string;
  readonly sessionId?: string;
}

export interface StudioHandoffTarget {
  readonly studioId: string;
  readonly studioType: string;
  readonly draftId?: string;
  readonly sessionId?: string;
}

export interface TargetStudioInputContract {
  readonly contractId: string;
  readonly acceptedStructuralKinds?: ReadonlyArray<CompositionTaxonomyDescriptor["structuralKind"]>;
  readonly acceptedSemanticRoles?: ReadonlyArray<CompositionTaxonomyDescriptor["semanticRole"]>;
  readonly acceptedBehaviorKinds?: ReadonlyArray<CompositionTaxonomyDescriptor["behaviorKind"]>;
  readonly expectedContract?: AssetContractDescriptor;
  readonly requireVersionedAsset?: boolean;
  readonly allowedContextKeys?: ReadonlyArray<string>;
}

export interface StudioHandoffPayload {
  readonly assetId: string;
  readonly versionId: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
  readonly targetInputContract: TargetStudioInputContract;
}

export interface StudioHandoffContext {
  readonly config?: Readonly<Record<string, unknown>>;
  readonly correlationId?: string;
  readonly note?: string;
}

export interface StudioHandoffContract {
  readonly id: StudioHandoffContractId;
  readonly domain: "studio-handoff";
  readonly createdAt: string;
  readonly source: StudioHandoffSource;
  readonly target: StudioHandoffTarget;
  readonly payload: StudioHandoffPayload;
  readonly context?: StudioHandoffContext;
  readonly intent: StudioHandoffIntent;
}

export function createStudioHandoffContract(input: {
  readonly id: string | StudioHandoffContractId;
  readonly source: StudioHandoffSource;
  readonly target: StudioHandoffTarget;
  readonly payload: StudioHandoffPayload;
  readonly context?: StudioHandoffContext;
  readonly intent: StudioHandoffIntent;
  readonly createdAt?: Date;
}): StudioHandoffContract {
  const sourceStudioId = normalizeRequired(input.source.studioId, "Studio handoff source studio id");
  const sourceStudioType = normalizeRequired(input.source.studioType, "Studio handoff source studio type");
  const targetStudioId = normalizeRequired(input.target.studioId, "Studio handoff target studio id");
  const targetStudioType = normalizeRequired(input.target.studioType, "Studio handoff target studio type");

  const intentKind = input.intent.kind;
  if (!Object.values(StudioHandoffIntentKinds).includes(intentKind)) {
    throw new Error(`Studio handoff intent kind '${input.intent.kind}' is not supported.`);
  }

  const targetInputContract = input.payload.targetInputContract;
  const contractId = normalizeRequired(targetInputContract.contractId, "Target studio input contract id");

  return Object.freeze({
    id: StudioHandoffContractId.from(input.id),
    domain: "studio-handoff",
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    source: Object.freeze({
      studioId: sourceStudioId,
      studioType: sourceStudioType,
      draftId: normalizeOptional(input.source.draftId),
      sessionId: normalizeOptional(input.source.sessionId),
    }),
    target: Object.freeze({
      studioId: targetStudioId,
      studioType: targetStudioType,
      draftId: normalizeOptional(input.target.draftId),
      sessionId: normalizeOptional(input.target.sessionId),
    }),
    payload: Object.freeze({
      assetId: normalizeRequired(input.payload.assetId, "Studio handoff payload asset id"),
      versionId: normalizeRequired(input.payload.versionId, "Studio handoff payload asset version id"),
      taxonomy: input.payload.taxonomy,
      contract: input.payload.contract,
      targetInputContract: Object.freeze({
        ...targetInputContract,
        contractId,
        acceptedStructuralKinds: targetInputContract.acceptedStructuralKinds
          ? Object.freeze([...targetInputContract.acceptedStructuralKinds])
          : undefined,
        acceptedSemanticRoles: targetInputContract.acceptedSemanticRoles
          ? Object.freeze([...targetInputContract.acceptedSemanticRoles])
          : undefined,
        acceptedBehaviorKinds: targetInputContract.acceptedBehaviorKinds
          ? Object.freeze([...targetInputContract.acceptedBehaviorKinds])
          : undefined,
        allowedContextKeys: targetInputContract.allowedContextKeys
          ? Object.freeze([...targetInputContract.allowedContextKeys.map((entry) => entry.trim()).filter(Boolean)])
          : undefined,
      }),
    }),
    context: input.context
      ? Object.freeze({
        config: normalizeRecord(input.context.config),
        correlationId: normalizeOptional(input.context.correlationId),
        note: normalizeOptional(input.context.note),
      })
      : undefined,
    intent: Object.freeze({
      kind: intentKind,
      description: normalizeOptional(input.intent.description),
      labels: Object.freeze([...(input.intent.labels ?? []).map((entry) => entry.trim()).filter(Boolean)]),
    }),
  });
}
