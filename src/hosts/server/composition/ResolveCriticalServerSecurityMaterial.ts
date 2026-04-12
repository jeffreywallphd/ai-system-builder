import { createHash } from "node:crypto";
import {
  SecurityMaterialSourceKinds,
  type SecurityMaterialStartupValidationResult,
} from "@application/security/services/SecurityMaterialStartupValidationPipeline";

interface SecurityMaterialDiagnosticsLogger {
  warn(event: Readonly<Record<string, unknown>>): void;
}

export interface ResolveCriticalServerSecurityMaterialInput {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly materialId: string;
  readonly environmentKey: string;
  readonly inheritedEnvironmentKey?: string;
  readonly startupSecurityMaterialValidation?: SecurityMaterialStartupValidationResult;
  readonly logger?: SecurityMaterialDiagnosticsLogger;
  readonly materialFormat: "string-secret" | "aes256-base64";
}

export function resolveCriticalServerSecurityMaterial(
  input: ResolveCriticalServerSecurityMaterialInput,
): string {
  const configured = normalizeOptional(input.environment[input.environmentKey]);
  if (configured) {
    return configured;
  }

  if (input.inheritedEnvironmentKey) {
    const inherited = normalizeOptional(input.environment[input.inheritedEnvironmentKey]);
    if (inherited) {
      return inherited;
    }
  }

  const validation = input.startupSecurityMaterialValidation;
  if (!validation) {
    throw new Error(buildMissingMaterialErrorMessage(input, "Startup security material validation context is unavailable."));
  }

  const observation = validation.observations.find((entry) => entry.materialId === input.materialId);
  const isGovernedDevelopmentFallback = !validation.productionCapable
    && observation?.sourceKind === SecurityMaterialSourceKinds.generatedEphemeral;
  if (!isGovernedDevelopmentFallback) {
    throw new Error(buildMissingMaterialErrorMessage(
      input,
      "Material is not eligible for governed development fallback in the current lifecycle policy.",
    ));
  }

  input.logger?.warn(Object.freeze({
    event: "authoritative-server.startup.security-material-governed-dev-fallback",
    details: Object.freeze({
      materialId: input.materialId,
      lifecycleStage: validation.lifecycleStage,
      environmentKey: input.environmentKey,
      inheritedEnvironmentKey: input.inheritedEnvironmentKey ?? "",
      productionCapable: validation.productionCapable ? "true" : "false",
    }),
  }));
  return deriveDeterministicDevelopmentFallback(input);
}

function deriveDeterministicDevelopmentFallback(
  input: ResolveCriticalServerSecurityMaterialInput,
): string {
  const namespace = normalizeOptional(input.environment.AI_LOOM_SECURITY_DEVELOPMENT_FALLBACK_NAMESPACE)
    ?? "ai-loom:security-material:development-fallback:v1";
  const hash = createHash("sha256")
    .update([
      namespace,
      input.materialId,
      input.environmentKey,
      input.inheritedEnvironmentKey ?? "",
    ].join(":"))
    .digest();

  if (input.materialFormat === "aes256-base64") {
    return hash.toString("base64");
  }

  return `development-only:${input.materialId}:${hash.toString("base64url").slice(0, 24)}`;
}

function buildMissingMaterialErrorMessage(
  input: ResolveCriticalServerSecurityMaterialInput,
  reason: string,
): string {
  const inheritedLabel = input.inheritedEnvironmentKey
    ? ` or inherited key '${input.inheritedEnvironmentKey}'`
    : "";
  return [
    `Critical security material '${input.materialId}' is not configured.`,
    `Set '${input.environmentKey}'${inheritedLabel} to a durable provider-backed value.`,
    reason,
  ].join(" ");
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
