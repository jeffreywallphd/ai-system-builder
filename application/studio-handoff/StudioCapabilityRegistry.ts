import type { TargetStudioInputContract } from "../../domain/studio-handoff/StudioHandoffContract";
import type { CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";
import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";

export interface AcceptedStudioInputCapability {
  readonly capabilityId: string;
  readonly contract: TargetStudioInputContract;
  readonly supportsGroupedMultiAsset: boolean;
  readonly adapterKind?: "atomic" | "composite" | "system";
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ProducedStudioOutputCapability {
  readonly capabilityId: string;
  readonly taxonomy: CompositionTaxonomyDescriptor;
  readonly contract?: AssetContractDescriptor;
  readonly supportsGroupedMultiAsset: boolean;
  readonly adapterKind?: "atomic" | "composite" | "system";
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface StudioCapabilityDescriptor {
  readonly studioType: string;
  readonly studioId?: string;
  readonly displayName?: string;
  readonly registrationKind?: "atomic" | "composite" | "system";
  readonly acceptsMultiAssetHandoffs: boolean;
  readonly producesMultiAssetHandoffs: boolean;
  readonly acceptedInputs: ReadonlyArray<AcceptedStudioInputCapability>;
  readonly producedOutputs: ReadonlyArray<ProducedStudioOutputCapability>;
  readonly metadata?: Readonly<Record<string, string>>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function freezeMetadata(metadata?: Readonly<Record<string, string>>): Readonly<Record<string, string>> | undefined {
  if (!metadata) {
    return undefined;
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(metadata)
      .map(([key, value]) => [key.trim(), value.trim()])
      .filter(([key, value]) => key.length > 0 && value.length > 0),
  ));
}

function normalizeInputCapability(input: AcceptedStudioInputCapability): AcceptedStudioInputCapability {
  return Object.freeze({
    capabilityId: normalizeRequired(input.capabilityId, "Studio input capability id"),
    contract: Object.freeze({
      ...input.contract,
      contractId: normalizeRequired(input.contract.contractId, "Studio input contract id"),
      acceptedStructuralKinds: input.contract.acceptedStructuralKinds
        ? Object.freeze([...input.contract.acceptedStructuralKinds])
        : undefined,
      acceptedSemanticRoles: input.contract.acceptedSemanticRoles
        ? Object.freeze([...input.contract.acceptedSemanticRoles])
        : undefined,
      acceptedBehaviorKinds: input.contract.acceptedBehaviorKinds
        ? Object.freeze([...input.contract.acceptedBehaviorKinds])
        : undefined,
      allowedContextKeys: input.contract.allowedContextKeys
        ? Object.freeze(input.contract.allowedContextKeys.map((entry) => entry.trim()).filter(Boolean))
        : undefined,
    }),
    supportsGroupedMultiAsset: input.supportsGroupedMultiAsset,
    adapterKind: input.adapterKind,
    metadata: freezeMetadata(input.metadata),
  });
}

function normalizeOutputCapability(input: ProducedStudioOutputCapability): ProducedStudioOutputCapability {
  return Object.freeze({
    capabilityId: normalizeRequired(input.capabilityId, "Studio output capability id"),
    taxonomy: input.taxonomy,
    contract: input.contract,
    supportsGroupedMultiAsset: input.supportsGroupedMultiAsset,
    adapterKind: input.adapterKind,
    metadata: freezeMetadata(input.metadata),
  });
}

function normalizeDescriptor(input: StudioCapabilityDescriptor): StudioCapabilityDescriptor {
  const studioType = normalizeRequired(input.studioType, "Studio capability descriptor studioType");

  const acceptedInputs = input.acceptedInputs.map((entry) => normalizeInputCapability(entry));
  if (acceptedInputs.length === 0) {
    throw new Error(`Studio '${studioType}' must declare at least one accepted studio input capability.`);
  }

  return Object.freeze({
    studioType,
    studioId: input.studioId?.trim() || undefined,
    displayName: input.displayName?.trim() || undefined,
    registrationKind: input.registrationKind,
    acceptsMultiAssetHandoffs: input.acceptsMultiAssetHandoffs,
    producesMultiAssetHandoffs: input.producesMultiAssetHandoffs,
    acceptedInputs: Object.freeze(acceptedInputs),
    producedOutputs: Object.freeze(input.producedOutputs.map((entry) => normalizeOutputCapability(entry))),
    metadata: freezeMetadata(input.metadata),
  });
}

export class StudioCapabilityRegistry {
  private readonly byStudioType = new Map<string, StudioCapabilityDescriptor>();

  public register(descriptor: StudioCapabilityDescriptor): void {
    const normalized = normalizeDescriptor(descriptor);
    if (this.byStudioType.has(normalized.studioType)) {
      throw new Error(`Studio capability descriptor '${normalized.studioType}' is already registered.`);
    }
    this.byStudioType.set(normalized.studioType, normalized);
  }

  public replaceAll(descriptors: ReadonlyArray<StudioCapabilityDescriptor>): void {
    this.byStudioType.clear();
    for (const descriptor of descriptors) {
      this.register(descriptor);
    }
  }

  public get(studioType: string): StudioCapabilityDescriptor | undefined {
    return this.byStudioType.get(studioType.trim());
  }

  public list(): ReadonlyArray<StudioCapabilityDescriptor> {
    return Object.freeze([...this.byStudioType.values()].sort((left, right) => left.studioType.localeCompare(right.studioType)));
  }
}

export class StudioCapabilityQueryService {
  public constructor(private readonly registry: Pick<StudioCapabilityRegistry, "get" | "list">) {}

  public getStudioDescriptor(studioType: string): StudioCapabilityDescriptor | undefined {
    return this.registry.get(studioType);
  }

  public listAcceptedInputContracts(studioType: string): ReadonlyArray<TargetStudioInputContract> {
    const descriptor = this.registry.get(studioType);
    if (!descriptor) {
      return Object.freeze([]);
    }
    return Object.freeze(descriptor.acceptedInputs.map((entry) => entry.contract));
  }

  public listAcceptedInputRoles(studioType: string): ReadonlyArray<CompositionTaxonomyDescriptor["semanticRole"]> {
    const descriptor = this.registry.get(studioType);
    if (!descriptor) {
      return Object.freeze([]);
    }

    const roleSet = new Set<CompositionTaxonomyDescriptor["semanticRole"]>();
    for (const input of descriptor.acceptedInputs) {
      for (const role of input.contract.acceptedSemanticRoles ?? []) {
        roleSet.add(role);
      }
    }

    return Object.freeze([...roleSet].sort((left, right) => left.localeCompare(right)));
  }

  public listProducedOutputRoles(studioType: string): ReadonlyArray<CompositionTaxonomyDescriptor["semanticRole"]> {
    const descriptor = this.registry.get(studioType);
    if (!descriptor) {
      return Object.freeze([]);
    }

    const roleSet = new Set<CompositionTaxonomyDescriptor["semanticRole"]>();
    for (const output of descriptor.producedOutputs) {
      roleSet.add(output.taxonomy.semanticRole);
    }

    return Object.freeze([...roleSet].sort((left, right) => left.localeCompare(right)));
  }

  public supportsGroupedInput(studioType: string): boolean {
    const descriptor = this.registry.get(studioType);
    if (!descriptor) {
      return false;
    }
    return descriptor.acceptsMultiAssetHandoffs || descriptor.acceptedInputs.some((entry) => entry.supportsGroupedMultiAsset);
  }

  public listCapabilities(): ReadonlyArray<StudioCapabilityDescriptor> {
    return this.registry.list();
  }
}
