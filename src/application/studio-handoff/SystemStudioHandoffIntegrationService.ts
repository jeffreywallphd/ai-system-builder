import { SystemStudioIdentity, type SystemComponentKind } from "@domain/system-studio/SystemAssetDomain";
import {
  createStudioHandoffContract,
  StudioHandoffIntentKinds,
  StudioHandoffAssetRoles,
  type MultiAssetStudioHandoffContract,
  type SystemOfSystemsHandoffContext,
} from "@domain/studio-handoff/StudioHandoffContract";
import type { StudioHandoffRoutingService, StudioHandoffRouteDecision } from "./StudioHandoffRoutingService";
import type { StudioHandoffOrchestrationService, StudioHandoffRequest, UpdatedStudioHandoffResult } from "./StudioHandoffOrchestrationService";
import type { AdaptedStudioInput, GroupedAdaptedStudioInput } from "./StudioInputAdapter";
import type { SystemStudioApplicationService } from "../system-studio/SystemStudioApplicationService";
import type { AssetDraftDependencyReference } from "@domain/studio-shell/StudioShellDomain";

export interface SystemStudioAcceptedHandoffCapability {
  readonly capabilityId: string;
  readonly contractId: string;
  readonly acceptsGroupedMultiAsset: boolean;
  readonly acceptsSystemAssets: boolean;
  readonly acceptsSystemOfSystems: boolean;
}

export interface SystemStudioHandoffInput {
  readonly handoffId: string;
  readonly sourceStudioType: string;
  readonly sourceStudioId: string;
  readonly authoritativeAsset: {
    readonly assetId: string;
    readonly versionId: string;
    readonly taxonomy: AdaptedStudioInput["authoritativeAsset"]["taxonomy"];
  };
  readonly grouped: boolean;
  readonly assets: ReadonlyArray<{
    readonly role: string;
    readonly ordinal: number;
    readonly assetId: string;
    readonly versionId: string;
    readonly taxonomy: AdaptedStudioInput["authoritativeAsset"]["taxonomy"];
    readonly context: Readonly<Record<string, unknown>>;
  }>;
  readonly prefill: Readonly<Record<string, unknown>>;
  readonly provenance?: AdaptedStudioInput["context"]["provenance"];
  readonly intent: AdaptedStudioInput["context"]["intent"];
  readonly revision?: {
    readonly revisionId: string;
    readonly previousHandoffId: string;
    readonly updatedHandoffId: string;
  };
}

export interface SystemStudioCompositionPrefill {
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly dependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly input: SystemStudioHandoffInput;
}

export interface SystemStudioHandoffIntegrationResult {
  readonly routeDecision: StudioHandoffRouteDecision;
  readonly orchestration: UpdatedStudioHandoffResult;
  readonly handoffInput: SystemStudioHandoffInput;
  readonly prefill: SystemStudioCompositionPrefill;
  readonly ensuredStudio: {
    readonly studioId: string;
    readonly studioName: string;
    readonly sessionId: string;
  };
  readonly draftId: string;
  readonly systemOfSystems?: SystemOfSystemsHandoffContext;
}

export interface SystemOfSystemsHandoffResult extends SystemStudioHandoffIntegrationResult {
  readonly systemOfSystems: SystemOfSystemsHandoffContext;
}

function toSystemComponentKind(structuralKind: string): SystemComponentKind {
  if (structuralKind === "system") {
    return "system";
  }
  if (structuralKind === "composite") {
    return "composite";
  }
  return "atomic";
}

function toSystemHandoffInput(input: {
  readonly adapted: AdaptedStudioInput;
  readonly handoffId: string;
  readonly revision?: UpdatedStudioHandoffResult["revision"];
}): SystemStudioHandoffInput {
  const grouped = "grouped" in input.adapted && input.adapted.grouped === true;
  const groupedInput = grouped ? input.adapted as GroupedAdaptedStudioInput : undefined;

  const assets = groupedInput
    ? groupedInput.bundledAssets.map((entry, index) => Object.freeze({
      role: entry.role,
      ordinal: entry.ordinal ?? index,
      assetId: entry.pinnedVersion.assetId,
      versionId: entry.pinnedVersion.versionId,
      taxonomy: entry.taxonomy,
      context: entry.context,
    }))
    : [Object.freeze({
      role: StudioHandoffAssetRoles.primary,
      ordinal: 0,
      assetId: input.adapted.authoritativeAsset.pinnedVersion.assetId,
      versionId: input.adapted.authoritativeAsset.pinnedVersion.versionId,
      taxonomy: input.adapted.authoritativeAsset.taxonomy,
      context: Object.freeze({}),
    })];

  return Object.freeze({
    handoffId: input.handoffId,
    sourceStudioType: input.adapted.sourceStudioType,
    sourceStudioId: input.adapted.sourceStudioId,
    authoritativeAsset: Object.freeze({
      assetId: input.adapted.authoritativeAsset.pinnedVersion.assetId,
      versionId: input.adapted.authoritativeAsset.pinnedVersion.versionId,
      taxonomy: input.adapted.authoritativeAsset.taxonomy,
    }),
    grouped,
    assets: Object.freeze(assets),
    prefill: Object.freeze({ ...input.adapted.prefill }),
    provenance: input.adapted.context.provenance,
    intent: input.adapted.context.intent,
    revision: input.revision
      ? Object.freeze({
        revisionId: input.revision.revisionId,
        previousHandoffId: input.revision.previousHandoffId,
        updatedHandoffId: input.revision.updatedHandoffId,
      })
      : undefined,
  });
}

function buildSystemSpec(input: SystemStudioHandoffInput): {
  readonly components: ReadonlyArray<{ readonly componentKind: SystemComponentKind; readonly assetId: string; readonly versionId: string; readonly alias: string }>;
  readonly nestedSystems: ReadonlyArray<{ readonly assetId: string; readonly versionId: string; readonly alias: string }>;
} {
  const components = input.assets.map((entry, index) => Object.freeze({
    componentKind: toSystemComponentKind(entry.taxonomy.structuralKind),
    assetId: entry.assetId,
    versionId: entry.versionId,
    alias: `${entry.role}-${index + 1}`,
  }));

  const nestedSystems = components
    .filter((entry) => entry.componentKind === "system")
    .map((entry) => Object.freeze({
      assetId: entry.assetId,
      versionId: entry.versionId,
      alias: entry.alias,
    }));

  return Object.freeze({
    components: Object.freeze(components),
    nestedSystems: Object.freeze(nestedSystems),
  });
}

function buildPrefill(input: {
  readonly handoffInput: SystemStudioHandoffInput;
  readonly multiAsset?: MultiAssetStudioHandoffContract;
}): SystemStudioCompositionPrefill {
  const spec = buildSystemSpec(input.handoffInput);
  const dependencies = input.handoffInput.assets.map((entry) => Object.freeze({
    assetId: entry.assetId,
    versionId: entry.versionId,
  }));

  const titleSeed = input.handoffInput.prefill["title"];
  const title = typeof titleSeed === "string" && titleSeed.trim().length > 0
    ? titleSeed.trim()
    : `System Composition from ${input.handoffInput.sourceStudioType}`;

  const summary = `Initialized from handoff ${input.handoffInput.handoffId} (${input.handoffInput.assets.length} asset${input.handoffInput.assets.length === 1 ? "" : "s"}).`;

  return Object.freeze({
    title,
    summary,
    content: JSON.stringify({
      systemSpec: {
        components: spec.components,
        nestedSystems: spec.nestedSystems,
      },
      handoff: {
        handoffId: input.handoffInput.handoffId,
        revisionId: input.handoffInput.revision?.revisionId,
        intent: input.handoffInput.intent.kind,
        grouped: input.handoffInput.grouped,
        roleCount: input.multiAsset?.assets.length ?? input.handoffInput.assets.length,
      },
    }, null, 2),
    dependencies: Object.freeze(dependencies),
    input: input.handoffInput,
  });
}

export class SystemStudioHandoffIntegrationService {
  public constructor(
    private readonly routingService: Pick<StudioHandoffRoutingService, "route" | "reevaluate">,
    private readonly orchestrationService: Pick<StudioHandoffOrchestrationService, "orchestrate" | "refreshStudioHandoff">,
    private readonly systemStudioApplicationService: Pick<SystemStudioApplicationService, "ensureStudioInitialized" | "createSystemDraft">,
  ) {}

  public acceptedCapabilities(): ReadonlyArray<SystemStudioAcceptedHandoffCapability> {
    return Object.freeze([Object.freeze({
      capabilityId: "system-studio-default-handoff-input",
      contractId: "system-default-input",
      acceptsGroupedMultiAsset: true,
      acceptsSystemAssets: true,
      acceptsSystemOfSystems: true,
    })]);
  }

  public async integrateHandoff(input: {
    readonly routingRequest: StudioHandoffRequest & {
      readonly existingHandoff?: StudioHandoffRequest["handoff"];
      readonly multiAsset?: MultiAssetStudioHandoffContract;
    };
    readonly draftId?: string;
    readonly sessionId?: string;
  }): Promise<SystemStudioHandoffIntegrationResult> {
    const routeDecision = this.routingService.route({
      handoffId: input.routingRequest.handoffId,
      sourceOutput: input.routingRequest.sourceOutput,
      source: input.routingRequest.source,
      context: input.routingRequest.context,
      intent: input.routingRequest.intent ?? { kind: StudioHandoffIntentKinds.compositionAssembly },
      multiAsset: input.routingRequest.multiAsset,
      existingHandoff: input.routingRequest.handoff,
    });

    const preferred = routeDecision.preferred;
    if (!preferred || preferred.studioType !== SystemStudioIdentity.studioType || !preferred.matchedContractId) {
      throw new Error("System Studio routing decision was not selected for handoff integration.");
    }

    const orchestration = input.routingRequest.handoff
      ? this.orchestrationService.refreshStudioHandoff({
        basis: input.routingRequest.handoff,
        update: {
          assetVersionUpdates: input.routingRequest.multiAsset?.assets.map((entry) => ({
            assetId: entry.assetId,
            versionId: entry.versionId,
            role: entry.role,
          })),
          contextPrefillPatch: input.routingRequest.context?.prefill?.values,
        },
        sourceOutput: input.routingRequest.sourceOutput,
        targetCapabilities: input.routingRequest.targetCapabilities,
      })
      : this.orchestrationService.orchestrate({
        ...input.routingRequest,
        handoff: input.routingRequest.multiAsset
          ? createStudioHandoffContract({
            id: input.routingRequest.handoffId ?? `${input.routingRequest.sourceOutput.sourceStudioId}::${preferred.studioId}::${input.routingRequest.sourceOutput.authoritativeAsset.versionId}`,
            source: input.routingRequest.source ?? {
              studioType: input.routingRequest.sourceOutput.sourceStudioType,
              studioId: input.routingRequest.sourceOutput.sourceStudioId,
            },
            target: {
              studioType: preferred.studioType,
              studioId: preferred.studioId,
            },
            payload: {
              assetId: input.routingRequest.sourceOutput.authoritativeAsset.assetId,
              versionId: input.routingRequest.sourceOutput.authoritativeAsset.versionId,
              taxonomy: input.routingRequest.sourceOutput.authoritativeAsset.taxonomy,
              contract: input.routingRequest.sourceOutput.authoritativeAsset.contract,
              targetInputContract: {
                contractId: preferred.matchedContractId,
              },
            },
            multiAsset: input.routingRequest.multiAsset,
            intent: input.routingRequest.intent ?? { kind: StudioHandoffIntentKinds.compositionAssembly },
            context: {
              sourceReferences: input.routingRequest.context?.sourceReferences
                ?? input.routingRequest.sourceOutput.sourceReferences
                ?? [{
                  assetId: input.routingRequest.sourceOutput.authoritativeAsset.assetId,
                  versionId: input.routingRequest.sourceOutput.authoritativeAsset.versionId,
                  relation: "source-output",
                }],
              actor: input.routingRequest.context?.actor,
              prefill: {
                values: {
                  ...(input.routingRequest.sourceOutput.handoffHints ?? {}),
                  ...(input.routingRequest.context?.prefill?.values ?? {}),
                },
              },
              provenance: input.routingRequest.context?.provenance,
            },
          })
          : undefined,
        target: {
          studioType: preferred.studioType,
          studioId: preferred.studioId,
        },
        targetInputContract: {
          contractId: preferred.matchedContractId,
        },
      });

    if (!orchestration.ok || !orchestration.preparation) {
      throw new Error(orchestration.failure?.message ?? "System Studio handoff orchestration failed.");
    }

    const handoffInput = toSystemHandoffInput({
      adapted: orchestration.preparation.targetInput,
      handoffId: orchestration.preparation.handoff.id.value,
      revision: orchestration.revision,
    });

    const prefill = buildPrefill({
      handoffInput,
      multiAsset: orchestration.preparation.handoff.multiAsset,
    });

    const ensured = await this.systemStudioApplicationService.ensureStudioInitialized(
      SystemStudioIdentity.defaultStudioId,
      SystemStudioIdentity.defaultStudioName,
    );

    const created = await this.systemStudioApplicationService.createSystemDraft({
      studioId: ensured.studio.id,
      sessionId: input.sessionId ?? ensured.session.id,
      draftId: input.draftId,
      title: prefill.title,
      summary: prefill.summary,
      content: prefill.content,
      dependencies: prefill.dependencies,
      semanticRole: "system",
      behaviorKind: "iterative",
      tags: ["handoff", "system-composition"],
    });

    return Object.freeze({
      routeDecision,
      orchestration,
      handoffInput,
      prefill,
      ensuredStudio: Object.freeze({
        studioId: ensured.studio.id,
        studioName: ensured.studio.name,
        sessionId: ensured.session.id,
      }),
      draftId: created.draft.id,
      systemOfSystems: orchestration.preparation.handoff.payload.systemOfSystems,
    });
  }
}

