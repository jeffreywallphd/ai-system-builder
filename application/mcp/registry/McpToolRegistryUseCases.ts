import {
  createInstalledMcpToolRecord,
  type InstalledMcpToolLifecycleEvent,
  type InstalledMcpToolLifecycle,
  type InstalledMcpToolRecord,
  type McpToolDefinitionSource,
  type McpToolLifecycleAction,
  type McpToolVersionPolicy,
  type McpToolVersionTransitionKind,
} from "../../../domain/mcp/InstalledMcpTool";
import {
  normalizeMcpToolDefinition,
  validateMcpToolDefinition,
  type McpToolDefinition,
  type McpToolSideEffectClass,
} from "../../../domain/mcp/McpToolCapability";
import type { IMcpToolDefinitionSourceLoader } from "../../ports/interfaces/IMcpToolDefinitionSourceLoader";
import type { IMcpToolDependencyScanner, McpToolDependencyReference } from "../../ports/interfaces/IMcpToolDependencyScanner";
import type { IMcpToolRegistryRepository } from "../../ports/interfaces/IMcpToolRegistryRepository";
import { McpToolRegistryError } from "./McpToolRegistryErrors";

export interface InstallMcpToolRequest {
  readonly source?: McpToolDefinitionSource;
  readonly definition?: McpToolDefinition;
  readonly overwrite?: boolean;
  readonly versionPolicy?: McpToolVersionPolicy;
}

export interface PreviewMcpToolUpdateRequest {
  readonly toolId: string;
  readonly source?: McpToolDefinitionSource;
  readonly definition?: McpToolDefinition;
}

export interface ApplyMcpToolUpdateRequest extends PreviewMcpToolUpdateRequest {
  readonly force?: boolean;
  readonly allowDowngrade?: boolean;
  readonly allowReplace?: boolean;
  readonly versionPolicy?: McpToolVersionPolicy;
  readonly policyProfile?: McpToolCompatibilityPolicyProfile;
  readonly approval?: McpToolUpdateApproval;
}

interface ObjectChange<TValue> {
  readonly changed: boolean;
  readonly from: TValue;
  readonly to: TValue;
}

interface CollectionChange {
  readonly changed: boolean;
  readonly added: ReadonlyArray<string>;
  readonly removed: ReadonlyArray<string>;
}

export interface McpToolChangeClassification {
  readonly informational: ReadonlyArray<string>;
  readonly compatibilityRisk: ReadonlyArray<string>;
  readonly likelyBreaking: ReadonlyArray<string>;
  readonly dependencyImpact: ReadonlyArray<string>;
}

export interface McpToolDefinitionChangeSummary {
  readonly version: ObjectChange<string>;
  readonly source: ObjectChange<McpToolDefinitionSource>;
  readonly versionPolicy: ObjectChange<McpToolVersionPolicy>;
  readonly binding: ObjectChange<McpToolDefinition["binding"]>;
  readonly inputSchema: ObjectChange<Readonly<Record<string, unknown>>>;
  readonly outputSchema: ObjectChange<Readonly<Record<string, unknown>> | undefined>;
  readonly sideEffects: ObjectChange<McpToolSideEffectClass>;
  readonly auth: ObjectChange<McpToolDefinition["auth"]>;
  readonly permissions: CollectionChange;
  readonly assetIo: ObjectChange<McpToolDefinition["assetIo"]>;
  readonly tags: CollectionChange;
  readonly categories: CollectionChange;
  readonly classification: McpToolChangeClassification;
}

export interface McpToolDependencySafetyAssessment {
  readonly status: "no-dependencies" | "safe" | "ack-required" | "blocked";
  readonly reason: string;
}

export interface PreviewMcpToolUpdateResult {
  readonly toolId: string;
  readonly action: McpToolLifecycleAction;
  readonly transition: McpToolVersionTransitionKind;
  readonly compatibility: "compatible" | "risky" | "breaking";
  readonly dependencyReferences: ReadonlyArray<{ readonly kind: string; readonly id: string; readonly label: string; readonly detail?: string }>;
  readonly dependencySafety: McpToolDependencySafetyAssessment;
  readonly changeSummary: McpToolDefinitionChangeSummary;
  readonly warnings: ReadonlyArray<string>;
  readonly remediationSuggestions: ReadonlyArray<McpToolUpdateRemediationSuggestion>;
}

export interface ApplyMcpToolUpdateResult {
  readonly status: "updated" | "blocked";
  readonly toolId: string;
  readonly action: McpToolLifecycleAction;
  readonly transition: McpToolVersionTransitionKind;
  readonly compatibility: "compatible" | "risky" | "breaking";
  readonly changeSummary: McpToolDefinitionChangeSummary;
  readonly dependencySafety: McpToolDependencySafetyAssessment;
  readonly references: ReadonlyArray<{ readonly kind: string; readonly id: string; readonly label: string; readonly detail?: string }>;
  readonly warnings: ReadonlyArray<string>;
  readonly remediationSuggestions: ReadonlyArray<McpToolUpdateRemediationSuggestion>;
  readonly record?: InstalledMcpToolRecord;
}

export type McpToolCompatibilityPolicyProfile = "strict" | "balanced" | "permissive";

export interface McpToolUpdateApproval {
  readonly acknowledgedRisk?: boolean;
  readonly acknowledgedBreaking?: boolean;
}

export interface McpToolUpdateRemediationSuggestion {
  readonly code: "review-workflow-inputs" | "revalidate-output-contract" | "review-permissions-auth" | "plan-downgrade-mitigation";
  readonly title: string;
  readonly detail: string;
}

export interface McpToolLifecycleHistoryEntryReadModel {
  readonly toolId: string;
  readonly occurredAt: string;
  readonly action: McpToolLifecycleAction;
  readonly transition: McpToolVersionTransitionKind;
  readonly fromVersion?: string;
  readonly toVersion: string;
  readonly reason?: string;
}

export interface McpToolLifecycleSummaryReadModel {
  readonly toolId: string;
  readonly version: string;
  readonly status: InstalledMcpToolRecord["status"];
  readonly versionPolicy: McpToolVersionPolicy;
  readonly counters: Readonly<{
    installCount: number;
    reinstallCount: number;
    updateCount: number;
    downgradeCount: number;
    replaceCount: number;
  }>;
  readonly lastEvent?: McpToolLifecycleHistoryEntryReadModel;
}

export interface InstalledMcpToolReadModel {
  readonly toolId: string;
  readonly status: InstalledMcpToolRecord["status"];
  readonly installedAt: string;
  readonly updatedAt: string;
  readonly version: string;
  readonly source: McpToolDefinitionSource;
  readonly versionPolicy: McpToolVersionPolicy;
  readonly lifecycle: Readonly<{
    lastAction: McpToolLifecycleAction;
    lastTransition: McpToolVersionTransitionKind;
    previousVersion?: string;
    lastResolvedVersion: string;
    historyCount: number;
    lastEventAt?: string;
  }>;
  readonly updatePosture: "stable" | "risky-change-observed" | "breaking-change-observed";
}

export interface RemoveMcpToolResult {
  readonly status: "removed" | "blocked";
  readonly toolId: string;
  readonly references: ReadonlyArray<{ readonly kind: string; readonly id: string; readonly label: string; readonly detail?: string }>;
}

export interface QueryMcpCapabilitiesRequest {
  readonly inputType?: string;
  readonly outputType?: string;
  readonly inputPath?: string;
  readonly outputPath?: string;
  readonly ioMatchMode?: "exact" | "assignable";
  readonly includeSideEffects?: boolean;
  readonly maxSideEffectClass?: McpToolSideEffectClass;
  readonly requiresAuth?: boolean;
  readonly authKinds?: ReadonlyArray<"none" | "optional" | "required">;
  readonly sideEffects?: ReadonlyArray<McpToolSideEffectClass>;
  readonly tags?: ReadonlyArray<string>;
  readonly tagMatchMode?: "all" | "any";
  readonly categories?: ReadonlyArray<string>;
  readonly categoryMatchMode?: "all" | "any";
  readonly enabledOnly?: boolean;
  readonly acceptsAssetKind?: string;
  readonly producesAssetKind?: string;
  readonly assetOutputMode?: "asset-create" | "asset-transform";
  readonly transformsExistingAsset?: boolean;
  readonly createsAsset?: boolean;
  readonly supportsMixedInputs?: boolean;
  readonly requiresAssetVersion?: boolean;
}

export class InstallMcpToolUseCase {
  constructor(
    private readonly repository: IMcpToolRegistryRepository,
    private readonly sourceLoader?: IMcpToolDefinitionSourceLoader,
  ) {}

  public async execute(request: InstallMcpToolRequest): Promise<InstalledMcpToolRecord> {
    const definition = await resolveDefinition(request, this.sourceLoader);
    const validation = validateMcpToolDefinition(definition);
    if (!validation.valid) {
      throw new McpToolRegistryError("invalid-definition", "MCP tool definition is invalid.", { issues: validation.issues });
    }

    const normalizedDefinition = normalizeMcpToolDefinition(definition);
    const existing = await this.repository.getInstalledTool(normalizedDefinition.id);
    const transition = classifyVersionTransition(existing?.definition.version, normalizedDefinition.version);
    if (existing && request.overwrite !== true && transition !== "same-version") {
      throw new McpToolRegistryError("invalid-transition", `MCP tool '${normalizedDefinition.id}' requires explicit update flow.`, {
        transition,
      });
    }
    if (existing && request.overwrite !== true) {
      throw new McpToolRegistryError("duplicate-install", `MCP tool '${normalizedDefinition.id}' is already installed.`);
    }

    const record = existing
      ? Object.freeze({
          ...existing,
          definition: normalizedDefinition,
          updatedAt: new Date().toISOString(),
          source: request.source ?? existing.source,
          lifecycle: nextLifecycle({
            current: existing.lifecycle,
            action: "replace",
            transition,
            currentVersion: existing.definition.version,
            nextVersion: normalizedDefinition.version,
            versionPolicy: request.versionPolicy ?? existing.lifecycle?.versionPolicy,
            reason: "install-overwrite",
          }),
        })
      : createInstalledMcpToolRecord({
          definition: normalizedDefinition,
          source: request.source ?? { kind: "inline", location: "inline:manual" },
          versionPolicy: request.versionPolicy,
        });

    return this.repository.saveInstalledTool(record);
  }
}

export class PreviewMcpToolUpdateUseCase {
  constructor(
    private readonly repository: IMcpToolRegistryRepository,
    private readonly dependencyScanner: IMcpToolDependencyScanner,
    private readonly sourceLoader?: IMcpToolDefinitionSourceLoader,
  ) {}

  public async execute(request: PreviewMcpToolUpdateRequest): Promise<PreviewMcpToolUpdateResult> {
    const existing = await this.repository.getInstalledTool(request.toolId.trim());
    if (!existing) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }

    const candidate = await loadValidatedCandidate(request, this.sourceLoader, existing.toolId);
    const nextSource = request.source ?? existing.source;
    const changeSummary = summarizeDefinitionChanges(existing, candidate, nextSource);
    const transition = classifyVersionTransition(existing.definition.version, candidate.version);
    const action = classifyUpdateAction(transition);
    const compatibility = classifyCompatibility(changeSummary, transition, "balanced");
    const dependencyReferences = await this.dependencyScanner.scanToolReferences(existing.toolId);
    const dependencySafety = assessDependencySafety(dependencyReferences.length, compatibility, false);
    const remediationSuggestions = buildRemediationSuggestions(compatibility, changeSummary, transition, dependencyReferences.length > 0);

    return Object.freeze({
      toolId: existing.toolId,
      action,
      transition,
      compatibility,
      dependencyReferences,
      dependencySafety,
      changeSummary,
      warnings: buildUpdateWarnings(transition, compatibility, dependencyReferences.length > 0),
      remediationSuggestions,
    });
  }
}

export class ApplyMcpToolUpdateUseCase {
  constructor(
    private readonly repository: IMcpToolRegistryRepository,
    private readonly dependencyScanner: IMcpToolDependencyScanner,
    private readonly sourceLoader?: IMcpToolDefinitionSourceLoader,
  ) {}

  public async execute(request: ApplyMcpToolUpdateRequest): Promise<ApplyMcpToolUpdateResult> {
    const existing = await this.repository.getInstalledTool(request.toolId.trim());
    if (!existing) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${request.toolId}' was not found.`);
    }

    const candidate = await loadValidatedCandidate(request, this.sourceLoader, existing.toolId);
    const nextSource = request.source ?? existing.source;
    const changeSummary = summarizeDefinitionChanges(existing, candidate, nextSource, request.versionPolicy);
    const transition = classifyVersionTransition(existing.definition.version, candidate.version);
    const action = classifyUpdateAction(transition);
    const compatibility = classifyCompatibility(changeSummary, transition, request.policyProfile ?? "balanced");
    const references = await this.dependencyScanner.scanToolReferences(existing.toolId);
    const warnings = buildUpdateWarnings(transition, compatibility, references.length > 0);
    const dependencySafety = assessDependencySafety(references.length, compatibility, request.force === true);
    const remediationSuggestions = buildRemediationSuggestions(compatibility, changeSummary, transition, references.length > 0);

    if (transition === "downgrade" && request.allowDowngrade !== true && request.force !== true) {
      return blockedUpdateResult(existing.toolId, action, transition, compatibility, changeSummary, dependencySafety, references, [
        ...warnings,
        "Downgrade is blocked unless allowDowngrade or force is set.",
      ], remediationSuggestions);
    }

    if (transition === "incomparable" && request.allowReplace !== true && request.force !== true) {
      return blockedUpdateResult(existing.toolId, action, transition, compatibility, changeSummary, dependencySafety, references, [
        ...warnings,
        "Incomparable version transition is blocked unless allowReplace or force is set.",
      ], remediationSuggestions);
    }

    if (compatibility === "risky" && request.approval?.acknowledgedRisk !== true && request.force !== true) {
      return blockedUpdateResult(existing.toolId, action, transition, compatibility, changeSummary, dependencySafety, references, [
        ...warnings,
        "Risky update requires explicit risk acknowledgement.",
      ], remediationSuggestions);
    }

    if (compatibility === "breaking" && request.approval?.acknowledgedBreaking !== true && request.force !== true) {
      return blockedUpdateResult(existing.toolId, action, transition, compatibility, changeSummary, dependencySafety, references, [
        ...warnings,
        "Breaking update requires explicit breaking-change acknowledgement.",
      ], remediationSuggestions);
    }

    if (references.length > 0 && compatibility !== "compatible" && request.force !== true) {
      return blockedUpdateResult(existing.toolId, action, transition, compatibility, changeSummary, dependencySafety, references, [
        ...warnings,
        "Update is blocked because dependent workflows exist and compatibility is risky/breaking.",
      ], remediationSuggestions);
    }

    const next = Object.freeze({
      ...existing,
      definition: candidate,
      source: request.source ?? existing.source,
      updatedAt: new Date().toISOString(),
      lifecycle: nextLifecycle({
        current: existing.lifecycle,
        action,
        transition,
        currentVersion: existing.definition.version,
        nextVersion: candidate.version,
        versionPolicy: request.versionPolicy ?? existing.lifecycle?.versionPolicy,
        reason: `apply-${action}`,
      }),
    });
    const saved = await this.repository.saveInstalledTool(next);

    return Object.freeze({
      status: "updated",
      toolId: saved.toolId,
      action,
      transition,
      compatibility,
      changeSummary,
      dependencySafety,
      references,
      warnings,
      remediationSuggestions,
      record: saved,
    });
  }
}

export class ListInstalledMcpToolsUseCase {
  constructor(private readonly repository: IMcpToolRegistryRepository) {}

  public async execute(): Promise<ReadonlyArray<InstalledMcpToolReadModel>> {
    const records = await this.repository.listInstalledTools();
    return Object.freeze(records.map((record) => toInstalledToolReadModel(record)));
  }
}

export class GetInstalledMcpToolUseCase {
  constructor(private readonly repository: IMcpToolRegistryRepository) {}

  public async execute(toolId: string): Promise<InstalledMcpToolReadModel> {
    const record = await this.repository.getInstalledTool(toolId.trim());
    if (!record) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${toolId}' was not found.`);
    }
    return toInstalledToolReadModel(record);
  }
}

export class ListMcpToolLifecycleHistoryUseCase {
  constructor(private readonly repository: IMcpToolRegistryRepository) {}

  public async execute(toolId: string): Promise<ReadonlyArray<McpToolLifecycleHistoryEntryReadModel>> {
    const record = await this.repository.getInstalledTool(toolId.trim());
    if (!record) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${toolId}' was not found.`);
    }
    return Object.freeze(
      [...(record.lifecycle?.history ?? [])]
        .map((event) => this.toReadModel(record.toolId, event))
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
    );
  }

  private toReadModel(toolId: string, event: InstalledMcpToolLifecycleEvent): McpToolLifecycleHistoryEntryReadModel {
    return Object.freeze({
      toolId,
      occurredAt: event.occurredAt,
      action: event.action,
      transition: event.transition,
      fromVersion: event.fromVersion,
      toVersion: event.toVersion,
      reason: event.reason,
    });
  }
}

export class GetMcpToolLifecycleSummaryUseCase {
  constructor(private readonly repository: IMcpToolRegistryRepository) {}

  public async execute(toolId: string): Promise<McpToolLifecycleSummaryReadModel> {
    const record = await this.repository.getInstalledTool(toolId.trim());
    if (!record) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${toolId}' was not found.`);
    }
    const lifecycle = record.lifecycle;
    const fallbackPolicy: McpToolVersionPolicy = "pinned";
    const history = lifecycle?.history ?? [];
    const lastEvent = history.length > 0 ? history[history.length - 1] : undefined;
    return Object.freeze({
      toolId: record.toolId,
      version: record.definition.version,
      status: record.status,
      versionPolicy: lifecycle?.versionPolicy ?? fallbackPolicy,
      counters: Object.freeze({
        installCount: lifecycle?.installCount ?? 1,
        reinstallCount: lifecycle?.reinstallCount ?? 0,
        updateCount: lifecycle?.updateCount ?? 0,
        downgradeCount: lifecycle?.downgradeCount ?? 0,
        replaceCount: lifecycle?.replaceCount ?? 0,
      }),
      lastEvent: lastEvent
        ? Object.freeze({
            toolId: record.toolId,
            occurredAt: lastEvent.occurredAt,
            action: lastEvent.action,
            transition: lastEvent.transition,
            fromVersion: lastEvent.fromVersion,
            toVersion: lastEvent.toVersion,
            reason: lastEvent.reason,
          })
        : undefined,
    });
  }
}

export class SetMcpToolStatusUseCase {
  constructor(private readonly repository: IMcpToolRegistryRepository) {}

  public async enable(toolId: string): Promise<InstalledMcpToolRecord> {
    return this.updateStatus(toolId, "enabled");
  }

  public async disable(toolId: string): Promise<InstalledMcpToolRecord> {
    return this.updateStatus(toolId, "disabled");
  }

  private async updateStatus(toolId: string, status: InstalledMcpToolRecord["status"]): Promise<InstalledMcpToolRecord> {
    const existing = await this.repository.getInstalledTool(toolId.trim());
    if (!existing) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${toolId}' was not found.`);
    }
    if (existing.status === status) {
      return existing;
    }
    return this.repository.saveInstalledTool(
      Object.freeze({
        ...existing,
        status,
        updatedAt: new Date().toISOString(),
      }),
    );
  }
}

export class RemoveMcpToolUseCase {
  constructor(
    private readonly repository: IMcpToolRegistryRepository,
    private readonly dependencyScanner: IMcpToolDependencyScanner,
  ) {}

  public async execute(toolId: string): Promise<RemoveMcpToolResult> {
    const normalizedId = toolId.trim();
    const existing = await this.repository.getInstalledTool(normalizedId);
    if (!existing) {
      throw new McpToolRegistryError("tool-not-found", `MCP tool '${toolId}' was not found.`);
    }

    const references = await this.dependencyScanner.scanToolReferences(normalizedId);
    if (references.length > 0) {
      return Object.freeze({
        status: "blocked",
        toolId: normalizedId,
        references: Object.freeze(
          references.map((reference) =>
            Object.freeze({
              kind: reference.kind,
              id: reference.id,
              label: reference.label,
              detail: reference.detail,
            }),
          ),
        ),
      });
    }

    await this.repository.removeInstalledTool(normalizedId);

    return Object.freeze({ status: "removed", toolId: normalizedId, references: Object.freeze([]) });
  }
}

export class QueryMcpToolCapabilitiesUseCase {
  constructor(private readonly repository: IMcpToolRegistryRepository) {}

  public async execute(filters: QueryMcpCapabilitiesRequest = {}): Promise<ReadonlyArray<InstalledMcpToolRecord>> {
    const tools = await this.repository.listInstalledTools();

    return Object.freeze(tools.filter((tool) => this.matches(tool, filters)));
  }

  private matches(tool: InstalledMcpToolRecord, filters: QueryMcpCapabilitiesRequest): boolean {
    if (filters.enabledOnly === true && tool.status !== "enabled") {
      return false;
    }

    if (filters.inputType && !schemaSupportsType(tool.definition.inputSchema, filters.inputType, filters.inputPath, filters.ioMatchMode)) {
      return false;
    }

    if (filters.outputType && !schemaSupportsType(tool.definition.outputSchema, filters.outputType, filters.outputPath, filters.ioMatchMode)) {
      return false;
    }

    if (filters.acceptsAssetKind) {
      const acceptedKinds = tool.definition.assetIo?.inputs?.flatMap((entry) => entry.assetKinds ?? []) ?? [];
      if (!acceptedKinds.some((kind) => kind === filters.acceptsAssetKind)) {
        return false;
      }
    }

    if (filters.producesAssetKind) {
      const producedKinds = tool.definition.assetIo?.outputs
        ?.filter((entry) => entry.mode !== "raw")
        .map((entry) => entry.assetKind)
        .filter((kind) => typeof kind === "string") ?? [];
      if (!producedKinds.some((kind) => kind === filters.producesAssetKind)) {
        return false;
      }
    }

    if (filters.assetOutputMode) {
      const modes = tool.definition.assetIo?.outputs?.map((entry) => entry.mode) ?? [];
      if (!modes.includes(filters.assetOutputMode)) {
        return false;
      }
    }

    if (filters.transformsExistingAsset === true) {
      const modes = tool.definition.assetIo?.outputs?.map((entry) => entry.mode) ?? [];
      if (!modes.includes("asset-transform")) {
        return false;
      }
    }

    if (filters.createsAsset === true) {
      const modes = tool.definition.assetIo?.outputs?.map((entry) => entry.mode) ?? [];
      if (!modes.includes("asset-create")) {
        return false;
      }
    }

    if (filters.supportsMixedInputs === true) {
      const hasAssetInputs = (tool.definition.assetIo?.inputs?.length ?? 0) > 0;
      if (!(hasAssetInputs && tool.definition.assetIo?.allowsRawInputs !== false)) {
        return false;
      }
    }

    if (filters.requiresAssetVersion === true) {
      const requiresVersion = tool.definition.assetIo?.inputs?.some((entry) =>
        entry.valueKind === "asset-version-id" || entry.versionRequirement === "required") ?? false;
      if (!requiresVersion) {
        return false;
      }
    }

    if (filters.includeSideEffects === false && tool.definition.sideEffects !== "none") {
      return false;
    }

    if (filters.requiresAuth === true && tool.definition.auth.kind !== "required") {
      return false;
    }

    if (filters.authKinds && filters.authKinds.length > 0 && !filters.authKinds.includes(tool.definition.auth.kind)) {
      return false;
    }

    if (filters.sideEffects && filters.sideEffects.length > 0 && !filters.sideEffects.includes(tool.definition.sideEffects)) {
      return false;
    }

    if (filters.maxSideEffectClass && sideEffectSeverity(tool.definition.sideEffects) > sideEffectSeverity(filters.maxSideEffectClass)) {
      return false;
    }

    if (
      filters.tags &&
      filters.tags.length > 0 &&
      !matchStringSet(tool.definition.tags, filters.tags, filters.tagMatchMode ?? "all")
    ) {
      return false;
    }

    if (
      filters.categories &&
      filters.categories.length > 0 &&
      !matchStringSet(tool.definition.categories, filters.categories, filters.categoryMatchMode ?? "any")
    ) {
      return false;
    }

    return true;
  }
}

function schemaSupportsType(
  schema: Readonly<Record<string, unknown>> | undefined,
  type: string,
  path?: string,
  matchMode: "exact" | "assignable" = "assignable",
): boolean {
  if (!schema) {
    return false;
  }
  const targetSchema = resolveSchemaPath(schema, path);
  return schemaNodeSupportsType(targetSchema, type, matchMode);
}

function schemaNodeSupportsType(
  schema: Readonly<Record<string, unknown>> | undefined,
  expectedType: string,
  matchMode: "exact" | "assignable",
): boolean {
  if (!schema) {
    return false;
  }

  if (schemaTypeMatches(schema, expectedType, matchMode)) {
    return true;
  }

  const properties = asSchemaRecord(schema.properties);
  if (properties && Object.values(properties).some((property) => schemaNodeSupportsType(asSchemaRecord(property), expectedType, matchMode))) {
    return true;
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.some((entry) => schemaNodeSupportsType(asSchemaRecord(entry), expectedType, matchMode))) {
    return true;
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.some((entry) => schemaNodeSupportsType(asSchemaRecord(entry), expectedType, matchMode))) {
    return true;
  }

  const items = asSchemaRecord(schema.items);
  if (items && schemaNodeSupportsType(items, expectedType, matchMode)) {
    return true;
  }

  return false;
}

function resolveSchemaPath(schema: Readonly<Record<string, unknown>>, path?: string): Readonly<Record<string, unknown>> | undefined {
  if (!path?.trim()) {
    return schema;
  }

  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  let current: Readonly<Record<string, unknown>> | undefined = schema;
  for (const segment of segments) {
    if (segment === "*") {
      current = asSchemaRecord(current?.items);
      continue;
    }
    current = asSchemaRecord(asSchemaRecord(current?.properties)?.[segment]);
    if (!current) {
      return undefined;
    }
  }

  return current;
}

function schemaTypeMatches(
  schema: Readonly<Record<string, unknown>>,
  expectedType: string,
  matchMode: "exact" | "assignable",
): boolean {
  const schemaType = typeof schema.type === "string" ? schema.type : undefined;
  if (!schemaType) {
    return false;
  }
  if (matchMode === "exact") {
    return schemaType === expectedType;
  }
  return schemaType === expectedType || isAssignableSchemaType(schemaType, expectedType);
}

function isAssignableSchemaType(schemaType: string, expectedType: string): boolean {
  if (expectedType === "number" && schemaType === "integer") {
    return true;
  }
  if (expectedType === "array" && schemaType === "object") {
    return false;
  }
  return false;
}

function asSchemaRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function matchStringSet(
  haystack: ReadonlyArray<string>,
  needles: ReadonlyArray<string>,
  mode: "all" | "any",
): boolean {
  if (mode === "any") {
    return needles.some((needle) => haystack.includes(needle));
  }
  return needles.every((needle) => haystack.includes(needle));
}

function sideEffectSeverity(sideEffects: McpToolSideEffectClass): number {
  switch (sideEffects) {
    case "none":
      return 0;
    case "read":
      return 1;
    case "write":
      return 2;
    case "network":
      return 3;
    case "system":
      return 4;
    default:
      return 99;
  }
}

function classifyVersionTransition(currentVersion: string | undefined, candidateVersion: string): McpToolVersionTransitionKind {
  if (!currentVersion) {
    return "initial-install";
  }
  if (currentVersion === candidateVersion) {
    return "same-version";
  }
  const comparison = compareLooseSemver(currentVersion, candidateVersion);
  if (comparison === undefined) {
    return "incomparable";
  }
  return comparison < 0 ? "upgrade" : "downgrade";
}

function compareLooseSemver(left: string, right: string): -1 | 0 | 1 | undefined {
  const parse = (value: string): readonly [number, number, number] | undefined => {
    const normalized = value.trim().replace(/^v/i, "");
    const matched = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(normalized);
    if (!matched) {
      return undefined;
    }
    return [Number(matched[1]), Number(matched[2]), Number(matched[3])] as const;
  };

  const leftParsed = parse(left);
  const rightParsed = parse(right);
  if (!leftParsed || !rightParsed) {
    return undefined;
  }

  for (let index = 0; index < leftParsed.length; index += 1) {
    if (leftParsed[index] < rightParsed[index]) {
      return -1;
    }
    if (leftParsed[index] > rightParsed[index]) {
      return 1;
    }
  }
  return 0;
}

function classifyUpdateAction(transition: McpToolVersionTransitionKind): McpToolLifecycleAction {
  switch (transition) {
    case "same-version":
      return "reinstall";
    case "upgrade":
      return "update";
    case "downgrade":
      return "downgrade";
    case "incomparable":
      return "replace";
    case "initial-install":
    default:
      return "install";
  }
}

function summarizeDefinitionChanges(
  current: InstalledMcpToolRecord,
  candidate: McpToolDefinition,
  nextSource: McpToolDefinitionSource,
  requestedPolicy?: McpToolVersionPolicy,
): McpToolDefinitionChangeSummary {
  const currentPolicy = current.lifecycle?.versionPolicy ?? "pinned";
  const nextPolicy = requestedPolicy ?? currentPolicy;
  const summary = Object.freeze({
    version: objectChange(current.definition.version, candidate.version),
    source: objectChange(current.source, nextSource),
    versionPolicy: objectChange(currentPolicy, nextPolicy),
    binding: objectChange(current.definition.binding, candidate.binding),
    inputSchema: objectChange(current.definition.inputSchema, candidate.inputSchema),
    outputSchema: objectChange(current.definition.outputSchema, candidate.outputSchema),
    sideEffects: objectChange(current.definition.sideEffects, candidate.sideEffects),
    auth: objectChange(current.definition.auth, candidate.auth),
    permissions: collectionChange(current.definition.permissions ?? [], candidate.permissions ?? []),
    assetIo: objectChange(current.definition.assetIo, candidate.assetIo),
    tags: collectionChange(current.definition.tags, candidate.tags),
    categories: collectionChange(current.definition.categories, candidate.categories),
    classification: Object.freeze({
      informational: Object.freeze([]),
      compatibilityRisk: Object.freeze([]),
      likelyBreaking: Object.freeze([]),
      dependencyImpact: Object.freeze([]),
    }),
  });
  return Object.freeze({
    ...summary,
    classification: classifyChangeSummary(summary),
  });
}

function classifyCompatibility(
  changes: McpToolDefinitionChangeSummary,
  transition: McpToolVersionTransitionKind,
  profile: McpToolCompatibilityPolicyProfile,
): "compatible" | "risky" | "breaking" {
  if (transition === "downgrade") {
    return "breaking";
  }

  const schemaRisk = classifySchemaRisk(changes.inputSchema.from, changes.inputSchema.to, changes.outputSchema.from, changes.outputSchema.to);
  if (changes.binding.changed || changes.auth.changed || changes.permissions.changed || changes.assetIo.changed || schemaRisk === "breaking") {
    return "breaking";
  }
  if (
    profile === "strict" &&
    (schemaRisk === "risky" || changes.sideEffects.changed || changes.tags.changed || changes.categories.changed || transition === "incomparable")
  ) {
    return "breaking";
  }
  if (schemaRisk === "risky" || changes.sideEffects.changed || changes.tags.changed || changes.categories.changed || transition === "incomparable") {
    return "risky";
  }
  return "compatible";
}

function classifySchemaRisk(
  previousInput: Readonly<Record<string, unknown>>,
  nextInput: Readonly<Record<string, unknown>>,
  previousOutput: Readonly<Record<string, unknown>> | undefined,
  nextOutput: Readonly<Record<string, unknown>> | undefined,
): "compatible" | "risky" | "breaking" {
  const inputDelta = summarizeSchemaDelta(previousInput, nextInput);
  const outputDelta = summarizeSchemaDelta(previousOutput, nextOutput);

  if (inputDelta.requiredAdded.length > 0 || inputDelta.requiredRemoved.length > 0) {
    return "breaking";
  }
  if (inputDelta.typeChanges.length > 0 || outputDelta.typeChanges.length > 0) {
    return "breaking";
  }
  if (inputDelta.propertyRemoved.length > 0 || outputDelta.propertyRemoved.length > 0) {
    return "breaking";
  }
  if (inputDelta.propertyAdded.length > 0 || outputDelta.propertyAdded.length > 0) {
    return "risky";
  }
  return "compatible";
}

function buildUpdateWarnings(
  transition: McpToolVersionTransitionKind,
  compatibility: "compatible" | "risky" | "breaking",
  hasDependencies: boolean,
): ReadonlyArray<string> {
  const warnings: string[] = [];

  if (transition === "downgrade") {
    warnings.push("Candidate version is older than installed version.");
  }
  if (transition === "incomparable") {
    warnings.push("Version transition is incomparable with loose semver rules.");
  }
  if (compatibility === "risky") {
    warnings.push("Candidate definition has metadata changes that may affect trust/discovery behavior.");
  }
  if (compatibility === "breaking") {
    warnings.push("Candidate definition includes potentially breaking contract changes.");
  }
  if (hasDependencies && compatibility !== "compatible") {
    warnings.push("Dependent workflows reference this tool and may break after update.");
  }

  return Object.freeze(warnings);
}

function objectChange<TValue>(from: TValue, to: TValue): ObjectChange<TValue> {
  return Object.freeze({
    changed: JSON.stringify(from) !== JSON.stringify(to),
    from,
    to,
  });
}

function collectionChange(from: ReadonlyArray<string>, to: ReadonlyArray<string>): CollectionChange {
  const fromSet = new Set(from);
  const toSet = new Set(to);
  return Object.freeze({
    changed: JSON.stringify(from) !== JSON.stringify(to),
    added: Object.freeze(to.filter((entry) => !fromSet.has(entry))),
    removed: Object.freeze(from.filter((entry) => !toSet.has(entry))),
  });
}

function summarizeSchemaDelta(
  from: Readonly<Record<string, unknown>> | undefined,
  to: Readonly<Record<string, unknown>> | undefined,
): Readonly<{
  requiredAdded: ReadonlyArray<string>;
  requiredRemoved: ReadonlyArray<string>;
  propertyAdded: ReadonlyArray<string>;
  propertyRemoved: ReadonlyArray<string>;
  typeChanges: ReadonlyArray<string>;
}> {
  if (!from && !to) {
    return Object.freeze({
      requiredAdded: Object.freeze([]),
      requiredRemoved: Object.freeze([]),
      propertyAdded: Object.freeze([]),
      propertyRemoved: Object.freeze([]),
      typeChanges: Object.freeze([]),
    });
  }

  const fromProperties = asSchemaRecord(from?.properties) ?? {};
  const toProperties = asSchemaRecord(to?.properties) ?? {};
  const fromKeys = new Set(Object.keys(fromProperties));
  const toKeys = new Set(Object.keys(toProperties));
  const propertyAdded = Object.freeze([...toKeys].filter((key) => !fromKeys.has(key)));
  const propertyRemoved = Object.freeze([...fromKeys].filter((key) => !toKeys.has(key)));
  const requiredFrom = new Set(Array.isArray(from?.required) ? from.required.filter((entry): entry is string => typeof entry === "string") : []);
  const requiredTo = new Set(Array.isArray(to?.required) ? to.required.filter((entry): entry is string => typeof entry === "string") : []);
  const requiredAdded = Object.freeze([...requiredTo].filter((key) => !requiredFrom.has(key)));
  const requiredRemoved = Object.freeze([...requiredFrom].filter((key) => !requiredTo.has(key)));
  const typeChanges = Object.freeze(
    [...fromKeys]
      .filter((key) => toKeys.has(key))
      .filter((key) => {
        const fromType = typeof asSchemaRecord(fromProperties[key])?.type === "string" ? asSchemaRecord(fromProperties[key])?.type : undefined;
        const toType = typeof asSchemaRecord(toProperties[key])?.type === "string" ? asSchemaRecord(toProperties[key])?.type : undefined;
        return fromType !== toType;
      }),
  );
  return Object.freeze({ requiredAdded, requiredRemoved, propertyAdded, propertyRemoved, typeChanges });
}

function buildRemediationSuggestions(
  compatibility: "compatible" | "risky" | "breaking",
  changes: McpToolDefinitionChangeSummary,
  transition: McpToolVersionTransitionKind,
  hasDependencies: boolean,
): ReadonlyArray<McpToolUpdateRemediationSuggestion> {
  const suggestions: McpToolUpdateRemediationSuggestion[] = [];

  if (changes.inputSchema.changed && hasDependencies) {
    suggestions.push(
      Object.freeze({
        code: "review-workflow-inputs",
        title: "Review workflow MCP node inputs",
        detail: "Validate stored MCP node argument mappings against the candidate input schema before applying this update.",
      }),
    );
  }
  if (changes.outputSchema.changed && hasDependencies) {
    suggestions.push(
      Object.freeze({
        code: "revalidate-output-contract",
        title: "Revalidate downstream output usage",
        detail: "Check downstream nodes and prompts that consume MCP output fields because output schema shape changed.",
      }),
    );
  }
  if (changes.auth.changed || changes.sideEffects.changed || changes.assetIo.changed) {
    suggestions.push(
      Object.freeze({
        code: "review-permissions-auth",
        title: "Review trust policy and credentials",
        detail: "Confirm credential fields and granted permissions still match the updated tool contract.",
      }),
    );
  }
  if (transition === "downgrade" || compatibility === "breaking") {
    suggestions.push(
      Object.freeze({
        code: "plan-downgrade-mitigation",
        title: "Plan rollback and mitigation",
        detail: "Capture a rollback plan and test impacted workflows before promoting this transition.",
      }),
    );
  }

  return Object.freeze(suggestions);
}

function classifyChangeSummary(changes: Omit<McpToolDefinitionChangeSummary, "classification">): McpToolChangeClassification {
  const informational: string[] = [];
  const compatibilityRisk: string[] = [];
  const likelyBreaking: string[] = [];
  const dependencyImpact: string[] = [];

  if (changes.version.changed) {
    informational.push("version");
  }
  if (changes.source.changed) {
    informational.push("source");
  }
  if (changes.versionPolicy.changed) {
    informational.push("version-policy");
  }
  if (changes.tags.changed || changes.categories.changed) {
    informational.push("discovery-metadata");
  }
  if (changes.sideEffects.changed || changes.permissions.changed || changes.auth.changed) {
    compatibilityRisk.push("trust-or-permissions");
  }
  if (changes.assetIo.changed) {
    compatibilityRisk.push("asset-io-contract");
    dependencyImpact.push("asset-dependent-workflows");
  }
  if (changes.inputSchema.changed) {
    likelyBreaking.push("input-contract");
    dependencyImpact.push("stored-input-mappings");
  }
  if (changes.outputSchema.changed) {
    likelyBreaking.push("output-contract");
    dependencyImpact.push("downstream-output-consumers");
  }
  if (changes.binding.changed) {
    likelyBreaking.push("runtime-binding");
  }

  return Object.freeze({
    informational: Object.freeze(informational),
    compatibilityRisk: Object.freeze(compatibilityRisk),
    likelyBreaking: Object.freeze(likelyBreaking),
    dependencyImpact: Object.freeze(dependencyImpact),
  });
}

function assessDependencySafety(
  dependencyCount: number,
  compatibility: "compatible" | "risky" | "breaking",
  forced: boolean,
): McpToolDependencySafetyAssessment {
  if (dependencyCount === 0) {
    return Object.freeze({ status: "no-dependencies", reason: "No dependent workflows reference this tool." });
  }
  if (compatibility === "compatible") {
    return Object.freeze({ status: "safe", reason: "Dependent workflows exist, but update is contract-compatible." });
  }
  if (forced) {
    return Object.freeze({ status: "ack-required", reason: "Dependent workflows exist; explicit override is required for risky/breaking changes." });
  }
  return Object.freeze({ status: "blocked", reason: "Dependent workflows exist and compatibility is risky/breaking." });
}

function toInstalledToolReadModel(record: InstalledMcpToolRecord): InstalledMcpToolReadModel {
  const lifecycle = record.lifecycle;
  const history = lifecycle?.history ?? [];
  const lastEvent = history.length > 0 ? history[history.length - 1] : undefined;
  const updatePosture = !lastEvent
    ? "stable"
    : lastEvent.transition === "same-version" || lastEvent.transition === "upgrade"
      ? "stable"
      : lastEvent.transition === "incomparable"
        ? "risky-change-observed"
        : "breaking-change-observed";

  return Object.freeze({
    toolId: record.toolId,
    status: record.status,
    installedAt: record.installedAt,
    updatedAt: record.updatedAt,
    version: record.definition.version,
    source: record.source,
    versionPolicy: lifecycle?.versionPolicy ?? "pinned",
    lifecycle: Object.freeze({
      lastAction: lifecycle?.lastAction ?? "install",
      lastTransition: lifecycle?.lastTransition ?? "initial-install",
      previousVersion: lifecycle?.previousVersion,
      lastResolvedVersion: lifecycle?.lastResolvedVersion ?? record.definition.version,
      historyCount: history.length,
      lastEventAt: lastEvent?.occurredAt,
    }),
    updatePosture,
  });
}

function nextLifecycle(params: {
  readonly current?: InstalledMcpToolLifecycle;
  readonly action: McpToolLifecycleAction;
  readonly transition: McpToolVersionTransitionKind;
  readonly currentVersion: string;
  readonly nextVersion: string;
  readonly versionPolicy?: McpToolVersionPolicy;
  readonly reason?: string;
}): InstalledMcpToolLifecycle {
  const current = params.current;
  const baselineInstallCount = current?.installCount ?? 1;
  return Object.freeze({
    versionPolicy: params.versionPolicy ?? current?.versionPolicy ?? "pinned",
    lastAction: params.action,
    lastTransition: params.transition,
    installCount: baselineInstallCount + (params.action === "install" ? 1 : 0),
    reinstallCount: (current?.reinstallCount ?? 0) + (params.action === "reinstall" ? 1 : 0),
    updateCount: (current?.updateCount ?? 0) + (params.action === "update" ? 1 : 0),
    downgradeCount: (current?.downgradeCount ?? 0) + (params.action === "downgrade" ? 1 : 0),
    replaceCount: (current?.replaceCount ?? 0) + (params.action === "replace" ? 1 : 0),
    previousVersion: params.currentVersion !== params.nextVersion ? params.currentVersion : current?.previousVersion,
    lastResolvedVersion: params.nextVersion,
    history: Object.freeze([
      ...(current?.history ?? []),
      Object.freeze({
        occurredAt: new Date().toISOString(),
        action: params.action,
        transition: params.transition,
        fromVersion: params.currentVersion !== params.nextVersion ? params.currentVersion : undefined,
        toVersion: params.nextVersion,
        reason: params.reason,
      }),
    ]),
  });
}

async function resolveDefinition(
  request: { readonly source?: McpToolDefinitionSource; readonly definition?: McpToolDefinition },
  sourceLoader?: IMcpToolDefinitionSourceLoader,
): Promise<McpToolDefinition> {
  if (request.definition) {
    return request.definition;
  }
  if (!request.source || !sourceLoader) {
    throw new McpToolRegistryError("invalid-definition", "Tool install/update requires either definition or a loadable source.");
  }
  return sourceLoader.load(request.source);
}

async function loadValidatedCandidate(
  request: PreviewMcpToolUpdateRequest,
  sourceLoader: IMcpToolDefinitionSourceLoader | undefined,
  expectedToolId: string,
): Promise<McpToolDefinition> {
  const raw = await resolveDefinition(request, sourceLoader);
  const validation = validateMcpToolDefinition(raw);
  if (!validation.valid) {
    throw new McpToolRegistryError("invalid-definition", "MCP tool definition is invalid.", { issues: validation.issues });
  }
  const normalized = normalizeMcpToolDefinition(raw);
  if (normalized.id !== expectedToolId) {
    throw new McpToolRegistryError("invalid-transition", "Update candidate id does not match installed tool id.", {
      expectedToolId,
      candidateToolId: normalized.id,
    });
  }
  return normalized;
}

function blockedUpdateResult(
  toolId: string,
  action: McpToolLifecycleAction,
  transition: McpToolVersionTransitionKind,
  compatibility: "compatible" | "risky" | "breaking",
  changeSummary: McpToolDefinitionChangeSummary,
  dependencySafety: McpToolDependencySafetyAssessment,
  references: ReadonlyArray<McpToolDependencyReference>,
  warnings: ReadonlyArray<string>,
  remediationSuggestions: ReadonlyArray<McpToolUpdateRemediationSuggestion>,
): ApplyMcpToolUpdateResult {
  return Object.freeze({
    status: "blocked",
    toolId,
    action,
    transition,
    compatibility,
    changeSummary,
    dependencySafety,
    references,
    warnings,
    remediationSuggestions,
  });
}
