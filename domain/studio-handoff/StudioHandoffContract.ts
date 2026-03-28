import type { AssetContractDescriptor } from "../contracts/AssetContract";
import type { CompositionTaxonomyDescriptor } from "../taxonomy/CompositionTaxonomy";
import {
  createStudioHandoffContext,
  type StudioHandoffContext,
  type StudioHandoffContextInput,
} from "./StudioHandoffContext";

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
  readonly pinnedVersion?: PinnedStudioHandoffAssetVersion;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
  readonly targetInputContract: TargetStudioInputContract;
}

export const StudioHandoffAssetRoles = Object.freeze({
  primary: "primary",
  supporting: "supporting",
  peer: "peer",
  dependency: "dependency",
  systemComponent: "system-component",
});

export type StudioHandoffAssetRole =
  typeof StudioHandoffAssetRoles[keyof typeof StudioHandoffAssetRoles];

export interface StudioHandoffAssetEntry {
  readonly role: StudioHandoffAssetRole;
  readonly ordinal?: number;
  readonly roleLabel?: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly pinnedVersion?: PinnedStudioHandoffAssetVersion;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface PinnedStudioHandoffAssetVersion {
  readonly assetId: string;
  readonly versionId: string;
}

export interface VersionAwareStudioHandoffReference extends PinnedStudioHandoffAssetVersion {
  readonly role?: StudioHandoffAssetRole;
  readonly relation?: string;
}

export interface MultiAssetStudioHandoffContract {
  readonly grouped: true;
  readonly requireAllAssets: boolean;
  readonly assets: ReadonlyArray<StudioHandoffAssetEntry>;
}

export interface StudioHandoffContract {
  readonly id: StudioHandoffContractId;
  readonly domain: "studio-handoff";
  readonly createdAt: string;
  readonly source: StudioHandoffSource;
  readonly target: StudioHandoffTarget;
  readonly payload: StudioHandoffPayload;
  readonly multiAsset?: MultiAssetStudioHandoffContract;
  readonly context?: StudioHandoffContext;
  readonly intent: StudioHandoffIntent;
}

function normalizeIntent(intent: StudioHandoffIntent): StudioHandoffIntent {
  const intentKind = intent.kind;
  if (!Object.values(StudioHandoffIntentKinds).includes(intentKind)) {
    throw new Error(`Studio handoff intent kind '${intent.kind}' is not supported.`);
  }

  return Object.freeze({
    kind: intentKind,
    description: normalizeOptional(intent.description),
    labels: Object.freeze([...(intent.labels ?? []).map((entry) => entry.trim()).filter(Boolean)]),
  });
}

function normalizeAssetEntry(
  entry: StudioHandoffAssetEntry,
  index: number,
): StudioHandoffAssetEntry {
  if (!Object.values(StudioHandoffAssetRoles).includes(entry.role)) {
    throw new Error(`Studio handoff asset role '${entry.role}' is not supported.`);
  }

  const assetId = normalizeRequired(entry.assetId, `Studio handoff multi-asset entry[${index}] asset id`);
  const versionId = normalizeRequired(entry.versionId, `Studio handoff multi-asset entry[${index}] version id`);
  if (
    entry.pinnedVersion
    && (entry.pinnedVersion.assetId.trim() !== assetId || entry.pinnedVersion.versionId.trim() !== versionId)
  ) {
    throw new Error(`Studio handoff multi-asset entry[${index}] pinned version must match assetId/versionId.`);
  }

  return Object.freeze({
    role: entry.role,
    ordinal: entry.ordinal,
    roleLabel: normalizeOptional(entry.roleLabel),
    assetId,
    versionId,
    pinnedVersion: Object.freeze({
      assetId,
      versionId,
    }),
    taxonomy: entry.taxonomy,
    contract: entry.contract,
    context: entry.context ? Object.freeze({ ...entry.context }) : undefined,
  });
}

function normalizeMultiAssetContract(
  input: MultiAssetStudioHandoffContract | undefined,
  fallbackPayload: StudioHandoffPayload,
): MultiAssetStudioHandoffContract | undefined {
  if (!input) {
    return undefined;
  }

  const normalizedAssets = input.assets.map((entry, index) => normalizeAssetEntry(entry, index));
  if (normalizedAssets.length === 0) {
    throw new Error("Studio handoff multi-asset contract requires at least one asset entry.");
  }

  const hasPrimary = normalizedAssets.some((entry) => entry.role === StudioHandoffAssetRoles.primary);
  if (!hasPrimary) {
    normalizedAssets.unshift(Object.freeze({
      role: StudioHandoffAssetRoles.primary,
      ordinal: -1,
      roleLabel: "authoritative",
      assetId: normalizeRequired(fallbackPayload.assetId, "Studio handoff payload asset id"),
      versionId: normalizeRequired(fallbackPayload.versionId, "Studio handoff payload asset version id"),
      pinnedVersion: Object.freeze({
        assetId: normalizeRequired(fallbackPayload.assetId, "Studio handoff payload asset id"),
        versionId: normalizeRequired(fallbackPayload.versionId, "Studio handoff payload asset version id"),
      }),
      taxonomy: fallbackPayload.taxonomy,
      contract: fallbackPayload.contract,
    }));
  }

  const normalized = normalizedAssets
    .map((entry, index) => ({ ...entry, ordinal: entry.ordinal ?? index }))
    .sort((left, right) => (left.ordinal ?? 0) - (right.ordinal ?? 0))
    .map((entry) => Object.freeze(entry));

  return Object.freeze({
    grouped: true,
    requireAllAssets: input.requireAllAssets,
    assets: Object.freeze(normalized),
  });
}

export function createStudioHandoffContract(input: {
  readonly id: string | StudioHandoffContractId;
  readonly source: StudioHandoffSource;
  readonly target: StudioHandoffTarget;
  readonly payload: StudioHandoffPayload;
  readonly multiAsset?: MultiAssetStudioHandoffContract;
  readonly context?: Omit<StudioHandoffContextInput, "sourceStudioId" | "sourceStudioType" | "targetStudioId" | "targetStudioType" | "intent">;
  readonly intent: StudioHandoffIntent;
  readonly createdAt?: Date;
}): StudioHandoffContract {
  const sourceStudioId = normalizeRequired(input.source.studioId, "Studio handoff source studio id");
  const sourceStudioType = normalizeRequired(input.source.studioType, "Studio handoff source studio type");
  const targetStudioId = normalizeRequired(input.target.studioId, "Studio handoff target studio id");
  const targetStudioType = normalizeRequired(input.target.studioType, "Studio handoff target studio type");
  const normalizedIntent = normalizeIntent(input.intent);

  const targetInputContract = input.payload.targetInputContract;
  const contractId = normalizeRequired(targetInputContract.contractId, "Target studio input contract id");

  const payloadAssetId = normalizeRequired(input.payload.assetId, "Studio handoff payload asset id");
  const payloadVersionId = normalizeRequired(input.payload.versionId, "Studio handoff payload asset version id");
  if (
    input.payload.pinnedVersion
    && (
      input.payload.pinnedVersion.assetId.trim() !== payloadAssetId
      || input.payload.pinnedVersion.versionId.trim() !== payloadVersionId
    )
  ) {
    throw new Error("Studio handoff payload pinned version must match payload assetId/versionId.");
  }

  const normalizedPayload = Object.freeze({
    assetId: payloadAssetId,
    versionId: payloadVersionId,
    pinnedVersion: Object.freeze({
      assetId: payloadAssetId,
      versionId: payloadVersionId,
    }),
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
  });

  const context = input.context
    ? createStudioHandoffContext({
      sourceStudioId,
      sourceStudioType,
      targetStudioId,
      targetStudioType,
      intent: normalizedIntent,
      initiatedAt: input.context.initiatedAt,
      actor: input.context.actor,
      prefill: input.context.prefill,
      sourceReferences: input.context.sourceReferences,
      provenance: input.context.provenance,
    })
    : undefined;

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
    payload: normalizedPayload,
    multiAsset: normalizeMultiAssetContract(input.multiAsset, normalizedPayload),
    context,
    intent: normalizedIntent,
  });
}
