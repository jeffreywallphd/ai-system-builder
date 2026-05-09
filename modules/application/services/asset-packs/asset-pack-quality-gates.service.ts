import type {
  AssetPackAssetEntry,
  AssetValidationIssue,
  AssetValidationSummaryStatus,
} from "../../../contracts/asset";
import { isAssetPackId, isAssetPackVersion } from "../../../contracts/asset";
import {
  isUnsafeAssetMetadataKey,
  isUnsafeAssetMetadataString,
} from "../asset/asset-safe-metadata";
import { validateAssetPackAssetEntry } from "./asset-pack-validation.service";

export interface AssetPackQualityGateResult {
  readonly status: AssetValidationSummaryStatus;
  readonly issues: readonly AssetValidationIssue[];
}

const STABLE_DEFINITION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/;
const SAFE_TAG_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;
const CONFIGURABLE_CATEGORY_IDS = new Set(["forms-fields", "data-display", "state-messages"]);
const COMPOSITION_CATEGORY_IDS = new Set([
  "ui-structure",
  "page-feature-shells",
  "workflow-system-shells",
]);
const SHELL_CATEGORY_IDS = new Set(["page-feature-shells", "workflow-system-shells"]);
const FORBIDDEN_RENDERER_PATTERN =
  /\b(?:renderer|react|vue|svelte|tsx|jsx|component path|implementation path|css module|dom node)\b/i;
const EXECUTION_REQUIREMENT_PATTERN =
  /\b(?:runtime-execution|network|filesystem-read|filesystem-write|secret-read|external-provider-access)\b/i;

export function runAssetPackQualityGates(
  entry: AssetPackAssetEntry,
): AssetPackQualityGateResult {
  const issues: AssetValidationIssue[] = [...validateAssetPackAssetEntry(entry)];
  const definition = entry.definition;

  if (!STABLE_DEFINITION_ID_PATTERN.test(String(definition.definitionId))) {
    addIssue(issues, "error", "identity", "Asset definition ID must be stable and namespaced.", [
      "definition",
      "definitionId",
    ]);
  }
  if (!isAssetPackVersion(String(definition.version ?? ""))) {
    addIssue(issues, "error", "identity", "Asset definition version must be semver-like.", [
      "definition",
      "version",
    ]);
  }
  if (!hasText(definition.displayName)) {
    addIssue(issues, "error", "identity", "Asset definition display name is required.", [
      "definition",
      "displayName",
    ]);
  }
  if (!hasText(definition.aiContext?.userFacingSummary)) {
    addIssue(issues, "error", "ai-context", "User-facing AI summary is required.", [
      "definition",
      "aiContext",
      "userFacingSummary",
    ]);
  }
  if (!hasText(definition.lifecycleStatus)) {
    addIssue(issues, "error", "lifecycle", "Lifecycle status is required.", [
      "definition",
      "lifecycleStatus",
    ]);
  }
  if (!hasText(definition.reviewStatus)) {
    addIssue(issues, "error", "lifecycle", "Review status is required.", [
      "definition",
      "reviewStatus",
    ]);
  }
  if (definition.provenance?.sourceKind !== "system-generated") {
    addIssue(issues, "error", "provenance", "Foundation assets must declare system provenance.", [
      "definition",
      "provenance",
      "sourceKind",
    ]);
  }
  validateSourcePackMetadata(entry, issues);
  validateCategoryRequirements(entry, issues);
  validateAiContext(entry, issues);
  validateTags(entry, issues);
  validateNoUnsafeValues(entry, issues);
  validateRuntimeRequirements(entry, issues);

  return {
    status: deriveStatus(issues),
    issues,
  };
}

function validateSourcePackMetadata(
  entry: AssetPackAssetEntry,
  issues: AssetValidationIssue[],
): void {
  const sourcePack = entry.metadata?.sourcePack;
  if (!isRecord(sourcePack)) {
    addIssue(issues, "error", "provenance", "Source pack metadata is required.", [
      "metadata",
      "sourcePack",
    ]);
    return;
  }
  if (!isAssetPackId(String(sourcePack.packId ?? ""))) {
    addIssue(issues, "error", "provenance", "Source pack ID metadata must be safe.", [
      "metadata",
      "sourcePack",
      "packId",
    ]);
  }
  if (!isAssetPackVersion(String(sourcePack.version ?? ""))) {
    addIssue(issues, "error", "provenance", "Source pack version metadata must be semver-like.", [
      "metadata",
      "sourcePack",
      "version",
    ]);
  }
}

function validateCategoryRequirements(
  entry: AssetPackAssetEntry,
  issues: AssetValidationIssue[],
): void {
  if (!hasText(entry.category)) {
    addIssue(issues, "error", "identity", "Asset pack category is required.", [
      "category",
    ]);
  }
  if (CONFIGURABLE_CATEGORY_IDS.has(entry.category) && !entry.definition.configurationSchema?.fields.length) {
    addIssue(issues, "error", "configuration", "Configurable foundation assets require a configuration schema.", [
      "definition",
      "configurationSchema",
    ]);
  }
  if (
    COMPOSITION_CATEGORY_IDS.has(entry.category) &&
    !entry.definition.ports?.length &&
    !entry.definition.compositionRules?.length
  ) {
    addIssue(issues, "warning", "composition", "Structural foundation assets should declare ports or composition rules.", [
      "definition",
      "ports",
    ]);
  }
}

function validateAiContext(
  entry: AssetPackAssetEntry,
  issues: AssetValidationIssue[],
): void {
  const context = entry.definition.aiContext;
  if (!context) {
    addIssue(issues, "error", "ai-context", "AI context is required.", [
      "definition",
      "aiContext",
    ]);
    return;
  }
  if (!hasText(context.purpose)) {
    addIssue(issues, "error", "ai-context", "AI context purpose is required.", [
      "definition",
      "aiContext",
      "purpose",
    ]);
  }
  if (!context.capabilities?.length) {
    addIssue(issues, "warning", "ai-context", "AI context should list capabilities.", [
      "definition",
      "aiContext",
      "capabilities",
    ]);
  }
  if (!context.limitations?.length) {
    addIssue(issues, "warning", "ai-context", "AI context should list limitations.", [
      "definition",
      "aiContext",
      "limitations",
    ]);
  }
}

function validateTags(
  entry: AssetPackAssetEntry,
  issues: AssetValidationIssue[],
): void {
  if (!entry.tags?.length) {
    addIssue(issues, "info", "identity", "Foundation assets should include useful tags.", [
      "tags",
    ]);
    return;
  }
  entry.tags.forEach((tag, index) => {
    if (!SAFE_TAG_PATTERN.test(tag)) {
      addIssue(issues, "warning", "identity", "Asset pack tags should be safe and useful.", [
        "tags",
        String(index),
      ]);
    }
  });
}

function validateNoUnsafeValues(
  entry: AssetPackAssetEntry,
  issues: AssetValidationIssue[],
): void {
  walk(entry, [], (current, path) => {
    if (
      path.some((part) => part === "metadata" || part === "details") &&
      typeof current.key === "string" &&
      isUnsafeAssetMetadataKey(current.key)
    ) {
      addIssue(issues, "error", "security", "Foundation asset metadata key is unsafe.", path);
    }
    if (typeof current.value !== "string") return;
    if (
      isUnsafeAssetMetadataString(current.value) ||
      FORBIDDEN_RENDERER_PATTERN.test(current.value)
    ) {
      addIssue(issues, "error", "security", "Foundation asset contains unsafe implementation or resource detail.", path);
    }
  });
}

function validateRuntimeRequirements(
  entry: AssetPackAssetEntry,
  issues: AssetValidationIssue[],
): void {
  const serializedRequirements = JSON.stringify(entry.definition.requirements ?? []);
  if (serializedRequirements && EXECUTION_REQUIREMENT_PATTERN.test(serializedRequirements)) {
    addIssue(issues, "warning", "requirement", "Foundation primitive declares runtime, provider, network, or storage requirements.", [
      "definition",
      "requirements",
    ]);
  }
  if (
    SHELL_CATEGORY_IDS.has(entry.category) &&
    /\b(?:execute|execution|run workflow|start runtime)\b/i.test(
      JSON.stringify(entry.definition),
    )
  ) {
    addIssue(issues, "error", "composition", "Shell primitives must not imply execution behavior.", [
      "definition",
    ]);
  }
}

function walk(
  value: unknown,
  path: readonly string[],
  callback: (
    current: { readonly key?: string; readonly value: unknown },
    path: readonly string[],
  ) => void,
  seen = new WeakSet<object>(),
): void {
  callback({ value }, path);
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, [...path, String(index)], callback, seen));
    return;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    callback({ key, value: entry }, [...path, key]);
    walk(entry, [...path, key], callback, seen);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function addIssue(
  issues: AssetValidationIssue[],
  severity: AssetValidationIssue["severity"],
  category: AssetValidationIssue["category"],
  message: string,
  path: readonly string[],
): void {
  issues.push({ severity, category, message, path });
}

function deriveStatus(
  issues: readonly AssetValidationIssue[],
): AssetValidationSummaryStatus {
  if (issues.some((issue) => issue.severity === "error")) return "invalid";
  if (issues.some((issue) => issue.severity === "warning")) return "valid-with-warnings";
  return "valid";
}
