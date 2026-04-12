import {
  resolveSecurityMaterialEnvironmentPolicy,
  type SecurityMaterialClassificationContract,
  type SecurityMaterialLifecycleStage,
} from "@application/security/contracts/SecurityMaterialClassificationContract";

export const SecurityMaterialValidationIssueSeverities = Object.freeze({
  fatal: "fatal",
  warning: "warning",
});

export type SecurityMaterialValidationIssueSeverity =
  typeof SecurityMaterialValidationIssueSeverities[keyof typeof SecurityMaterialValidationIssueSeverities];

export const SecurityMaterialStartupValidationStates = Object.freeze({
  ready: "ready",
  invalid: "invalid",
});

export type SecurityMaterialStartupValidationState =
  typeof SecurityMaterialStartupValidationStates[keyof typeof SecurityMaterialStartupValidationStates];

export const SecurityMaterialStartupValidationIssueCodes = Object.freeze({
  missing: "missing",
  invalidFormat: "invalid-format",
  nonDurableSource: "non-durable-source",
  disallowedSource: "disallowed-source",
});

export type SecurityMaterialStartupValidationIssueCode =
  typeof SecurityMaterialStartupValidationIssueCodes[keyof typeof SecurityMaterialStartupValidationIssueCodes];

export const SecurityMaterialSourceKinds = Object.freeze({
  environment: "environment",
  inheritedEnvironment: "inherited-environment",
  generatedEphemeral: "generated-ephemeral",
  missing: "missing",
  notApplicable: "not-applicable",
});

export type SecurityMaterialSourceKind =
  typeof SecurityMaterialSourceKinds[keyof typeof SecurityMaterialSourceKinds];

export const SecurityMaterialPersistenceKinds = Object.freeze({
  durable: "durable",
  ephemeral: "ephemeral",
});

export type SecurityMaterialPersistenceKind =
  typeof SecurityMaterialPersistenceKinds[keyof typeof SecurityMaterialPersistenceKinds];

export interface SecurityMaterialStartupValidationIssue {
  readonly materialId: string;
  readonly code: SecurityMaterialStartupValidationIssueCode;
  readonly severity: SecurityMaterialValidationIssueSeverity;
  readonly message: string;
  readonly sourceKind: SecurityMaterialSourceKind;
  readonly details?: Readonly<Record<string, string>>;
}

export interface SecurityMaterialStartupValidationObservation {
  readonly materialId: string;
  readonly sourceKind: SecurityMaterialSourceKind;
  readonly present: boolean;
  readonly formatValid: boolean;
  readonly persistence: SecurityMaterialPersistenceKind;
  readonly details?: Readonly<Record<string, string>>;
}

export interface SecurityMaterialStartupValidationDescriptorContext {
  readonly lifecycleStage: SecurityMaterialLifecycleStage;
  readonly deploymentProfile: {
    readonly profileId: string;
    readonly environmentName: string;
    readonly releaseChannel: string;
  };
  readonly environment: Readonly<Record<string, string | undefined>>;
}

export interface SecurityMaterialStartupValidationDescriptor {
  readonly materialId: string;
  readonly classification: SecurityMaterialClassificationContract;
  resolveObservation(
    context: SecurityMaterialStartupValidationDescriptorContext,
  ): SecurityMaterialStartupValidationObservation;
}

export interface SecurityMaterialStartupValidationResult {
  readonly state: SecurityMaterialStartupValidationState;
  readonly lifecycleStage: SecurityMaterialLifecycleStage;
  readonly productionCapable: boolean;
  readonly observations: ReadonlyArray<SecurityMaterialStartupValidationObservation>;
  readonly issues: ReadonlyArray<SecurityMaterialStartupValidationIssue>;
  readonly fatalIssues: ReadonlyArray<SecurityMaterialStartupValidationIssue>;
  readonly warnings: ReadonlyArray<SecurityMaterialStartupValidationIssue>;
  readonly governanceAssertions: {
    readonly total: number;
    readonly warning: number;
    readonly blocked: number;
    readonly entries: ReadonlyArray<SecurityMaterialGovernanceAssertion>;
  };
}

export interface RunSecurityMaterialStartupValidationPipelineInput {
  readonly context: SecurityMaterialStartupValidationDescriptorContext;
  readonly descriptors: ReadonlyArray<SecurityMaterialStartupValidationDescriptor>;
}

export const SecurityMaterialGovernanceAssertionAllowanceKinds = Object.freeze({
  ephemeralBootstrapMaterial: "ephemeral-bootstrap-material",
  relaxedValidationMode: "relaxed-validation-mode",
} as const);

export type SecurityMaterialGovernanceAssertionAllowanceKind =
  typeof SecurityMaterialGovernanceAssertionAllowanceKinds[keyof typeof SecurityMaterialGovernanceAssertionAllowanceKinds];

export const SecurityMaterialGovernanceAssertionEnforcementStates = Object.freeze({
  warning: "warning",
  blocked: "blocked",
} as const);

export type SecurityMaterialGovernanceAssertionEnforcementState =
  typeof SecurityMaterialGovernanceAssertionEnforcementStates[keyof typeof SecurityMaterialGovernanceAssertionEnforcementStates];

export interface SecurityMaterialGovernanceAssertion {
  readonly assertionId: string;
  readonly materialId: string;
  readonly allowanceKind: SecurityMaterialGovernanceAssertionAllowanceKind;
  readonly lifecycleStage: SecurityMaterialLifecycleStage;
  readonly productionCapable: boolean;
  readonly enforcement: SecurityMaterialGovernanceAssertionEnforcementState;
  readonly message: string;
  readonly sourceKind: SecurityMaterialSourceKind;
  readonly details?: Readonly<Record<string, string>>;
}

export function runSecurityMaterialStartupValidationPipeline(
  input: RunSecurityMaterialStartupValidationPipelineInput,
): SecurityMaterialStartupValidationResult {
  const observations: SecurityMaterialStartupValidationObservation[] = [];
  const issues: SecurityMaterialStartupValidationIssue[] = [];
  const governanceAssertions: SecurityMaterialGovernanceAssertion[] = [];
  const governanceAssertionIds = new Set<string>();

  for (const descriptor of input.descriptors) {
    const observation = descriptor.resolveObservation(input.context);
    observations.push(observation);

    const policy = resolveSecurityMaterialEnvironmentPolicy({
      classification: descriptor.classification,
      lifecycleStage: input.context.lifecycleStage,
    });
    const severity = policy.startupRequirement === "fail-fast-required"
      ? SecurityMaterialValidationIssueSeverities.fatal
      : SecurityMaterialValidationIssueSeverities.warning;

    if (!observation.present && observation.sourceKind !== SecurityMaterialSourceKinds.notApplicable) {
      issues.push(Object.freeze({
        materialId: descriptor.materialId,
        code: SecurityMaterialStartupValidationIssueCodes.missing,
        severity,
        message: "Security material is missing for current startup policy.",
        sourceKind: observation.sourceKind,
        details: observation.details,
      }));
      continue;
    }

    if (observation.present && !observation.formatValid) {
      issues.push(Object.freeze({
        materialId: descriptor.materialId,
        code: SecurityMaterialStartupValidationIssueCodes.invalidFormat,
        severity,
        message: "Security material format is invalid.",
        sourceKind: observation.sourceKind,
        details: observation.details,
      }));
    }

    if (
      observation.present
      && policy.durabilityClass === "durable"
      && observation.persistence === SecurityMaterialPersistenceKinds.ephemeral
    ) {
      issues.push(Object.freeze({
        materialId: descriptor.materialId,
        code: SecurityMaterialStartupValidationIssueCodes.nonDurableSource,
        severity,
        message: "Security material source is not durable for current startup policy.",
        sourceKind: observation.sourceKind,
        details: observation.details,
      }));
    }

    if (
      observation.present
      && policy.fallbackPolicy === "none"
      && observation.sourceKind === SecurityMaterialSourceKinds.generatedEphemeral
    ) {
      issues.push(Object.freeze({
        materialId: descriptor.materialId,
        code: SecurityMaterialStartupValidationIssueCodes.disallowedSource,
        severity,
        message: "Security material source violates fallback policy.",
        sourceKind: observation.sourceKind,
        details: observation.details,
      }));
    }

    const descriptorAssertions = resolveGovernanceAssertionsForObservation({
      descriptor,
      observation,
      lifecycleStage: input.context.lifecycleStage,
      productionCapable: input.context.lifecycleStage === "production",
      policy,
    });
    for (const assertion of descriptorAssertions) {
      if (governanceAssertionIds.has(assertion.assertionId)) {
        continue;
      }
      governanceAssertionIds.add(assertion.assertionId);
      governanceAssertions.push(assertion);
    }
  }

  const fatalIssues = issues.filter((issue) => issue.severity === SecurityMaterialValidationIssueSeverities.fatal);
  const warnings = issues.filter((issue) => issue.severity === SecurityMaterialValidationIssueSeverities.warning);
  const governanceSummary = summarizeGovernanceAssertions(governanceAssertions);

  return Object.freeze({
    state: fatalIssues.length > 0
      ? SecurityMaterialStartupValidationStates.invalid
      : SecurityMaterialStartupValidationStates.ready,
    lifecycleStage: input.context.lifecycleStage,
    productionCapable: input.context.lifecycleStage === "production",
    observations: Object.freeze(observations),
    issues: Object.freeze(issues),
    fatalIssues: Object.freeze(fatalIssues),
    warnings: Object.freeze(warnings),
    governanceAssertions: governanceSummary,
  });
}

function resolveGovernanceAssertionsForObservation(input: {
  readonly descriptor: SecurityMaterialStartupValidationDescriptor;
  readonly observation: SecurityMaterialStartupValidationObservation;
  readonly lifecycleStage: SecurityMaterialLifecycleStage;
  readonly productionCapable: boolean;
  readonly policy: {
    readonly durabilityClass: "durable" | "ephemeral";
    readonly startupRequirement: "fail-fast-required" | "optional";
    readonly fallbackPolicy: "none" | "migrate-legacy-input" | "generate-ephemeral-for-development";
  };
}): ReadonlyArray<SecurityMaterialGovernanceAssertion> {
  const assertions: SecurityMaterialGovernanceAssertion[] = [];
  const enforcement = input.productionCapable
    ? SecurityMaterialGovernanceAssertionEnforcementStates.blocked
    : SecurityMaterialGovernanceAssertionEnforcementStates.warning;
  const defaultPolicy = input.descriptor.classification.defaultPolicy;
  const generatedEphemeralObserved = input.observation.sourceKind === SecurityMaterialSourceKinds.generatedEphemeral
    || input.observation.persistence === SecurityMaterialPersistenceKinds.ephemeral;

  if (
    generatedEphemeralObserved
    || input.policy.durabilityClass === "ephemeral"
    || input.policy.fallbackPolicy === "generate-ephemeral-for-development"
  ) {
    assertions.push(Object.freeze({
      assertionId: `${input.descriptor.materialId}:ephemeral-bootstrap-material:${input.lifecycleStage}`,
      materialId: input.descriptor.materialId,
      allowanceKind: SecurityMaterialGovernanceAssertionAllowanceKinds.ephemeralBootstrapMaterial,
      lifecycleStage: input.lifecycleStage,
      productionCapable: input.productionCapable,
      enforcement,
      message: input.productionCapable
        ? "Development-only ephemeral bootstrap material allowance is blocked for production-capable startup."
        : "Development-only ephemeral bootstrap material allowance is active for the current lifecycle stage.",
      sourceKind: input.observation.sourceKind,
      details: input.observation.details,
    }));
  }

  if (
    input.policy.startupRequirement === "optional"
    && defaultPolicy.startupRequirement === "fail-fast-required"
  ) {
    assertions.push(Object.freeze({
      assertionId: `${input.descriptor.materialId}:relaxed-validation-mode:${input.lifecycleStage}`,
      materialId: input.descriptor.materialId,
      allowanceKind: SecurityMaterialGovernanceAssertionAllowanceKinds.relaxedValidationMode,
      lifecycleStage: input.lifecycleStage,
      productionCapable: input.productionCapable,
      enforcement,
      message: input.productionCapable
        ? "Development-only relaxed startup validation allowance is blocked for production-capable startup."
        : "Development-only relaxed startup validation allowance is active for the current lifecycle stage.",
      sourceKind: input.observation.sourceKind,
      details: input.observation.details,
    }));
  }

  return Object.freeze(assertions);
}

function summarizeGovernanceAssertions(
  assertions: ReadonlyArray<SecurityMaterialGovernanceAssertion>,
) {
  let warning = 0;
  let blocked = 0;

  for (const assertion of assertions) {
    if (assertion.enforcement === SecurityMaterialGovernanceAssertionEnforcementStates.blocked) {
      blocked += 1;
      continue;
    }
    warning += 1;
  }

  return Object.freeze({
    total: assertions.length,
    warning,
    blocked,
    entries: Object.freeze(assertions.map((assertion) => Object.freeze({
      ...assertion,
      details: assertion.details ? Object.freeze({ ...assertion.details }) : undefined,
    }))),
  });
}
