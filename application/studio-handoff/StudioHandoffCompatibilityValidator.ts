import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";
import type {
  StudioHandoffContract,
  TargetStudioInputContract,
} from "../../domain/studio-handoff/StudioHandoffContract";
import type { CompositionTaxonomyDescriptor } from "../../domain/taxonomy/CompositionTaxonomy";
import { listStudioHandoffPrefillKeys } from "../../domain/studio-handoff/StudioHandoffContext";

export const StudioHandoffCompatibilityIssueCodes = Object.freeze({
  targetStudioUnsupported: "target-studio-unsupported",
  sourceTargetSameStudio: "source-target-same-studio",
  targetInputContractMissing: "target-input-contract-missing",
  taxonomyIncompatible: "taxonomy-incompatible",
  contractIncompatible: "contract-incompatible",
  versionReferenceInvalid: "version-reference-invalid",
  contextKeyNotAllowed: "context-key-not-allowed",
});

export type StudioHandoffCompatibilityIssueCode =
  typeof StudioHandoffCompatibilityIssueCodes[keyof typeof StudioHandoffCompatibilityIssueCodes];

export interface StudioHandoffCompatibilityIssue {
  readonly code: StudioHandoffCompatibilityIssueCode;
  readonly message: string;
  readonly path?: string;
}

export interface StudioHandoffCompatibilityDecision {
  readonly compatible: boolean;
  readonly targetStudioType: string;
  readonly matchedContractId?: string;
  readonly issues: ReadonlyArray<StudioHandoffCompatibilityIssue>;
}

export interface StudioCapabilityDescriptor {
  readonly studioType: string;
  readonly displayName?: string;
  readonly acceptedInputs: ReadonlyArray<TargetStudioInputContract>;
}

function isTaxonomyAccepted(
  taxonomy: CompositionTaxonomyDescriptor,
  contract: TargetStudioInputContract,
): boolean {
  if (contract.acceptedStructuralKinds && !contract.acceptedStructuralKinds.includes(taxonomy.structuralKind)) {
    return false;
  }
  if (contract.acceptedSemanticRoles && !contract.acceptedSemanticRoles.includes(taxonomy.semanticRole)) {
    return false;
  }
  if (contract.acceptedBehaviorKinds && !contract.acceptedBehaviorKinds.includes(taxonomy.behaviorKind)) {
    return false;
  }
  return true;
}

function isExpectedParameterCompatible(input: {
  readonly expected: AssetContractDescriptor["parameters"][number];
  readonly actual: AssetContractDescriptor["parameters"][number] | undefined;
}): boolean {
  if (!input.actual) {
    return false;
  }
  if (input.actual.required !== input.expected.required) {
    return false;
  }
  if (input.expected.valueType && input.actual.valueType !== input.expected.valueType) {
    return false;
  }
  return true;
}

function isContractCompatible(
  expected: AssetContractDescriptor,
  actual: AssetContractDescriptor | undefined,
): boolean {
  if (!actual) {
    return false;
  }

  if (expected.input.kind !== actual.input.kind) {
    return false;
  }
  if (expected.output.kind !== actual.output.kind) {
    return false;
  }

  for (const parameter of expected.parameters) {
    const candidate = actual.parameters.find((entry) => entry.id === parameter.id);
    if (!isExpectedParameterCompatible({ expected: parameter, actual: candidate })) {
      return false;
    }
  }

  return true;
}

export class StudioHandoffCompatibilityValidator {
  public constructor(
    private readonly options: {
      readonly validateVersionReference?: (reference: { readonly assetId: string; readonly versionId: string }) => boolean;
    } = {},
  ) {}

  public validate(input: {
    readonly handoff: StudioHandoffContract;
    readonly targetCapabilities: ReadonlyArray<StudioCapabilityDescriptor>;
  }): StudioHandoffCompatibilityDecision {
    const issues: StudioHandoffCompatibilityIssue[] = [];

    if (
      input.handoff.source.studioId === input.handoff.target.studioId
      && input.handoff.source.studioType === input.handoff.target.studioType
    ) {
      issues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.sourceTargetSameStudio,
        message: "Source and target studio must be distinct for a studio-to-studio handoff.",
        path: "source",
      }));
    }

    const targetCapability = input.targetCapabilities.find((entry) => entry.studioType === input.handoff.target.studioType);
    if (!targetCapability) {
      issues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.targetStudioUnsupported,
        message: `Target studio type '${input.handoff.target.studioType}' has no registered handoff capability descriptor.`,
        path: "target.studioType",
      }));
      return Object.freeze({
        compatible: false,
        targetStudioType: input.handoff.target.studioType,
        issues: Object.freeze(issues),
      });
    }

    const requestedContractId = input.handoff.payload.targetInputContract.contractId;
    const acceptedContract = targetCapability.acceptedInputs.find((entry) => entry.contractId === requestedContractId);
    if (!acceptedContract) {
      issues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.targetInputContractMissing,
        message: `Target studio '${targetCapability.studioType}' does not expose input contract '${requestedContractId}'.`,
        path: "payload.targetInputContract.contractId",
      }));
    }

    const contractForValidation = acceptedContract ?? input.handoff.payload.targetInputContract;
    if (!isTaxonomyAccepted(input.handoff.payload.taxonomy, contractForValidation)) {
      issues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.taxonomyIncompatible,
        message: `Handoff taxonomy '${input.handoff.payload.taxonomy.structuralKind}/${input.handoff.payload.taxonomy.semanticRole}/${input.handoff.payload.taxonomy.behaviorKind}' is not accepted by target studio contract '${contractForValidation.contractId}'.`,
        path: "payload.taxonomy",
      }));
    }

    if (contractForValidation.expectedContract && !isContractCompatible(contractForValidation.expectedContract, input.handoff.payload.contract)) {
      issues.push(Object.freeze({
        code: StudioHandoffCompatibilityIssueCodes.contractIncompatible,
        message: `Handoff asset contract is incompatible with target studio input contract '${contractForValidation.contractId}'.`,
        path: "payload.contract",
      }));
    }

    if (contractForValidation.requireVersionedAsset ?? true) {
      const referenceIsValid = this.options.validateVersionReference
        ? this.options.validateVersionReference({
          assetId: input.handoff.payload.assetId,
          versionId: input.handoff.payload.versionId,
        })
        : input.handoff.payload.versionId.trim().length > 0;

      if (!referenceIsValid) {
        issues.push(Object.freeze({
          code: StudioHandoffCompatibilityIssueCodes.versionReferenceInvalid,
          message: `Asset '${input.handoff.payload.assetId}' version reference '${input.handoff.payload.versionId}' is invalid for handoff.`,
          path: "payload.versionId",
        }));
      }
    }

    if (contractForValidation.allowedContextKeys) {
      const allowed = new Set(contractForValidation.allowedContextKeys);
      for (const key of listStudioHandoffPrefillKeys(input.handoff.context)) {
        if (!allowed.has(key)) {
          issues.push(Object.freeze({
            code: StudioHandoffCompatibilityIssueCodes.contextKeyNotAllowed,
            message: `Handoff context key '${key}' is not accepted by target input contract '${contractForValidation.contractId}'.`,
            path: `context.config.${key}`,
          }));
        }
      }
    }

    return Object.freeze({
      compatible: issues.length === 0,
      targetStudioType: input.handoff.target.studioType,
      matchedContractId: acceptedContract?.contractId,
      issues: Object.freeze(issues),
    });
  }
}
