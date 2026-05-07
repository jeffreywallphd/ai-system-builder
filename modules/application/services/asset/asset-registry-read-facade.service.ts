import type {
  AssetBinding,
  AssetComposition,
  AssetDefinition,
  AssetInstance,
  AssetJsonObject,
  AssetJsonValue,
  AssetMetadata,
  AssetReference,
  AssetResourceBackedView,
} from "../../../contracts/asset";
import { normalizeAssetId } from "../../../contracts/asset";
import type {
  AssetBindingRepositoryPort,
  AssetCompositionRepositoryPort,
  AssetDefinitionRepositoryPort,
  AssetInstanceRepositoryPort,
} from "../../ports/asset";
import { BUILT_IN_ASSET_DEFINITION_CATALOG } from "./built-ins";
import { validateAssetComposition } from "./validate-asset-composition.service";
import { validateAssetDefinition } from "./validate-asset-definition.service";
import { validateAssetInstance } from "./validate-asset-instance.service";
import type {
  AssetBindingSummary,
  AssetCompositionCard,
  AssetCompositionDetail,
  AssetConfigurationSummary,
  AssetDefinitionCard,
  AssetDefinitionDetail,
  AssetInstanceCard,
  AssetInstanceDetail,
  AssetRegistryListDiagnostic,
  AssetRegistryListQuery,
  AssetRegistryListResult,
  AssetRegistryReadOptions,
  AssetRegistryResourceBackedViewCard,
  AssetRegistryResourceBackedViewDetail,
  AssetResourceBackedViewProvider,
  AssetResourceBackedViewQuery,
} from "./asset-registry-read-facade.types";
import type { AssetValidationContext } from "./asset-validation-helpers";

export interface AssetRegistryReadFacadeDependencies {
  readonly definitionRepository: AssetDefinitionRepositoryPort;
  readonly instanceRepository: AssetInstanceRepositoryPort;
  readonly compositionRepository: AssetCompositionRepositoryPort;
  readonly bindingRepository?: AssetBindingRepositoryPort;
  readonly resourceBackedViewProvider?: AssetResourceBackedViewProvider;
  readonly maxListLimit?: number;
}

export class AssetRegistryReadFacadeError extends Error {
  public readonly code: "repository-read-failed" | "resource-backed-view-provider-failed";

  public constructor(code: AssetRegistryReadFacadeError["code"], message = "Asset registry read failed.") {
    super(message);
    this.name = "AssetRegistryReadFacadeError";
    this.code = code;
  }
}

const DEFAULT_LIST_LIMIT = 100;
const ABSOLUTE_MAX_LIST_LIMIT = 250;
const FORBIDDEN_METADATA_KEY_PATTERN = /(token|secret|password|credential|authorization|auth|localpath|filesystempath|filepath|path|cache|bytes|blob|contentbase64|base64|raw|payload|command|stack|env)/i;
const LOCAL_PATH_VALUE_PATTERN = /(^\/tmp\/|^\/var\/|^\/home\/|^\/Users\/|^[a-z]:\\|^~\/|\\Users\\|\\Temp\\)/i;
const AUTH_BEARING_VALUE_PATTERN = /(bearer\s+[a-z0-9._-]+|api[_-]?key\s*[=:]|token=|password=|secret=|authorization:)/i;
const LONG_BASE64_VALUE_PATTERN = /^[A-Za-z0-9+/]{80,}={0,2}$/;

const builtInDefinitionKeys = new Set(
  BUILT_IN_ASSET_DEFINITION_CATALOG.map((seed) => definitionKey(String(seed.definition.definitionId), String(seed.definition.version))),
);
const builtInDefinitionIds = new Set(BUILT_IN_ASSET_DEFINITION_CATALOG.map((seed) => String(seed.definition.definitionId)));

export class AssetRegistryReadFacade {
  private readonly maxListLimit: number;

  public constructor(private readonly dependencies: AssetRegistryReadFacadeDependencies) {
    this.maxListLimit = Math.min(Math.max(1, dependencies.maxListLimit ?? DEFAULT_LIST_LIMIT), ABSOLUTE_MAX_LIST_LIMIT);
  }

  public async listDefinitionCards(query: AssetRegistryListQuery = {}): Promise<AssetRegistryListResult<AssetDefinitionCard>> {
    const limit = this.safeLimit(query.limit);
    const list = await this.readRepository(() => this.dependencies.definitionRepository.listDefinitions({ limit, cursor: query.cursor }), "repository-read-failed");
    const cards = list.definitions
      .map((definition) => this.toDefinitionCard(definition, query))
      .filter((card): card is AssetDefinitionCard => Boolean(card))
      .filter((card) => this.matchesDefinitionQuery(card, query));
    return this.toListResult(cards, limit, list.nextCursor, this.cursorDiagnostics(query));
  }

  public async readDefinitionDetail(ref: AssetReference, options: AssetRegistryReadOptions = {}): Promise<AssetDefinitionDetail | undefined> {
    const definition = await this.readRepository(() => this.dependencies.definitionRepository.getDefinition(ref), "repository-read-failed");
    if (!definition) return undefined;

    const detail: AssetDefinitionDetail = {
      definition: sanitizeDefinition(definition, options),
      ...(isBuiltInDefinition(definition) ? { builtIn: true } : {}),
      ...(options.includeValidation ? { validationSummary: sanitizeValue(validateAssetDefinition(definition)) as AssetDefinitionDetail["validationSummary"] } : {}),
    };
    return sanitizeValue(detail) as AssetDefinitionDetail;
  }

  public async listInstanceCards(query: AssetRegistryListQuery = {}): Promise<AssetRegistryListResult<AssetInstanceCard>> {
    const limit = this.safeLimit(query.limit);
    const list = await this.readRepository(() => this.dependencies.instanceRepository.listInstances({ limit, cursor: query.cursor }), "repository-read-failed");
    const cards = list.instances.map((instance) => this.toInstanceCard(instance, query)).filter((card) => this.matchesInstanceQuery(card, query));
    return this.toListResult(cards, limit, list.nextCursor, this.cursorDiagnostics(query));
  }

  public async readInstanceDetail(ref: AssetReference, options: AssetRegistryReadOptions = {}): Promise<AssetInstanceDetail | undefined> {
    const instance = await this.readRepository(() => this.dependencies.instanceRepository.getInstance(ref), "repository-read-failed");
    if (!instance) return undefined;

    const validationContext = options.includeValidation ? await this.validationContextForInstance(instance) : undefined;
    const detail: AssetInstanceDetail = {
      instance: sanitizeInstance(instance, options),
      ...(summarizeConfiguration(instance.selectedConfiguration) ? { configurationSummary: summarizeConfiguration(instance.selectedConfiguration) } : {}),
      ...(options.includeValidation ? { validationSummary: sanitizeValue(validateAssetInstance(instance, validationContext)) as AssetInstanceDetail["validationSummary"] } : {}),
    };
    return sanitizeValue(detail) as AssetInstanceDetail;
  }

  public async listCompositionCards(query: AssetRegistryListQuery = {}): Promise<AssetRegistryListResult<AssetCompositionCard>> {
    const limit = this.safeLimit(query.limit);
    const list = await this.readRepository(() => this.dependencies.compositionRepository.listCompositions({ limit, cursor: query.cursor }), "repository-read-failed");
    const cards = list.compositions.map((composition) => this.toCompositionCard(composition, query)).filter((card) => this.matchesCompositionQuery(card, query));
    return this.toListResult(cards, limit, list.nextCursor, this.cursorDiagnostics(query));
  }

  public async readCompositionDetail(ref: AssetReference, options: AssetRegistryReadOptions = {}): Promise<AssetCompositionDetail | undefined> {
    const composition = await this.readRepository(() => this.dependencies.compositionRepository.getComposition(ref), "repository-read-failed");
    if (!composition) return undefined;

    const resolvedBindings = await this.resolveBindings(composition);
    const validationContext = options.includeValidation ? await this.validationContextForComposition(composition, resolvedBindings) : undefined;
    const detail: AssetCompositionDetail = {
      composition: sanitizeComposition(composition, options),
      rootInstanceRefs: sanitizeValue(composition.rootInstanceRefs) as readonly AssetReference[],
      childInstanceRefs: sanitizeValue(composition.instanceRefs) as readonly AssetReference[],
      bindingRefs: sanitizeValue(composition.bindingRefs ?? []) as readonly AssetReference[],
      bindingSummaries: resolvedBindings.map(toBindingSummary),
      ...(options.includeValidation ? { validationSummary: sanitizeValue(validateAssetComposition(composition, validationContext)) as AssetCompositionDetail["validationSummary"] } : {}),
    };
    return sanitizeValue(detail) as AssetCompositionDetail;
  }

  public async listResourceBackedViewCards(query: AssetRegistryListQuery = {}): Promise<AssetRegistryListResult<AssetRegistryResourceBackedViewCard>> {
    if (!this.dependencies.resourceBackedViewProvider) {
      const diagnostics = this.cursorDiagnostics(query);
      return diagnostics?.length ? { items: [], diagnostics } : { items: [] };
    }
    const limit = this.safeLimit(query.limit);
    const providerQuery: AssetResourceBackedViewQuery = {
      searchText: query.searchText,
      assetTypes: query.assetTypes,
      assetFamilies: query.assetFamilies,
      lifecycleStatuses: query.lifecycleStatuses,
      limit,
      cursor: query.cursor,
    };
    const views = await this.readRepository(
      () => this.dependencies.resourceBackedViewProvider!.listResourceBackedViews(providerQuery),
      "resource-backed-view-provider-failed",
    );
    const cards = views.map((view) => this.toResourceBackedViewCard(view, query)).filter((card) => this.matchesResourceBackedViewQuery(card, query));
    return this.toListResult(cards, limit, undefined, this.cursorDiagnostics(query));
  }

  public async readResourceBackedViewDetail(viewId: string, options: AssetRegistryReadOptions = {}): Promise<AssetRegistryResourceBackedViewDetail | undefined> {
    if (!this.dependencies.resourceBackedViewProvider) return undefined;
    const view = await this.readRepository(
      () => this.dependencies.resourceBackedViewProvider!.readResourceBackedView(viewId),
      "resource-backed-view-provider-failed",
    );
    if (!view) return undefined;
    const detail: AssetRegistryResourceBackedViewDetail = {
      view: sanitizeResourceBackedView(view, options),
      ...(options.includeValidation && view.validationSummary ? { validationSummary: sanitizeValue(view.validationSummary) as AssetRegistryResourceBackedViewDetail["validationSummary"] } : {}),
    };
    return sanitizeValue(detail) as AssetRegistryResourceBackedViewDetail;
  }

  private toDefinitionCard(definition: AssetDefinition, query: AssetRegistryListQuery): AssetDefinitionCard | undefined {
    const builtIn = isBuiltInDefinition(definition);
    if (query.includeBuiltIns === false && builtIn) return undefined;
    if (query.includeCustom === false && !builtIn) return undefined;
    return sanitizeValue({
      definitionRef: definitionRef(definition),
      definitionId: String(definition.definitionId),
      version: String(definition.version),
      assetType: definition.assetType,
      assetFamily: definition.assetFamily,
      displayName: definition.displayName,
      summary: definition.description,
      lifecycleStatus: definition.lifecycleStatus,
      ...(builtIn ? { builtIn: true } : {}),
      ...(query.includeMetadata ? { metadata: metadataOf(definition.metadata) } : {}),
    }) as AssetDefinitionCard;
  }

  private toInstanceCard(instance: AssetInstance, query: AssetRegistryListQuery): AssetInstanceCard {
    return sanitizeValue({
      instanceRef: instanceRef(instance),
      instanceId: String(instance.instanceId),
      definitionRef: instance.definitionRef,
      displayName: instance.displayName,
      lifecycleStatus: instance.lifecycleStatus,
      ...(summarizeConfiguration(instance.selectedConfiguration) ? { configurationSummary: summarizeConfiguration(instance.selectedConfiguration) } : {}),
      ...(instance.stateSummary ? { stateSummary: instance.stateSummary } : {}),
      ...(query.includeMetadata ? { metadata: metadataOf(instance.metadata) } : {}),
    }) as AssetInstanceCard;
  }

  private toCompositionCard(composition: AssetComposition, query: AssetRegistryListQuery): AssetCompositionCard {
    return sanitizeValue({
      compositionRef: compositionRef(composition),
      compositionId: String(composition.compositionId),
      compositionType: composition.compositionType,
      version: String(composition.version),
      displayName: composition.displayName,
      summary: composition.description,
      lifecycleStatus: composition.lifecycleStatus,
      rootInstanceCount: composition.rootInstanceRefs.length,
      instanceCount: composition.instanceRefs.length,
      bindingCount: (composition.bindingRefs?.length ?? 0) + (composition.bindings?.length ?? 0),
      ...(query.includeMetadata ? { metadata: metadataOf(composition.metadata) } : {}),
    }) as AssetCompositionCard;
  }

  private toResourceBackedViewCard(view: AssetResourceBackedView, query: AssetRegistryListQuery): AssetRegistryResourceBackedViewCard {
    return sanitizeValue({
      viewId: view.viewId,
      viewKind: view.viewKind,
      displayName: view.displayName,
      summary: view.summary,
      assetType: view.assetType,
      assetFamily: view.assetFamily,
      assetDefinitionRef: view.assetDefinitionRef,
      lifecycleStatus: view.lifecycleStatus,
      ...(query.includeMetadata ? { metadata: metadataOf(view.metadata) } : {}),
    }) as AssetRegistryResourceBackedViewCard;
  }

  private matchesDefinitionQuery(card: AssetDefinitionCard, query: AssetRegistryListQuery): boolean {
    return matchesCommon(card, query, [card.displayName, card.definitionId, card.summary, card.assetType, card.assetFamily]);
  }

  private matchesInstanceQuery(card: AssetInstanceCard, query: AssetRegistryListQuery): boolean {
    return matchesLifecycle(card.lifecycleStatus, query) && matchesSearch(query.searchText, [card.displayName, card.instanceId, card.definitionRef.id]);
  }

  private matchesCompositionQuery(card: AssetCompositionCard, query: AssetRegistryListQuery): boolean {
    return matchesLifecycle(card.lifecycleStatus, query) && matchesSearch(query.searchText, [card.displayName, card.compositionId, card.summary, card.compositionType]);
  }

  private matchesResourceBackedViewQuery(card: AssetRegistryResourceBackedViewCard, query: AssetRegistryListQuery): boolean {
    return matchesCommon(card, query, [card.displayName, card.viewId, card.summary, card.assetType, card.assetFamily, card.viewKind]);
  }

  private async validationContextForInstance(instance: AssetInstance): Promise<AssetValidationContext> {
    const definition = await this.readRepository(() => this.dependencies.definitionRepository.getDefinition(instance.definitionRef), "repository-read-failed");
    return definition ? { definitionsById: new Map([[String(definition.definitionId), definition]]) } : {};
  }

  private async validationContextForComposition(composition: AssetComposition, bindings: readonly AssetBinding[]): Promise<AssetValidationContext> {
    const instances = await Promise.all(composition.instanceRefs.map((ref) => this.readRepository(() => this.dependencies.instanceRepository.getInstance(ref), "repository-read-failed")));
    return {
      instancesById: new Map(instances.filter((item): item is AssetInstance => Boolean(item)).map((item) => [String(item.instanceId), item])),
      bindingsById: new Map(bindings.map((binding) => [String(binding.bindingId), binding])),
    };
  }

  private async resolveBindings(composition: AssetComposition): Promise<readonly AssetBinding[]> {
    const embedded = composition.bindings ?? [];
    if (!this.dependencies.bindingRepository || !composition.bindingRefs?.length) return embedded;
    const resolved = await Promise.all(composition.bindingRefs.map((ref) => this.readRepository(() => this.dependencies.bindingRepository!.getBinding(ref), "repository-read-failed")));
    return [...embedded, ...resolved.filter((binding): binding is AssetBinding => Boolean(binding))];
  }

  private safeLimit(limit: number | undefined): number {
    if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) return this.maxListLimit;
    return Math.min(Math.floor(limit), this.maxListLimit);
  }

  private toListResult<TCard>(items: readonly TCard[], limit: number, nextCursor?: string, diagnostics?: readonly AssetRegistryListDiagnostic[]): AssetRegistryListResult<TCard> {
    return sanitizeValue({ items: items.slice(0, limit), ...(nextCursor ? { nextCursor } : {}), ...(diagnostics?.length ? { diagnostics } : {}) }) as AssetRegistryListResult<TCard>;
  }

  private cursorDiagnostics(query: AssetRegistryListQuery): readonly AssetRegistryListDiagnostic[] | undefined {
    if (!query.cursor) return undefined;
    return [{ severity: "info", code: "cursor-passed-through", message: "Cursor pagination is passed through to repositories or providers before facade-side filtering." }];
  }

  private async readRepository<T>(operation: () => Promise<T>, code: AssetRegistryReadFacadeError["code"]): Promise<T> {
    try {
      return await operation();
    } catch {
      throw new AssetRegistryReadFacadeError(code);
    }
  }
}

function matchesCommon(
  card: { readonly assetType?: string; readonly assetFamily?: string; readonly lifecycleStatus?: string },
  query: AssetRegistryListQuery,
  textValues: readonly (string | undefined)[],
): boolean {
  return matchesAssetTypes(card.assetType, query) && matchesAssetFamilies(card.assetFamily, query) && matchesLifecycle(card.lifecycleStatus, query) && matchesSearch(query.searchText, textValues);
}

function matchesAssetTypes(assetType: string | undefined, query: AssetRegistryListQuery): boolean {
  return !query.assetTypes?.length || (assetType !== undefined && query.assetTypes.includes(assetType as never));
}

function matchesAssetFamilies(assetFamily: string | undefined, query: AssetRegistryListQuery): boolean {
  return !query.assetFamilies?.length || (assetFamily !== undefined && query.assetFamilies.includes(assetFamily as never));
}

function matchesLifecycle(lifecycleStatus: string | undefined, query: AssetRegistryListQuery): boolean {
  return !query.lifecycleStatuses?.length || (lifecycleStatus !== undefined && query.lifecycleStatuses.includes(lifecycleStatus as never));
}

function matchesSearch(searchText: string | undefined, values: readonly (string | undefined)[]): boolean {
  const needle = searchText?.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => value?.toLowerCase().includes(needle));
}

function definitionKey(id: string, version?: string): string {
  return `${id}@${version ?? ""}`;
}

function isBuiltInDefinition(definition: AssetDefinition): boolean {
  const metadata = definition.metadata as Record<string, unknown> | undefined;
  const marker = metadata?.builtInSeed;
  const markerRecord = isRecord(marker) ? marker : undefined;
  if (markerRecord?.managedBy === "asset-kernel" && typeof markerRecord.seedId === "string") return true;
  return builtInDefinitionKeys.has(definitionKey(String(definition.definitionId), String(definition.version))) || builtInDefinitionIds.has(String(definition.definitionId));
}

function definitionRef(definition: AssetDefinition): AssetReference {
  return { kind: "asset-definition-version", id: normalizeAssetId(String(definition.definitionId)), version: String(definition.version) };
}

function instanceRef(instance: AssetInstance): AssetReference {
  return { kind: "asset-instance", id: normalizeAssetId(String(instance.instanceId)) };
}

function compositionRef(composition: AssetComposition): AssetReference {
  return { kind: "asset-composition", id: normalizeAssetId(String(composition.compositionId)), version: String(composition.version) };
}

function bindingRef(binding: AssetBinding): AssetReference {
  return { kind: "asset-binding", id: normalizeAssetId(String(binding.bindingId)) };
}

function toBindingSummary(binding: AssetBinding): AssetBindingSummary {
  return sanitizeValue({
    bindingRef: bindingRef(binding),
    bindingId: String(binding.bindingId),
    bindingKind: binding.bindingKind,
    sourceRef: binding.sourceRef,
    targetRef: binding.targetRef,
    lifecycleStatus: binding.lifecycleStatus,
  }) as AssetBindingSummary;
}

function summarizeConfiguration(values: unknown): AssetConfigurationSummary | undefined {
  if (!isRecord(values)) return undefined;
  const ids = Object.keys(values).filter((key) => typeof sanitizeJsonValue(values[key]) !== "undefined").sort();
  return { configuredFieldCount: ids.length, configuredFieldIds: ids };
}

function sanitizeDefinition(definition: AssetDefinition, options: AssetRegistryReadOptions): AssetDefinition {
  return sanitizeValue({
    definitionId: definition.definitionId,
    assetType: definition.assetType,
    assetFamily: definition.assetFamily,
    version: definition.version,
    displayName: definition.displayName,
    description: definition.description,
    lifecycleStatus: definition.lifecycleStatus,
    reviewStatus: definition.reviewStatus,
    provenance: definition.provenance,
    defaultConfiguration: definition.defaultConfiguration,
    configurationExamples: definition.configurationExamples,
    compositionRuleRefs: definition.compositionRuleRefs,
    compositionRules: definition.compositionRules,
    dependencies: definition.dependencies,
    ...(options.includeConfigurationSchema ? { configurationSchema: definition.configurationSchema } : {}),
    ...(options.includeAiContext ? { aiContext: definition.aiContext } : {}),
    ...(options.includeRequirements ? { requirements: definition.requirements, requirementRefs: definition.requirementRefs } : {}),
    ...(options.includePorts ? { ports: definition.ports, portRefs: definition.portRefs } : {}),
    ...(options.includeMetadata ? { metadata: metadataOf(definition.metadata) } : {}),
  }) as AssetDefinition;
}

function sanitizeInstance(instance: AssetInstance, options: AssetRegistryReadOptions): AssetInstance {
  return sanitizeValue({
    instanceId: instance.instanceId,
    definitionRef: instance.definitionRef,
    displayName: instance.displayName,
    lifecycleStatus: instance.lifecycleStatus,
    reviewStatus: instance.reviewStatus,
    selectedConfiguration: instance.selectedConfiguration,
    bindingRefs: instance.bindingRefs,
    parentCompositionRef: instance.parentCompositionRef,
    resourceRefs: instance.resourceRefs,
    stateSummary: instance.stateSummary,
    provenance: instance.provenance,
    ...(options.includeMetadata ? { metadata: metadataOf(instance.metadata) } : {}),
  }) as AssetInstance;
}

function sanitizeComposition(composition: AssetComposition, options: AssetRegistryReadOptions): AssetComposition {
  return sanitizeValue({
    compositionId: composition.compositionId,
    compositionType: composition.compositionType,
    displayName: composition.displayName,
    description: composition.description,
    version: composition.version,
    lifecycleStatus: composition.lifecycleStatus,
    reviewStatus: composition.reviewStatus,
    rootInstanceRefs: composition.rootInstanceRefs,
    instanceRefs: composition.instanceRefs,
    bindingRefs: composition.bindingRefs,
    bindings: composition.bindings,
    compositionRules: composition.compositionRules,
    dependencies: composition.dependencies,
    provenance: composition.provenance,
    validationSummary: composition.validationSummary,
    ...(options.includeMetadata ? { metadata: metadataOf(composition.metadata) } : {}),
  }) as AssetComposition;
}

function sanitizeResourceBackedView(view: AssetResourceBackedView, options: AssetRegistryReadOptions): AssetResourceBackedView {
  return sanitizeValue({
    viewId: view.viewId,
    viewKind: view.viewKind,
    assetType: view.assetType,
    assetFamily: view.assetFamily,
    assetDefinitionRef: view.assetDefinitionRef,
    assetInstanceRef: view.assetInstanceRef,
    ...(options.includeResourceBackings ? { resourceBacking: view.resourceBacking, resourceBackedAsset: view.resourceBackedAsset } : {}),
    generatedOutput: view.generatedOutput,
    preview: view.preview,
    sourceRef: view.sourceRef,
    displayName: view.displayName,
    summary: view.summary,
    lifecycleStatus: view.lifecycleStatus,
    ...(options.includeValidation ? { validationSummary: view.validationSummary } : {}),
    ...(options.includeMetadata ? { metadata: metadataOf(view.metadata), diagnostics: view.diagnostics } : {}),
  }) as AssetResourceBackedView;
}

function metadataOf(metadata: AssetMetadata | undefined): AssetMetadata | undefined {
  const sanitized = sanitizeJsonValue(metadata);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) return undefined;
  if (Object.keys(sanitized).length === 0) return undefined;
  return sanitized as AssetMetadata;
}

function sanitizeValue(value: unknown): unknown {
  return sanitizeJsonValue(value);
}

function sanitizeJsonValue(value: unknown): AssetJsonValue | undefined {
  if (value === null || typeof value === "boolean") return value as AssetJsonValue;
  if (typeof value === "string") return sanitizeStringValue(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) return value.map(sanitizeJsonValue).filter((entry): entry is AssetJsonValue => typeof entry !== "undefined");
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .filter(([key]) => !FORBIDDEN_METADATA_KEY_PATTERN.test(key))
      .map(([key, entry]) => [key, sanitizeJsonValue(entry)] as const)
      .filter((entry): entry is readonly [string, AssetJsonValue] => typeof entry[1] !== "undefined");
    return Object.fromEntries(entries) as AssetJsonObject;
  }
  return undefined;
}

function sanitizeStringValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (LOCAL_PATH_VALUE_PATTERN.test(trimmed)) return undefined;
  if (AUTH_BEARING_VALUE_PATTERN.test(trimmed)) return undefined;
  if (trimmed.startsWith("data:") && trimmed.includes(";base64,")) return undefined;
  if (LONG_BASE64_VALUE_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
