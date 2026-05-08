import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type {
  AssetBinding,
  AssetComposition,
  AssetDefinition,
  AssetInstance,
  AssetReference,
  AssetResourceBackedView,
} from "../../../../contracts/asset";
import { normalizeAssetId } from "../../../../contracts/asset";
import type { ArtifactBrowseItem, ArtifactBrowseSuccessValue } from "../../../../contracts/artifact-browser";
import { createSuccessResult, type ContractResult } from "../../../../contracts/shared";
import type { ArtifactBrowserMetadataReadPort } from "../../../ports/artifact-browser";
import type {
  AssetBindingListQuery,
  AssetBindingRepositoryPort,
  AssetCompositionListQuery,
  AssetCompositionRepositoryPort,
  AssetDefinitionListQuery,
  AssetDefinitionRepositoryPort,
  AssetInstanceListQuery,
  AssetInstanceRepositoryPort,
  AssetResourceBackedViewProvider,
} from "../../../ports/asset";
import { BUILT_IN_ASSET_DEFINITION_CATALOG } from "../built-ins";
import { ArtifactResourceBackedViewProvider } from "../asset-artifact-resource-backed-view-provider.service";
import { AssetRegistryReadFacade, AssetRegistryReadFacadeError } from "../asset-registry-read-facade.service";

const definitionRef: AssetReference = { kind: "asset-definition-version", id: normalizeAssetId("definition.alpha"), version: "1.0.0" };
const instanceRef: AssetReference = { kind: "asset-instance", id: normalizeAssetId("instance.alpha") };
const compositionRef: AssetReference = { kind: "asset-composition", id: normalizeAssetId("composition.alpha"), version: "1.0.0" };
const bindingRef: AssetReference = { kind: "asset-binding", id: normalizeAssetId("binding.alpha") };

class FakeDefinitionRepository implements AssetDefinitionRepositoryPort {
  public readonly saved: AssetDefinition[] = [];
  public readonly deleted: AssetReference[] = [];
  public lastQuery?: AssetDefinitionListQuery;
  public failReads = false;
  private readonly definitions = new Map<string, AssetDefinition>();

  public constructor(definitions: readonly AssetDefinition[] = []) {
    for (const definition of definitions) this.definitions.set(definitionMapKey(definition), definition);
  }

  public async saveDefinition(definition: AssetDefinition): Promise<AssetDefinition> { this.saved.push(definition); this.definitions.set(definitionMapKey(definition), definition); return definition; }
  public async getDefinition(reference: AssetReference): Promise<AssetDefinition | undefined> { if (this.failReads) throw new Error("/tmp/provider secret token stack"); return this.definitions.get(`${reference.id}@${reference.version ?? ""}`) ?? this.definitions.get(`${reference.id}@1.0.0`) ?? this.definitions.get(reference.id); }
  public async listDefinitions(query?: AssetDefinitionListQuery) {
    if (this.failReads) throw new Error("/tmp/provider secret token stack");
    this.lastQuery = query;
    const definitions = [...this.definitions.values()]
      .filter((definition) => !query?.assetType || definition.assetType === query.assetType)
      .filter((definition) => !query?.assetFamily || definition.assetFamily === query.assetFamily)
      .filter((definition) => !query?.lifecycleStatus || definition.lifecycleStatus === query.lifecycleStatus)
      .filter((definition) => matchesTextQuery(query?.text, [definition.definitionId, definition.displayName, definition.description, definition.assetType, definition.assetFamily]));
    return { definitions: takeLimit(definitions, query?.limit), nextCursor: query?.cursor ? "next-definition" : undefined };
  }
  public async deleteDefinition(reference: AssetReference): Promise<void> { this.deleted.push(reference); }
}

class FakeInstanceRepository implements AssetInstanceRepositoryPort {
  public readonly saved: AssetInstance[] = [];
  public readonly deleted: AssetReference[] = [];
  public lastQuery?: AssetInstanceListQuery;
  private readonly instances = new Map<string, AssetInstance>();

  public constructor(instances: readonly AssetInstance[] = []) {
    for (const instance of instances) this.instances.set(String(instance.instanceId), instance);
  }

  public async saveInstance(instance: AssetInstance): Promise<AssetInstance> { this.saved.push(instance); this.instances.set(String(instance.instanceId), instance); return instance; }
  public async getInstance(reference: AssetReference): Promise<AssetInstance | undefined> { return this.instances.get(reference.id); }
  public async listInstances(query?: AssetInstanceListQuery) {
    this.lastQuery = query;
    const instances = [...this.instances.values()]
      .filter((instance) => !query?.lifecycleStatus || instance.lifecycleStatus === query.lifecycleStatus)
      .filter((instance) => matchesTextQuery(query?.text, [instance.instanceId, instance.displayName, instance.stateSummary?.summary]));
    return { instances: takeLimit(instances, query?.limit), nextCursor: query?.cursor ? "next-instance" : undefined };
  }
  public async deleteInstance(reference: AssetReference): Promise<void> { this.deleted.push(reference); }
}

class FakeCompositionRepository implements AssetCompositionRepositoryPort {
  public readonly saved: AssetComposition[] = [];
  public readonly deleted: AssetReference[] = [];
  public lastQuery?: AssetCompositionListQuery;
  private readonly compositions = new Map<string, AssetComposition>();

  public constructor(compositions: readonly AssetComposition[] = []) {
    for (const composition of compositions) this.compositions.set(String(composition.compositionId), composition);
  }

  public async saveComposition(composition: AssetComposition): Promise<AssetComposition> { this.saved.push(composition); this.compositions.set(String(composition.compositionId), composition); return composition; }
  public async getComposition(reference: AssetReference): Promise<AssetComposition | undefined> { return this.compositions.get(reference.id); }
  public async listCompositions(query?: AssetCompositionListQuery) {
    this.lastQuery = query;
    const compositions = [...this.compositions.values()]
      .filter((composition) => !query?.lifecycleStatus || composition.lifecycleStatus === query.lifecycleStatus)
      .filter((composition) => matchesTextQuery(query?.text, [composition.compositionId, composition.displayName, composition.description, composition.compositionType]));
    return { compositions: takeLimit(compositions, query?.limit), nextCursor: query?.cursor ? "next-composition" : undefined };
  }
  public async deleteComposition(reference: AssetReference): Promise<void> { this.deleted.push(reference); }
}

class FakeBindingRepository implements AssetBindingRepositoryPort {
  public readonly saved: AssetBinding[] = [];
  public readonly deleted: AssetReference[] = [];
  public lastQuery?: AssetBindingListQuery;
  private readonly bindings = new Map<string, AssetBinding>();

  public constructor(bindings: readonly AssetBinding[] = []) {
    for (const binding of bindings) this.bindings.set(String(binding.bindingId), binding);
  }

  public async saveBinding(binding: AssetBinding): Promise<AssetBinding> { this.saved.push(binding); this.bindings.set(String(binding.bindingId), binding); return binding; }
  public async getBinding(reference: AssetReference): Promise<AssetBinding | undefined> { return this.bindings.get(reference.id); }
  public async listBindings(query?: AssetBindingListQuery) { this.lastQuery = query; return { bindings: [...this.bindings.values()] }; }
  public async deleteBinding(reference: AssetReference): Promise<void> { this.deleted.push(reference); }
}

class FakeArtifactBrowserMetadataRead implements Pick<ArtifactBrowserMetadataReadPort, "browseArtifacts"> {
  public browseCalls = 0;
  public readContentCalls = 0;

  public constructor(private readonly items: readonly ArtifactBrowseItem[]) {}

  public async browseArtifacts(): Promise<ContractResult<ArtifactBrowseSuccessValue>> {
    this.browseCalls += 1;
    return createSuccessResult({ items: [...this.items] });
  }
}

function artifactItem(overrides: Partial<ArtifactBrowseItem> = {}): ArtifactBrowseItem {
  return {
    artifactId: "artifact-readme",
    storageKey: "uploads/private/readme.md",
    artifactFamily: "document",
    mediaType: "text/markdown",
    originalName: "Readme.md",
    sourceKind: "upload",
    metadata: unsafeMetadata(),
    ...overrides,
  };
}


function takeLimit<T>(values: readonly T[], limit: number | undefined): readonly T[] {
  return typeof limit === "number" && Number.isFinite(limit) ? values.slice(0, Math.max(0, Math.floor(limit))) : values;
}

function matchesTextQuery(text: string | undefined, values: readonly (string | undefined)[]): boolean {
  const needle = text?.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => value?.toLowerCase().includes(needle));
}

function definitionMapKey(definition: AssetDefinition): string {
  return `${definition.definitionId}@${definition.version ?? ""}`;
}

function createFacade(overrides: Partial<ConstructorParameters<typeof AssetRegistryReadFacade>[0]> = {}) {
  const definitionRepository = overrides.definitionRepository ?? new FakeDefinitionRepository([validDefinition()]);
  const instanceRepository = overrides.instanceRepository ?? new FakeInstanceRepository([validInstance()]);
  const compositionRepository = overrides.compositionRepository ?? new FakeCompositionRepository([validComposition()]);
  return new AssetRegistryReadFacade({ definitionRepository, instanceRepository, compositionRepository, ...overrides });
}

function validDefinition(overrides: Partial<AssetDefinition> = {}): AssetDefinition {
  return {
    definitionId: "definition.alpha",
    assetType: "tool",
    assetFamily: "behavioral",
    version: "1.0.0",
    displayName: "Alpha Tool",
    description: "Reusable alpha tool definition.",
    lifecycleStatus: "draft",
    reviewStatus: "unreviewed",
    provenance: { sourceKind: "human-authored" },
    configurationSchema: { schemaId: "definition.alpha.config", schemaVersion: "1.0.0", fields: [{ fieldId: "safeField", valueKind: "string", label: "Safe field" }] },
    requirements: [{ requirementId: "runtime.alpha", requirementKind: "runtime-capability", required: true, hostKind: "desktop-or-server", runtimeCapabilityId: "image-generation", permissionKind: "runtime-execution", safetyStatus: "requires-review" }],
    ports: [{ portId: "output", direction: "output", contract: { contractKind: "asset", assetType: "tool" } }],
    aiContext: { purpose: "Explain alpha safely.", userFacingSummary: "Alpha", developerFacingSummary: "Alpha developer summary.", capabilities: [{ summary: "Alpha" }], limitations: [{ summary: "No runtime execution." }], inputSummary: { summary: "Input" }, outputSummary: { summary: "Output" }, configurationGuidance: { summary: "Configure" }, compositionGuidance: { summary: "Compose" }, safetyNotes: [{ category: "operational", summary: "Safe", severity: "info" }] },
    metadata: unsafeMetadata(),
    ...overrides,
  };
}

function validInstance(overrides: Partial<AssetInstance> = {}): AssetInstance {
  return {
    instanceId: "instance.alpha",
    definitionRef,
    displayName: "Alpha Instance",
    lifecycleStatus: "draft",
    selectedConfiguration: { safeField: "visible", token: "token=super-secret", localPath: "/tmp/secret.txt" },
    stateSummary: { status: "ready", summary: "Safe state" },
    provenance: { sourceKind: "human-authored" },
    metadata: unsafeMetadata(),
    ...overrides,
  };
}

function validBinding(overrides: Partial<AssetBinding> = {}): AssetBinding {
  return {
    bindingId: "binding.alpha",
    bindingKind: "input",
    sourceRef: instanceRef,
    targetRef: definitionRef,
    lifecycleStatus: "draft",
    provenance: { sourceKind: "human-authored" },
    metadata: unsafeMetadata(),
    ...overrides,
  };
}

function validComposition(overrides: Partial<AssetComposition> = {}): AssetComposition {
  return {
    compositionId: "composition.alpha",
    compositionType: "feature",
    displayName: "Alpha Feature",
    description: "Feature composed from alpha instance.",
    version: "1.0.0",
    lifecycleStatus: "draft",
    rootInstanceRefs: [instanceRef],
    instanceRefs: [instanceRef],
    bindingRefs: [bindingRef],
    provenance: { sourceKind: "human-authored" },
    metadata: unsafeMetadata(),
    ...overrides,
  };
}

function unsafeMetadata() {
  return {
    safe: "visible",
    localPath: "/tmp/secret/file.txt",
    token: "bearer abcdef",
    password: "password=hidden",
    apiKey: "api_key=hidden",
    commandLine: "curl secret",
    stackTrace: "Error: boom\n at stack",
    rawPayload: { nestedSecret: "secret=hidden" },
    blobBytes: "AAAA",
    contentBase64: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ=",
    env: { SECRET_ENV: "hidden" },
  };
}

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

function assertSafe(value: unknown) {
  const output = serialized(value);
  for (const forbidden of ["/tmp/", "token", "secret", "password", "apikey", "api_key", "commandline", "stacktrace", "rawpayload", "blobbytes", "contentbase64", "secret_env", "bearer"]) {
    assert.equal(output.includes(forbidden), false, `serialized output included ${forbidden}: ${output}`);
  }
}

describe("AssetRegistryReadFacade definition reads", () => {
  it("lists definition cards from repository records and reads definition detail by reference", async () => {
    const facade = createFacade();
    const list = await facade.listDefinitionCards();
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0]?.definitionId, "definition.alpha");
    assert.equal(list.items[0]?.displayName, "Alpha Tool");
    assert.equal(list.items[0]?.metadata, undefined);

    const detail = await facade.readDefinitionDetail(definitionRef, { includeConfigurationSchema: true, includePorts: true, includeRequirements: true, includeAiContext: true });
    assert.equal(detail?.definition.definitionId, "definition.alpha");
    assert.ok(detail?.definition.configurationSchema);
    assert.ok(detail?.definition.ports);
    assert.ok(detail?.definition.requirements);
    assert.ok(detail?.definition.aiContext);
    assert.equal(await facade.readDefinitionDetail({ kind: "asset-definition", id: normalizeAssetId("missing") }), undefined);
  });

  it("filters definitions by search text, type, family, lifecycle, and built-in/custom flags", async () => {
    const builtInSeed = BUILT_IN_ASSET_DEFINITION_CATALOG[0]!;
    const builtIn = { ...builtInSeed.definition, metadata: { builtInSeed: { seedId: builtInSeed.seedId, seedVersion: builtInSeed.seedVersion, fingerprint: "abc", managedBy: "asset-kernel", lastSeededAt: "2026-01-01T00:00:00.000Z" } } };
    const repo = new FakeDefinitionRepository([
      validDefinition(),
      validDefinition({ definitionId: "definition.beta", assetType: "dataset", assetFamily: "resource-backed", displayName: "Beta Dataset", lifecycleStatus: "published" }),
      builtIn,
    ]);
    const facade = createFacade({ definitionRepository: repo });

    assert.deepEqual((await facade.listDefinitionCards({ searchText: "beta" })).items.map((item) => item.definitionId), ["definition.beta"]);
    assert.deepEqual((await facade.listDefinitionCards({ assetTypes: ["dataset"], assetFamilies: ["resource-backed"], lifecycleStatuses: ["published"] })).items.map((item) => item.definitionId), ["definition.beta"]);
    assert.equal((await facade.listDefinitionCards({ includeBuiltIns: true, includeCustom: false })).items[0]?.builtIn, true);
    assert.equal((await facade.listDefinitionCards({ includeBuiltIns: false })).items.some((item) => item.builtIn), false);
  });

  it("marks persisted built-ins without seeding or overwriting definitions", async () => {
    const builtInSeed = BUILT_IN_ASSET_DEFINITION_CATALOG[0]!;
    const persistedBuiltIn = { ...builtInSeed.definition };
    const repo = new FakeDefinitionRepository([persistedBuiltIn]);
    const facade = createFacade({ definitionRepository: repo });

    const list = await facade.listDefinitionCards();
    assert.equal(list.items[0]?.builtIn, true);
    assert.equal(repo.saved.length, 0);
    assert.equal(repo.deleted.length, 0);
  });


  it("marks built-ins only by exact definition version or valid seed marker", async () => {
    const seed = BUILT_IN_ASSET_DEFINITION_CATALOG[0]!;
    const exactBuiltIn = { ...seed.definition };
    const differentVersion = { ...seed.definition, version: "9.9.9", metadata: undefined };
    const validMarker = validDefinition({
      definitionId: "definition.marked",
      metadata: { builtInSeed: { managedBy: "asset-kernel", seedId: "seed.custom", seedVersion: "1.0.0", fingerprint: "abc123" } },
    });
    const malformedMarker = validDefinition({
      definitionId: "definition.malformed",
      metadata: { builtInSeed: { managedBy: "asset-kernel", seedId: "seed.custom" } },
    });

    const listFacade = createFacade({ definitionRepository: new FakeDefinitionRepository([exactBuiltIn, differentVersion, validMarker, malformedMarker]) });
    const cards = await listFacade.listDefinitionCards();
    const byId = new Map(cards.items.map((item) => [`${item.definitionId}@${item.version}`, item]));

    assert.equal(byId.get(`${seed.definition.definitionId}@${seed.definition.version}`)?.builtIn, true);
    assert.equal(byId.get(`${seed.definition.definitionId}@9.9.9`)?.builtIn, undefined);
    assert.equal(byId.get("definition.marked@1.0.0")?.builtIn, true);
    assert.equal(byId.get("definition.malformed@1.0.0")?.builtIn, undefined);

    const detailFacade = createFacade({ definitionRepository: new FakeDefinitionRepository([differentVersion]) });
    assert.equal((await detailFacade.readDefinitionDetail({ kind: "asset-definition-version", id: seed.definition.definitionId, version: "9.9.9" } as AssetReference))?.builtIn, undefined);
  });

  it("omits validation by default and includes validation only when requested", async () => {
    const facade = createFacade({ definitionRepository: new FakeDefinitionRepository([validDefinition({ displayName: "" })]) });
    assert.equal((await facade.readDefinitionDetail(definitionRef))?.validationSummary, undefined);
    assert.equal((await facade.readDefinitionDetail(definitionRef, { includeValidation: true }))?.validationSummary?.status, "invalid");
  });
});

describe("AssetRegistryReadFacade instance and composition reads", () => {
  it("lists and reads instance details with safe configuration summaries and opt-in validation", async () => {
    const facade = createFacade({ definitionRepository: new FakeDefinitionRepository([validDefinition()]), instanceRepository: new FakeInstanceRepository([validInstance({ definitionRef: { kind: "asset-instance", id: normalizeAssetId("wrong") } })]) });
    const card = (await facade.listInstanceCards()).items[0]!;
    assert.equal(card.instanceId, "instance.alpha");
    assert.deepEqual(card.configurationSummary?.configuredFieldIds, ["safeField"]);
    assertSafe(card);

    const defaultDetail = await facade.readInstanceDetail(instanceRef);
    assert.equal(defaultDetail?.validationSummary, undefined);
    assertSafe(defaultDetail);

    const validatedDetail = await facade.readInstanceDetail(instanceRef, { includeValidation: true });
    assert.equal(validatedDetail?.validationSummary?.status, "invalid");
  });

  it("lists and reads composition details with root, child, binding summaries and opt-in validation", async () => {
    const bindingRepository = new FakeBindingRepository([validBinding({ sourceRef: { kind: "asset-instance", id: normalizeAssetId("missing-source") } })]);
    const facade = createFacade({ bindingRepository, compositionRepository: new FakeCompositionRepository([validComposition({ rootInstanceRefs: [{ kind: "asset-instance", id: normalizeAssetId("missing-root") }] })]) });

    const card = (await facade.listCompositionCards()).items[0]!;
    assert.equal(card.compositionId, "composition.alpha");
    assert.equal(card.rootInstanceCount, 1);
    assert.equal(card.instanceCount, 1);
    assert.equal(card.bindingCount, 1);

    const defaultDetail = await facade.readCompositionDetail(compositionRef);
    assert.equal(defaultDetail?.validationSummary, undefined);
    assert.equal(defaultDetail?.rootInstanceRefs.length, 1);
    assert.equal(defaultDetail?.childInstanceRefs.length, 1);
    assert.equal(defaultDetail?.bindingSummaries[0]?.bindingId, "binding.alpha");

    const validatedDetail = await facade.readCompositionDetail(compositionRef, { includeValidation: true });
    assert.equal(validatedDetail?.validationSummary?.status, "invalid");
  });
});

describe("AssetRegistryReadFacade resource-backed view reads", () => {
  it("uses an injected provider for list/detail and preserves generated-output and external-object view kinds", async () => {
    const views: readonly AssetResourceBackedView[] = [
      { viewId: "view.generated", viewKind: "generated-output", displayName: "Generated", summary: "Generated output", metadata: unsafeMetadata(), generatedOutput: { outputId: "out", producedAssetType: "image", producedAt: "2026-01-01T00:00:00.000Z" } },
      { viewId: "view.external", viewKind: "external-repository-object", displayName: "External", summary: "External object", sourceRef: { kind: "external-repository-object", id: normalizeAssetId("external.one") } },
    ];
    const provider: AssetResourceBackedViewProvider = {
      async listResourceBackedViews() { return { items: views, nextCursor: "next-resource", diagnostics: [{ severity: "info", code: "provider-safe", message: "Provider returned safe resource-backed views.", providerId: "test-provider" }] }; },
      async readResourceBackedView(viewId) { return views.find((view) => view.viewId === viewId); },
    };
    const facade = createFacade({ resourceBackedViewProvider: provider });

    const list = await facade.listResourceBackedViewCards({ searchText: "generated", includeMetadata: true });
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0]?.viewKind, "generated-output");
    assert.equal(list.items[0]?.assetDefinitionRef, undefined);
    assert.equal(list.nextCursor, "next-resource");
    assert.equal(list.diagnostics?.some((diagnostic) => diagnostic.code === "provider-safe"), true);
    assertSafe(list);

    const detail = await facade.readResourceBackedViewDetail("view.external", { includeMetadata: true });
    assert.equal(detail?.view.viewKind, "external-repository-object");
    assert.equal(detail?.view.assetDefinitionRef, undefined);
  });

  it("returns empty/undefined without a provider and sanitizes provider errors", async () => {
    const noProviderFacade = createFacade();
    assert.deepEqual(await noProviderFacade.listResourceBackedViewCards(), { items: [] });
    assert.equal(await noProviderFacade.readResourceBackedViewDetail("missing"), undefined);

    const provider: AssetResourceBackedViewProvider = {
      async listResourceBackedViews() { throw new Error("/tmp/secret token stack"); },
      async readResourceBackedView() { throw new Error("/tmp/secret token stack"); },
    };
    const facade = createFacade({ resourceBackedViewProvider: provider });
    await assert.rejects(() => facade.listResourceBackedViewCards(), (error) => {
      assert.ok(error instanceof AssetRegistryReadFacadeError);
      assert.equal(error.code, "resource-backed-view-provider-failed");
      assertSafe(error);
      return true;
    });
  });

  it("lists and reads artifact/document provider cards and details without unsafe metadata or automatic validation", async () => {
    const browser = new FakeArtifactBrowserMetadataRead([
      artifactItem(),
      artifactItem({
        artifactId: "uploads/private/blob.bin",
        storageKey: "uploads/private/blob.bin",
        artifactFamily: "binary",
        mediaType: "application/octet-stream",
        originalName: "C:\\Users\\name\\blob.bin",
      }),
    ]);
    const provider = new ArtifactResourceBackedViewProvider({ artifactBrowserMetadataRead: browser });
    const facade = createFacade({ resourceBackedViewProvider: provider });

    const list = await facade.listResourceBackedViewCards({ includeMetadata: true, limit: 10 });
    assert.deepEqual(list.items.map((item) => item.viewKind), ["document", "artifact"]);
    assert.equal(list.items[0]?.assetDefinitionRef?.id, "builtin.document");
    assert.equal(list.items[1]?.displayName?.startsWith("artifact."), true);
    assertSafe(list);

    const detail = await facade.readResourceBackedViewDetail(list.items[0]!.viewId, { includeMetadata: true, includeResourceBackings: true });
    assert.equal(detail?.view.viewKind, "document");
    assert.equal(detail?.validationSummary, undefined);
    assert.equal(detail?.view.validationSummary, undefined);
    assertSafe(detail);

    assert.equal(await facade.readResourceBackedViewDetail("missing-artifact-view"), undefined);
    assert.equal(browser.readContentCalls, 0);
  });
});

describe("AssetRegistryReadFacade query, pagination, and boundaries", () => {
  it("respects bounded limits, preserves repository order, and documents cursor pass-through", async () => {
    const repo = new FakeDefinitionRepository([
      validDefinition({ definitionId: "definition.one", displayName: "One" }),
      validDefinition({ definitionId: "definition.two", displayName: "Two" }),
      validDefinition({ definitionId: "definition.three", displayName: "Three" }),
    ]);
    const facade = createFacade({ definitionRepository: repo, maxListLimit: 2 });
    const list = await facade.listDefinitionCards({ limit: 99, cursor: "cursor" });
    assert.deepEqual(list.items.map((item) => item.definitionId), ["definition.one", "definition.two"]);
    assert.equal(repo.lastQuery?.limit, 2);
    assert.equal(repo.lastQuery?.cursor, "cursor");
    assert.equal(list.nextCursor, "next-definition");
    assert.equal(list.diagnostics?.[0]?.code, "cursor-passed-through");
  });


  it("forwards supported repository filters for definitions, instances, and compositions", async () => {
    const definitions = new FakeDefinitionRepository([validDefinition()]);
    const instances = new FakeInstanceRepository([validInstance()]);
    const compositions = new FakeCompositionRepository([validComposition()]);
    const facade = createFacade({ definitionRepository: definitions, instanceRepository: instances, compositionRepository: compositions });

    await facade.listDefinitionCards({ searchText: " alpha ", assetTypes: ["tool"], assetFamilies: ["behavioral"], lifecycleStatuses: ["draft"], limit: 7, cursor: "cursor" });
    assert.deepEqual(definitions.lastQuery, { assetType: "tool", assetFamily: "behavioral", lifecycleStatus: "draft", text: "alpha", limit: 7, cursor: "cursor" });

    await facade.listInstanceCards({ searchText: "instance", lifecycleStatuses: ["draft"], limit: 5 });
    assert.deepEqual(instances.lastQuery, { lifecycleStatus: "draft", text: "instance", limit: 5, cursor: undefined });

    await facade.listCompositionCards({ searchText: "feature", lifecycleStatuses: ["draft"], limit: 6 });
    assert.deepEqual(compositions.lastQuery, { lifecycleStatus: "draft", text: "feature", limit: 6, cursor: undefined });
  });

  it("diagnoses multi-value facade-side filtering and fetches a bounded page before final limiting", async () => {
    const repo = new FakeDefinitionRepository([
      validDefinition({ definitionId: "definition.one", assetType: "dataset", displayName: "One" }),
      validDefinition({ definitionId: "definition.two", assetType: "tool", displayName: "Two" }),
      validDefinition({ definitionId: "definition.three", assetType: "dataset", displayName: "Three" }),
    ]);
    const facade = createFacade({ definitionRepository: repo, maxListLimit: 3 });

    const list = await facade.listDefinitionCards({ assetTypes: ["dataset", "tool"], limit: 1 });

    assert.equal(repo.lastQuery?.assetType, undefined);
    assert.equal(repo.lastQuery?.limit, 3);
    assert.deepEqual(list.items.map((item) => item.definitionId), ["definition.one"]);
    assert.equal(list.diagnostics?.some((diagnostic) => diagnostic.code === "facade-side-filtering"), true);
  });

  it("does not import adapters, hosts, transports, UI, runtime, filesystem, network, or provider clients", () => {
    const source = readFileSync("modules/application/services/asset/asset-registry-read-facade.service.ts", "utf8");
    for (const forbidden of [
      "modules/adapters",
      "adapters/",
      "modules/hosts",
      "hosts/",
      "contracts/api",
      "contracts/ipc",
      "electron",
      "express",
      "preload",
      "renderer",
      "thin-client",
      "runtime-readiness",
      "task-registry",
      "huggingface",
      "node:fs",
      "node:http",
      "node:https",
    ]) {
      assert.equal(source.includes(forbidden), false, `facade source imported or referenced ${forbidden}`);
    }
  });

  it("does not call save, update, delete, seeding, runtime readiness, or task registry seams", async () => {
    const definitions = new FakeDefinitionRepository([validDefinition()]);
    const instances = new FakeInstanceRepository([validInstance()]);
    const compositions = new FakeCompositionRepository([validComposition()]);
    const bindings = new FakeBindingRepository([validBinding()]);
    const facade = createFacade({ definitionRepository: definitions, instanceRepository: instances, compositionRepository: compositions, bindingRepository: bindings });

    await facade.listDefinitionCards();
    await facade.readDefinitionDetail(definitionRef);
    await facade.listInstanceCards();
    await facade.readInstanceDetail(instanceRef);
    await facade.listCompositionCards();
    await facade.readCompositionDetail(compositionRef);

    assert.equal(definitions.saved.length + instances.saved.length + compositions.saved.length + bindings.saved.length, 0);
    assert.equal(definitions.deleted.length + instances.deleted.length + compositions.deleted.length + bindings.deleted.length, 0);
  });


  it("uses the centralized Asset Kernel sanitizer without a second local forbidden-key regex", () => {
    const source = readFileSync("modules/application/services/asset/asset-registry-read-facade.service.ts", "utf8");
    assert.equal(source.includes("FORBIDDEN_METADATA_KEY_PATTERN"), false);
    assert.equal(source.includes("sanitizeAssetMetadata"), true);
  });

  it("sanitizes repository errors and serialized cards/details", async () => {
    const definitions = new FakeDefinitionRepository([validDefinition()]);
    const facade = createFacade({ definitionRepository: definitions });
    const card = await facade.listDefinitionCards({ includeMetadata: true });
    const detail = await facade.readDefinitionDetail(definitionRef, { includeMetadata: true });
    assertSafe(card);
    assertSafe(detail);

    definitions.failReads = true;
    await assert.rejects(() => facade.listDefinitionCards(), (error) => {
      assert.ok(error instanceof AssetRegistryReadFacadeError);
      assert.equal(error.code, "repository-read-failed");
      assertSafe(error);
      return true;
    });
  });
});
