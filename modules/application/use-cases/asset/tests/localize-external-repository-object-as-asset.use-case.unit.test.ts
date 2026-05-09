import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  AssetDefinition,
  AssetInstance,
  AssetReference,
  AssetResourceBackedView,
  LocalizeExternalRepositoryObjectCommand,
} from "../../../../contracts/asset";
import type {
  AssetDefinitionListQuery,
  AssetDefinitionRepositoryPort,
  AssetInstanceRepositoryPort,
  ExternalRepositoryObjectLocalizationPort,
  ExternalRepositoryObjectLocalizationRequest,
  ExternalRepositoryObjectLocalizationResult,
} from "../../../ports/asset";
import type { AssetRegistryReadOptions, AssetRegistryResourceBackedViewDetail } from "../../../services/asset";
import { AssetSourceIdentityService, BUILT_IN_ASSET_DEFINITIONS } from "../../../services/asset";
import { LocalizeExternalRepositoryObjectAsAssetUseCase } from "..";

class FakeDefinitionRepository implements AssetDefinitionRepositoryPort {
  public readonly definitions = new Map<string, AssetDefinition>();
  public getCalls = 0;
  public constructor(definitions: readonly AssetDefinition[] = BUILT_IN_ASSET_DEFINITIONS) {
    for (const definition of definitions) this.definitions.set(`${definition.definitionId}@${definition.version}`, definition);
  }
  public async saveDefinition(definition: AssetDefinition): Promise<AssetDefinition> { return definition; }
  public async getDefinition(reference: AssetReference): Promise<AssetDefinition | undefined> {
    this.getCalls += 1;
    return this.definitions.get(`${reference.id}@${reference.version ?? ""}`) ?? this.definitions.get(`${reference.id}@1.0.0`);
  }
  public async listDefinitions(_query?: AssetDefinitionListQuery) { return { definitions: [...this.definitions.values()] }; }
}

class FakeInstanceRepository implements AssetInstanceRepositoryPort {
  public readonly saved: AssetInstance[] = [];
  public instances: AssetInstance[] = [];
  public listCalls = 0;
  public async saveInstance(instance: AssetInstance): Promise<AssetInstance> {
    this.saved.push(instance);
    this.instances.push(instance);
    return instance;
  }
  public async getInstance(reference: AssetReference): Promise<AssetInstance | undefined> {
    return this.instances.find((instance) => String(instance.instanceId) === reference.id);
  }
  public async listInstances() {
    this.listCalls += 1;
    return { instances: this.instances };
  }
}

class FakeReadPort {
  public readonly readCalls: Array<{ viewId: string; options?: AssetRegistryReadOptions }> = [];
  public readonly details = new Map<string, AssetRegistryResourceBackedViewDetail>();
  public async readResourceBackedViewDetail(viewId: string, options?: AssetRegistryReadOptions): Promise<AssetRegistryResourceBackedViewDetail | undefined> {
    this.readCalls.push({ viewId, options });
    return this.details.get(viewId);
  }
}

class FakeExternalObjectPort implements ExternalRepositoryObjectLocalizationPort {
  public readonly calls: ExternalRepositoryObjectLocalizationRequest[] = [];
  public result: ExternalRepositoryObjectLocalizationResult = {
    ok: true,
    status: "localized",
    resultId: "localized.safe",
    internalResourceRefs: [{ kind: "artifact", id: "artifact.localized-safe" as AssetReference["id"] }],
    internalBackings: [{
      backingId: "artifact.localized-safe",
      resourceKind: "artifact",
      ref: { kind: "artifact", id: "artifact.localized-safe" as AssetReference["id"] },
      role: "primary",
    }],
    objectLabel: "Localized Safe",
    durableState: true,
  };
  public async processExternalRepositoryObject(request: ExternalRepositoryObjectLocalizationRequest): Promise<ExternalRepositoryObjectLocalizationResult> {
    this.calls.push(request);
    return this.result;
  }
}

class CountingSourceIdentityService extends AssetSourceIdentityService {
  public calls = 0;
  public override deriveFromResourceBackedView(view: AssetResourceBackedView) {
    this.calls += 1;
    return super.deriveFromResourceBackedView(view);
  }
}

function command(overrides: Partial<LocalizeExternalRepositoryObjectCommand> = {}): LocalizeExternalRepositoryObjectCommand {
  return {
    operation: "asset.localize-external-repository-object",
    viewId: "view.external",
    approval: {
      userConfirmed: true,
      confirmationKind: "localize-external-object",
      allowNetworkAccess: true,
      allowCredentialUse: true,
      allowFilesystemWrite: true,
      allowPartialCompletion: true,
    },
    actor: { initiatedBy: "human", actorRef: "user.1" },
    context: { idempotencyKey: "idem.1" },
    ...overrides,
  };
}

function externalView(overrides: Partial<AssetResourceBackedView> = {}): AssetResourceBackedView {
  return {
    viewId: "view.external",
    viewKind: "external-repository-object",
    assetType: "model",
    assetFamily: "resource-backed",
    sourceRef: { kind: "external-repository-object", id: "external.safe" as AssetReference["id"] },
    resourceBacking: {
      backingId: "external.safe",
      resourceKind: "external-repository-object",
      ref: { provider: "huggingface", repositoryId: "owner/repo", objectPath: "model.safetensors", objectKind: "model" },
      role: "source",
    },
    displayName: "External Model",
    metadata: { imported: false, localized: false, token: "secret" },
    ...overrides,
  };
}

function makeUseCase(read = new FakeReadPort(), instances = new FakeInstanceRepository(), port = new FakeExternalObjectPort()) {
  return {
    read,
    instances,
    port,
    useCase: new LocalizeExternalRepositoryObjectAsAssetUseCase({
      assetRegistryRead: read,
      externalObjectLocalizer: port,
      definitionRepository: new FakeDefinitionRepository(),
      instanceRepository: instances,
      now: () => "2026-05-08T12:00:00.000Z",
      generateInstanceId: () => `localized.${instances.saved.length + 1}`,
    }),
  };
}

describe("LocalizeExternalRepositoryObjectAsAssetUseCase", () => {
  it("localizes an eligible external object and registers a model AssetInstance", async () => {
    const read = new FakeReadPort();
    read.details.set("view.external", { view: externalView() });
    const { useCase, instances, port } = makeUseCase(read);

    const result = await useCase.execute(command());

    assert.equal(result.ok, true);
    assert.equal(result.status, "created");
    assert.equal(port.calls[0]?.operation, "localize");
    assert.equal(instances.saved[0]?.definitionRef.id, "builtin.model");
    assert.equal(instances.saved[0]?.metadata?.externalRepositoryObjectLocalization, true);
    assert.doesNotMatch(JSON.stringify({ result, request: port.calls[0] }), /secret|token|signedUrl|authHeader|localPath|C:\\|base64|bytes|blob|rawProvider/i);
  });

  it("requires localization-specific approval before source reads or port calls", async () => {
    const read = new FakeReadPort();
    read.details.set("view.external", { view: externalView() });
    const definitions = new FakeDefinitionRepository();
    const instances = new FakeInstanceRepository();
    const port = new FakeExternalObjectPort();
    const sourceIdentityService = new CountingSourceIdentityService();
    let generatedIds = 0;
    const useCase = new LocalizeExternalRepositoryObjectAsAssetUseCase({
      assetRegistryRead: read,
      externalObjectLocalizer: port,
      definitionRepository: definitions,
      instanceRepository: instances,
      sourceIdentityService,
      now: () => "2026-05-08T12:00:00.000Z",
      generateInstanceId: () => {
        generatedIds += 1;
        return `localized.${generatedIds}`;
      },
    });

    assert.equal((await useCase.execute(command({ approval: { userConfirmed: false, confirmationKind: "localize-external-object", allowNetworkAccess: true, allowCredentialUse: true, allowFilesystemWrite: true, allowPartialCompletion: true } }))).failure?.code, "approval-required");
    assert.equal((await useCase.execute(command({ approval: { userConfirmed: true, confirmationKind: "import-external-object", allowNetworkAccess: true, allowCredentialUse: true, allowFilesystemWrite: true, allowPartialCompletion: true } }))).failure?.code, "validation");
    assert.equal((await useCase.execute(command({ approval: { userConfirmed: true, confirmationKind: "localize-external-object", allowNetworkAccess: true, allowCredentialUse: true, allowPartialCompletion: true } }))).failure?.code, "permission");

    assert.equal(read.readCalls.length, 0);
    assert.equal(sourceIdentityService.calls, 0);
    assert.equal(instances.listCalls, 0);
    assert.equal(definitions.getCalls, 0);
    assert.equal(port.calls.length, 0);
    assert.equal(generatedIds, 0);
  });

  it("returns existing on duplicate retry without re-localizing", async () => {
    const read = new FakeReadPort();
    read.details.set("view.external", { view: externalView() });
    const { useCase, instances, port } = makeUseCase(read);

    assert.equal((await useCase.execute(command())).status, "created");
    assert.equal((await useCase.execute(command())).status, "existing");
    assert.equal(instances.saved.length, 1);
    assert.equal(port.calls.length, 1);
  });
});
