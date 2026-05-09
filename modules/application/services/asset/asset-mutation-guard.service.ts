import type {
  AssetMutationDiagnostic,
  AssetMutationFailure,
  FinalizeGeneratedOutputCommand,
  RegisterResourceBackedViewCommand,
} from "../../../contracts/asset";
import { sanitizeAssetMetadata } from "./asset-safe-metadata";

const REGISTER_OPERATION = "asset.register-resource-backed-view";
const FINALIZE_GENERATED_OUTPUT_OPERATION = "asset.finalize-generated-output";

export function validateRegisterResourceBackedViewMutationGuard(
  command: RegisterResourceBackedViewCommand,
): AssetMutationFailure | undefined {
  if (command.operation !== REGISTER_OPERATION) {
    return failure("validation", "Register resource-backed view use case received an unsupported mutation operation.", [
      diagnostic("error", "asset-mutation-operation-unsupported", "Only asset.register-resource-backed-view is accepted by this use case."),
    ]);
  }

  if (command.approval.confirmationKind !== "register-resource-backed-view") {
    return failure("validation", "Registration requires the register-resource-backed-view confirmation kind.", [
      diagnostic("error", "asset-mutation-confirmation-kind-invalid", "The confirmation kind does not match resource-backed view registration."),
    ]);
  }

  if (command.approval.userConfirmed !== true) {
    return failure("approval-required", "Explicit user confirmation is required before registering a resource-backed view.", [
      diagnostic("error", "asset-mutation-user-confirmation-required", "The command approval.userConfirmed flag must be true."),
    ]);
  }

  const disallowedAccessFlags = [
    command.approval.allowNetworkAccess === true ? "network" : undefined,
    command.approval.allowCredentialUse === true ? "credential" : undefined,
    command.approval.allowFilesystemWrite === true ? "filesystem-write" : undefined,
  ].filter((value): value is string => Boolean(value));

  if (disallowedAccessFlags.length > 0) {
    return failure("validation", "Resource-backed view registration must not request network, credential, or filesystem write access.", [
      diagnostic("error", "asset-mutation-access-flags-disallowed", "Simple registration stores Asset Kernel metadata only and must not request external access.", {
        disallowedAccessFlags,
      }),
    ]);
  }

  return undefined;
}

export function validateFinalizeGeneratedOutputMutationGuard(
  command: FinalizeGeneratedOutputCommand,
): AssetMutationFailure | undefined {
  if (command.operation !== FINALIZE_GENERATED_OUTPUT_OPERATION) {
    return failure("validation", "Finalize generated output use case received an unsupported mutation operation.", [
      diagnostic("error", "asset-mutation-operation-unsupported", "Only asset.finalize-generated-output is accepted by this use case."),
    ], FINALIZE_GENERATED_OUTPUT_OPERATION);
  }

  if (command.approval.confirmationKind !== "finalize-generated-output") {
    return failure("validation", "Generated output finalization requires the finalize-generated-output confirmation kind.", [
      diagnostic("error", "asset-mutation-confirmation-kind-invalid", "The confirmation kind does not match generated-output finalization."),
    ], FINALIZE_GENERATED_OUTPUT_OPERATION);
  }

  if (command.approval.userConfirmed !== true) {
    return failure("approval-required", "Explicit user confirmation is required before finalizing a generated output.", [
      diagnostic("error", "asset-mutation-user-confirmation-required", "The command approval.userConfirmed flag must be true."),
    ], FINALIZE_GENERATED_OUTPUT_OPERATION);
  }

  if (command.approval.allowFilesystemWrite !== true) {
    return failure("permission", "Generated output finalization requires explicit filesystem write approval for image/artifact persistence.", [
      diagnostic("error", "asset-mutation-filesystem-write-required", "The command approval.allowFilesystemWrite flag must be true for finalization."),
    ], FINALIZE_GENERATED_OUTPUT_OPERATION);
  }

  const disallowedAccessFlags = [
    command.approval.allowNetworkAccess === true ? "network" : undefined,
    command.approval.allowCredentialUse === true ? "credential" : undefined,
  ].filter((value): value is string => Boolean(value));

  if (disallowedAccessFlags.length > 0) {
    return failure("validation", "Generated output finalization must not request network or credential access by default.", [
      diagnostic("error", "asset-mutation-access-flags-disallowed", "Finalization through the Asset Kernel boundary uses local image/artifact seams only.", {
        disallowedAccessFlags,
      }),
    ], FINALIZE_GENERATED_OUTPUT_OPERATION);
  }

  return undefined;
}

function failure(
  code: AssetMutationFailure["code"],
  message: string,
  diagnostics?: readonly AssetMutationDiagnostic[],
  operation: AssetMutationFailure["operation"] = REGISTER_OPERATION,
): AssetMutationFailure {
  return {
    code,
    message,
    operation,
    ...(diagnostics?.length ? { diagnostics } : {}),
  };
}

function diagnostic(
  severity: AssetMutationDiagnostic["severity"],
  code: string,
  message: string,
  safeDetails?: Record<string, unknown>,
): AssetMutationDiagnostic {
  const sanitizedDetails = sanitizeAssetMetadata(safeDetails);
  return {
    severity,
    code,
    message,
    ...(sanitizedDetails ? { safeDetails: sanitizedDetails } : {}),
  };
}
