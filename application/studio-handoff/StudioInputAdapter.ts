import type { StudioHandoffContract, StudioHandoffPayload } from "../../domain/studio-handoff/StudioHandoffContract";
import type { StudioHandoffContext } from "../../domain/studio-handoff/StudioHandoffContext";
import {
  StudioHandoffCompatibilityIssueCodes,
  type StudioHandoffCompatibilityDecision,
  type StudioHandoffCompatibilityIssue,
  type StudioHandoffCompatibilityValidator,
} from "./StudioHandoffCompatibilityValidator";
import type { StudioCapabilityDescriptor } from "./StudioCapabilityRegistry";

export const AdaptedStudioInputKinds = Object.freeze({
  atomic: "atomic",
  composite: "composite",
  system: "system",
});

export type AdaptedStudioInputKind = typeof AdaptedStudioInputKinds[keyof typeof AdaptedStudioInputKinds];

export interface AdaptedStudioInput {
  readonly kind: AdaptedStudioInputKind;
  readonly targetStudioType: string;
  readonly targetStudioId: string;
  readonly sourceStudioType: string;
  readonly sourceStudioId: string;
  readonly authoritativeAsset: {
    readonly assetId: string;
    readonly versionId: string;
    readonly pinnedVersion: {
      readonly assetId: string;
      readonly versionId: string;
    };
    readonly taxonomy: StudioHandoffPayload["taxonomy"];
    readonly contract?: StudioHandoffPayload["contract"];
  };
  readonly sourceReferences: ReadonlyArray<StudioHandoffContext["sourceReferences"][number]>;
  readonly prefill: Readonly<Record<string, unknown>>;
  readonly context: {
    readonly intent: StudioHandoffContract["intent"];
    readonly actor?: StudioHandoffContext["actor"];
    readonly provenance?: StudioHandoffContext["provenance"];
    readonly initiatedAt?: string;
  };
  readonly studioSpecific: Readonly<Record<string, unknown>>;
}

export interface GroupedAdaptedStudioInput extends AdaptedStudioInput {
  readonly grouped: true;
  readonly requireAllAssets: boolean;
  readonly bundledAssets: ReadonlyArray<{
    readonly role: string;
    readonly ordinal: number;
    readonly roleLabel?: string;
    readonly assetId: string;
    readonly versionId: string;
    readonly pinnedVersion: {
      readonly assetId: string;
      readonly versionId: string;
    };
    readonly taxonomy: StudioHandoffPayload["taxonomy"];
    readonly contract?: StudioHandoffPayload["contract"];
    readonly context: Readonly<Record<string, unknown>>;
  }>;
}

export interface StudioInputAdapter<TAdapted extends AdaptedStudioInput = AdaptedStudioInput> {
  readonly id: string;
  readonly kind: AdaptedStudioInputKind;
  canAdapt(targetStudioType: string): boolean;
  adapt(input: {
    readonly handoff: StudioHandoffContract;
    readonly context: StudioHandoffContext;
    readonly compatibility: StudioHandoffCompatibilityDecision;
  }): TAdapted;
}

export interface StudioInputAdaptationIssue {
  readonly code:
    | "context-missing"
    | "context-target-mismatch"
    | "adapter-not-found"
    | "compatibility-failed"
    | StudioHandoffCompatibilityIssue["code"];
  readonly message: string;
  readonly path?: string;
}

export interface StudioInputAdaptationResult {
  readonly ok: boolean;
  readonly compatibility: StudioHandoffCompatibilityDecision;
  readonly adapted?: AdaptedStudioInput;
  readonly issues: ReadonlyArray<StudioInputAdaptationIssue>;
}

function freezeRecord(record?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...(record ?? {}) });
}

function createBaseAdaptedInput(
  kind: AdaptedStudioInputKind,
  handoff: StudioHandoffContract,
  context: StudioHandoffContext,
): Omit<AdaptedStudioInput, "studioSpecific"> {
  return Object.freeze({
    kind,
    targetStudioType: handoff.target.studioType,
    targetStudioId: handoff.target.studioId,
    sourceStudioType: handoff.source.studioType,
    sourceStudioId: handoff.source.studioId,
    authoritativeAsset: Object.freeze({
      assetId: handoff.payload.assetId,
      versionId: handoff.payload.versionId,
      pinnedVersion: Object.freeze({
        assetId: handoff.payload.pinnedVersion?.assetId ?? handoff.payload.assetId,
        versionId: handoff.payload.pinnedVersion?.versionId ?? handoff.payload.versionId,
      }),
      taxonomy: handoff.payload.taxonomy,
      contract: handoff.payload.contract,
    }),
    sourceReferences: Object.freeze([...context.sourceReferences]),
    prefill: freezeRecord(context.prefill?.values),
    context: Object.freeze({
      intent: handoff.intent,
      actor: context.actor,
      provenance: context.provenance,
      initiatedAt: context.initiatedAt,
    }),
  });
}

function maybeAttachGroupedInput(
  handoff: StudioHandoffContract,
  adapted: AdaptedStudioInput,
): AdaptedStudioInput {
  if (!handoff.multiAsset) {
    return adapted;
  }

  const grouped: GroupedAdaptedStudioInput = Object.freeze({
    ...adapted,
    grouped: true,
    requireAllAssets: handoff.multiAsset.requireAllAssets,
    bundledAssets: Object.freeze(handoff.multiAsset.assets.map((entry, index) => Object.freeze({
      role: entry.role,
      ordinal: entry.ordinal ?? index,
      roleLabel: entry.roleLabel,
      assetId: entry.assetId,
      versionId: entry.versionId,
      pinnedVersion: Object.freeze({
        assetId: entry.pinnedVersion?.assetId ?? entry.assetId,
        versionId: entry.pinnedVersion?.versionId ?? entry.versionId,
      }),
      taxonomy: entry.taxonomy,
      contract: entry.contract,
      context: Object.freeze({ ...(entry.context ?? {}) }),
    }))),
  });
  return grouped;
}

abstract class BaseStudioInputAdapter implements StudioInputAdapter {
  public abstract readonly id: string;
  public abstract readonly kind: AdaptedStudioInputKind;

  protected constructor(private readonly supportedStudioTypes: ReadonlyArray<string>) {}

  public canAdapt(targetStudioType: string): boolean {
    return this.supportedStudioTypes.includes(targetStudioType);
  }

  public abstract adapt(input: {
    readonly handoff: StudioHandoffContract;
    readonly context: StudioHandoffContext;
    readonly compatibility: StudioHandoffCompatibilityDecision;
  }): AdaptedStudioInput;
}

export class AtomicStudioInputAdapter extends BaseStudioInputAdapter {
  public readonly id = "studio-input-adapter:atomic";
  public readonly kind = AdaptedStudioInputKinds.atomic;

  public constructor(supportedStudioTypes: ReadonlyArray<string>) {
    super(supportedStudioTypes);
  }

  public adapt(input: {
    readonly handoff: StudioHandoffContract;
    readonly context: StudioHandoffContext;
    readonly compatibility: StudioHandoffCompatibilityDecision;
  }): AdaptedStudioInput {
    const base = createBaseAdaptedInput(this.kind, input.handoff, input.context);
    return maybeAttachGroupedInput(input.handoff, Object.freeze({
      ...base,
      studioSpecific: Object.freeze({
        expectedInputContractId: input.compatibility.matchedContractId ?? input.handoff.payload.targetInputContract.contractId,
        acceptedAsAtomic: true,
      }),
    }));
  }
}

export class CompositeStudioInputAdapter extends BaseStudioInputAdapter {
  public readonly id = "studio-input-adapter:composite";
  public readonly kind = AdaptedStudioInputKinds.composite;

  public constructor(supportedStudioTypes: ReadonlyArray<string>) {
    super(supportedStudioTypes);
  }

  public adapt(input: {
    readonly handoff: StudioHandoffContract;
    readonly context: StudioHandoffContext;
    readonly compatibility: StudioHandoffCompatibilityDecision;
  }): AdaptedStudioInput {
    const base = createBaseAdaptedInput(this.kind, input.handoff, input.context);
    return maybeAttachGroupedInput(input.handoff, Object.freeze({
      ...base,
      studioSpecific: Object.freeze({
        expectedInputContractId: input.compatibility.matchedContractId ?? input.handoff.payload.targetInputContract.contractId,
        dependencyCandidates: Object.freeze(input.context.sourceReferences.map((entry) => Object.freeze({
          assetId: entry.assetId,
          versionId: entry.versionId,
          relation: entry.relation ?? "dependency",
        }))),
      }),
    }));
  }
}

export class SystemStudioInputAdapter extends BaseStudioInputAdapter {
  public readonly id = "studio-input-adapter:system";
  public readonly kind = AdaptedStudioInputKinds.system;

  public constructor(supportedStudioTypes: ReadonlyArray<string>) {
    super(supportedStudioTypes);
  }

  public adapt(input: {
    readonly handoff: StudioHandoffContract;
    readonly context: StudioHandoffContext;
    readonly compatibility: StudioHandoffCompatibilityDecision;
  }): AdaptedStudioInput {
    const base = createBaseAdaptedInput(this.kind, input.handoff, input.context);
    const systemOfSystems = input.handoff.payload.systemOfSystems;
    return maybeAttachGroupedInput(input.handoff, Object.freeze({
      ...base,
      studioSpecific: Object.freeze({
        expectedInputContractId: input.compatibility.matchedContractId ?? input.handoff.payload.targetInputContract.contractId,
        supportsNestedSystemContext: true,
        systemOfSystems,
        systemReferences: Object.freeze(
          input.context.sourceReferences
            .filter((entry) => entry.relation?.includes("system") ?? false)
            .map((entry) => Object.freeze({
              assetId: entry.assetId,
              versionId: entry.versionId,
            })),
        ),
      }),
    }));
  }
}

export class SystemAwareStudioInputAdapter extends SystemStudioInputAdapter {}

export class StudioInputAdapterRegistry {
  private readonly adapters = new Map<string, StudioInputAdapter>();

  public register(adapter: StudioInputAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Studio input adapter '${adapter.id}' is already registered.`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  public findForTargetStudio(studioType: string): StudioInputAdapter | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.canAdapt(studioType)) {
        return adapter;
      }
    }
    return undefined;
  }
}

export class StudioInputAdapterLayer {
  public constructor(
    private readonly compatibilityValidator: Pick<StudioHandoffCompatibilityValidator, "validate">,
    private readonly adapterRegistry: StudioInputAdapterRegistry,
  ) {}

  public adapt(input: {
    readonly handoff: StudioHandoffContract;
    readonly context?: StudioHandoffContext;
    readonly targetCapabilities: ReadonlyArray<StudioCapabilityDescriptor>;
  }): StudioInputAdaptationResult {
    const context = input.context ?? input.handoff.context;
    if (!context) {
      const compatibility = Object.freeze({
        compatible: false,
        targetStudioType: input.handoff.target.studioType,
        issues: Object.freeze([]),
      });
      return Object.freeze({
        ok: false,
        compatibility,
        issues: Object.freeze([{
          code: "context-missing",
          message: "Studio handoff context is required before studio input adaptation.",
          path: "context",
        }]),
      });
    }

    if (
      context.targetStudioId !== input.handoff.target.studioId
      || context.targetStudioType !== input.handoff.target.studioType
      || context.sourceStudioId !== input.handoff.source.studioId
      || context.sourceStudioType !== input.handoff.source.studioType
    ) {
      const compatibility = Object.freeze({
        compatible: false,
        targetStudioType: input.handoff.target.studioType,
        issues: Object.freeze([]),
      });
      return Object.freeze({
        ok: false,
        compatibility,
        issues: Object.freeze([{
          code: "context-target-mismatch",
          message: "Studio handoff context source/target identity must match handoff contract source/target.",
          path: "context.targetStudioType",
        }]),
      });
    }

    const compatibility = this.compatibilityValidator.validate({
      handoff: input.handoff,
      targetCapabilities: input.targetCapabilities,
    });

    if (!compatibility.compatible) {
      return Object.freeze({
        ok: false,
        compatibility,
        issues: Object.freeze([
          {
            code: "compatibility-failed",
            message: "Studio handoff compatibility validation failed prior to adaptation.",
            path: "handoff",
          },
          ...compatibility.issues,
        ]),
      });
    }

    const adapter = this.adapterRegistry.findForTargetStudio(input.handoff.target.studioType);
    if (!adapter) {
      return Object.freeze({
        ok: false,
        compatibility: Object.freeze({
          ...compatibility,
          compatible: false,
          issues: Object.freeze([
            ...compatibility.issues,
            {
              code: StudioHandoffCompatibilityIssueCodes.targetStudioUnsupported,
              message: `No studio input adapter is registered for target studio type '${input.handoff.target.studioType}'.`,
              path: "target.studioType",
            },
          ]),
        }),
        issues: Object.freeze([{
          code: "adapter-not-found",
          message: `No studio input adapter is registered for target studio type '${input.handoff.target.studioType}'.`,
          path: "target.studioType",
        }]),
      });
    }

    const adapted = adapter.adapt({
      handoff: input.handoff,
      context,
      compatibility,
    });

    return Object.freeze({
      ok: true,
      compatibility,
      adapted,
      issues: Object.freeze([]),
    });
  }
}
