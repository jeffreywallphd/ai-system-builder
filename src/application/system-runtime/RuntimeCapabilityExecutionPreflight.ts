import {
  resolveModelCapabilityBinding,
  type ModelCapabilityDescriptor,
  type ModelCapabilityBindingPolicy,
  type ResolveModelCapabilityBindingResult,
} from "./ModelCapabilityBindingRules";
import {
  resolveRuntimeCapabilityBinding,
  type ResolveRuntimeCapabilityBindingResult,
} from "./RuntimeCapabilityBindingResolverService";
import type {
  RuntimeCapabilityBindingContract,
} from "./RuntimeCapabilityBindingContract";
import type { RuntimeExecutionOptionOverride } from "./ExecutionOptionCapabilityContract";

export const RuntimeCapabilityFailureKinds = Object.freeze({
  validationFailure: "validation-failure",
  unsupportedCapabilityMapping: "unsupported-capability-mapping",
  providerExecutionFailure: "provider-execution-failure",
});

export type RuntimeCapabilityFailureKind =
  typeof RuntimeCapabilityFailureKinds[keyof typeof RuntimeCapabilityFailureKinds];

export interface RuntimeCapabilityValidationIssue {
  readonly code:
    | "missing-model-binding"
    | "incompatible-model-binding"
    | "invalid-option-combination"
    | "unsupported-workflow-requirement"
    | "out-of-bounds-value"
    | "missing-required-option"
    | "provider-mismatch"
    | "binding-unavailable";
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface RuntimeCapabilityFailureState {
  readonly kind: RuntimeCapabilityFailureKind;
  readonly code: string;
  readonly message: string;
  readonly userSafeMessage: string;
  readonly issues: ReadonlyArray<RuntimeCapabilityValidationIssue>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface RuntimeCapabilityPreflightSuccess<TProviderConfig> {
  readonly ok: true;
  readonly resolvedBinding: ResolveRuntimeCapabilityBindingResult["resolvedBinding"];
  readonly resolvedExecutionOptions: ResolveRuntimeCapabilityBindingResult["resolvedExecutionOptions"];
  readonly modelBinding: ResolveModelCapabilityBindingResult;
  readonly providerConfig: TProviderConfig;
}

export interface RuntimeCapabilityPreflightFailure {
  readonly ok: false;
  readonly failure: RuntimeCapabilityFailureState;
}

export type RuntimeCapabilityPreflightResult<TProviderConfig> =
  | RuntimeCapabilityPreflightSuccess<TProviderConfig>
  | RuntimeCapabilityPreflightFailure;

export interface RuntimeCapabilityProviderTranslator<TProviderConfig> {
  translate(input: {
    readonly binding: RuntimeCapabilityBindingContract;
    readonly resolvedExecutionOptions: ResolveRuntimeCapabilityBindingResult["resolvedExecutionOptions"];
    readonly modelBinding: ResolveModelCapabilityBindingResult;
  }):
    | { readonly ok: true; readonly providerConfig: TProviderConfig }
    | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly diagnostics?: Readonly<Record<string, unknown>>;
    };
}

export interface RuntimeCapabilityPreflightRequest<TProviderConfig> {
  readonly binding: RuntimeCapabilityBindingContract;
  readonly modelPolicy: ModelCapabilityBindingPolicy;
  readonly modelDescriptors: ReadonlyArray<ModelCapabilityDescriptor>;
  readonly requestedModelBindingId?: string;
  readonly workflowDefaults?: RuntimeExecutionOptionOverride;
  readonly systemBindings?: RuntimeExecutionOptionOverride;
  readonly runtimeOverrides?: RuntimeExecutionOptionOverride;
  readonly providerId: string;
  readonly providerCapabilities?: ReadonlyArray<string>;
  readonly translator: RuntimeCapabilityProviderTranslator<TProviderConfig>;
}

function mapResolverErrorToIssue(error: unknown): RuntimeCapabilityValidationIssue {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("missing-required-execution-option:")) {
    return Object.freeze({
      code: "missing-required-option",
      message,
    });
  }
  if (message.startsWith("invalid-execution-option:")) {
    const [, path = ""] = message.split(":");
    return Object.freeze({
      code: "out-of-bounds-value",
      path,
      message,
    });
  }
  return Object.freeze({
    code: "invalid-option-combination",
    message,
  });
}

function validateOptionCombinations(
  options: ResolveRuntimeCapabilityBindingResult["resolvedExecutionOptions"],
): ReadonlyArray<RuntimeCapabilityValidationIssue> {
  if (options.runtime?.device === "cpu" && (options.runtime.precision === "fp16" || options.runtime.precision === "bf16")) {
    return Object.freeze([Object.freeze({
      code: "invalid-option-combination",
      path: "runtime.precision",
      message: "Half precision is unsupported when runtime.device is cpu.",
    })]);
  }
  return Object.freeze([]);
}

function validateWorkflowRequirements(input: {
  readonly binding: RuntimeCapabilityBindingContract;
  readonly providerCapabilities?: ReadonlyArray<string>;
}): ReadonlyArray<RuntimeCapabilityValidationIssue> {
  if (input.binding.availability.status === "unavailable") {
    return Object.freeze([Object.freeze({
      code: "binding-unavailable",
      message: input.binding.availability.message ?? "Runtime capability binding is unavailable.",
      details: {
        reasonCode: input.binding.availability.reasonCode,
        missingCapabilities: input.binding.availability.missingCapabilities,
      },
    })]);
  }

  if (!input.providerCapabilities || input.providerCapabilities.length === 0) {
    return Object.freeze([]);
  }

  const provider = new Set(input.providerCapabilities);
  const missing = input.binding.workflowExecutionProfile.requiredCapabilityTags.filter((tag) => !provider.has(tag));
  if (missing.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze([Object.freeze({
    code: "unsupported-workflow-requirement",
    message: "Workflow requires capabilities not supported by the selected provider runtime.",
    details: { missingCapabilities: missing },
  })]);
}

export function runRuntimeCapabilityPreflight<TProviderConfig>(
  request: RuntimeCapabilityPreflightRequest<TProviderConfig>,
): RuntimeCapabilityPreflightResult<TProviderConfig> {
  if (request.binding.executionProvider.providerId !== request.providerId) {
    return Object.freeze({
      ok: false,
      failure: {
        kind: RuntimeCapabilityFailureKinds.validationFailure,
        code: "provider-mismatch",
        message: "Runtime capability binding provider does not match requested execution provider.",
        userSafeMessage: "This run is configured for a different runtime provider.",
        issues: Object.freeze([Object.freeze({
          code: "provider-mismatch",
          message: `Binding targets '${request.binding.executionProvider.providerId}' but execution requested '${request.providerId}'.`,
        })]),
      },
    });
  }

  const workflowIssues = validateWorkflowRequirements({
    binding: request.binding,
    providerCapabilities: request.providerCapabilities,
  });
  if (workflowIssues.length > 0) {
    return Object.freeze({
      ok: false,
      failure: {
        kind: RuntimeCapabilityFailureKinds.validationFailure,
        code: workflowIssues[0]?.code ?? "unsupported-workflow-requirement",
        message: "Runtime capability preflight failed workflow/provider compatibility checks.",
        userSafeMessage: "This workflow cannot run with the current runtime capability configuration.",
        issues: workflowIssues,
      },
    });
  }

  const modelBinding = resolveModelCapabilityBinding({
    policy: request.modelPolicy,
    descriptors: request.modelDescriptors,
    executionProfileId: request.binding.workflowExecutionProfile.profileId,
    executionProviderId: request.providerId,
    requestedBindingId: request.requestedModelBindingId,
  });

  if (modelBinding.status !== "bound") {
    const code = modelBinding.status === "missing" ? "missing-model-binding" : "incompatible-model-binding";
    return Object.freeze({
      ok: false,
      failure: {
        kind: RuntimeCapabilityFailureKinds.validationFailure,
        code,
        message: modelBinding.message ?? "Model binding resolution failed.",
        userSafeMessage: "Execution cannot start because model requirements are not satisfied.",
        issues: Object.freeze([Object.freeze({
          code,
          message: modelBinding.message ?? "Model binding resolution failed.",
          details: { modelBinding },
        })]),
      },
    });
  }

  let resolved: ResolveRuntimeCapabilityBindingResult;
  try {
    resolved = resolveRuntimeCapabilityBinding({
      binding: request.binding,
      workflowDefaults: request.workflowDefaults,
      systemBindings: request.systemBindings,
      runtimeOverrides: request.runtimeOverrides,
    });
  } catch (error) {
    const issue = mapResolverErrorToIssue(error);
    return Object.freeze({
      ok: false,
      failure: {
        kind: RuntimeCapabilityFailureKinds.validationFailure,
        code: issue.code,
        message: issue.message,
        userSafeMessage: "Execution options are invalid for this runtime capability profile.",
        issues: Object.freeze([issue]),
      },
    });
  }

  const optionIssues = validateOptionCombinations(resolved.resolvedExecutionOptions);
  if (optionIssues.length > 0) {
    return Object.freeze({
      ok: false,
      failure: {
        kind: RuntimeCapabilityFailureKinds.validationFailure,
        code: "invalid-option-combination",
        message: "Execution option combinations are invalid.",
        userSafeMessage: "Execution options include an unsupported combination.",
        issues: optionIssues,
      },
    });
  }

  const translation = request.translator.translate({
    binding: resolved.resolvedBinding,
    resolvedExecutionOptions: resolved.resolvedExecutionOptions,
    modelBinding,
  });
  if (!translation.ok) {
    return Object.freeze({
      ok: false,
      failure: {
        kind: RuntimeCapabilityFailureKinds.unsupportedCapabilityMapping,
        code: translation.code,
        message: translation.message,
        userSafeMessage: "This runtime capability configuration is not supported by the selected provider.",
        issues: Object.freeze([]),
        diagnostics: translation.diagnostics,
      },
    });
  }

  return Object.freeze({
    ok: true,
    resolvedBinding: resolved.resolvedBinding,
    resolvedExecutionOptions: resolved.resolvedExecutionOptions,
    modelBinding,
    providerConfig: translation.providerConfig,
  });
}
