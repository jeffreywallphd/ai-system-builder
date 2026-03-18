import type { IModel } from "../../domain/models/interfaces/IModel";
import { Model, ModelArtifact, ModelSource } from "../../domain/models/Model";
import type {
  IModelInstallProgress,
  IModelInstallResult,
  IModelInstaller,
} from "../ports/interfaces/IModelInstaller";
import type { IInstalledModelCatalog } from "../ports/interfaces/IInstalledModelCatalog";
import type { IRemoteModelCatalog } from "../ports/interfaces/IRemoteModelCatalog";

export interface IInstallModelRequest {
  readonly model?: IModel;
  readonly remoteId?: string;
  readonly provider?: string;
  readonly destination: string;
  readonly overwrite?: boolean;
  readonly verifyIntegrity?: boolean;
  readonly authToken?: string;
  readonly registerInstalled?: boolean;
}

export interface IInstallModelResult {
  readonly model: IModel;
  readonly installResult: IModelInstallResult;
}

export class InstallModelUseCase {
  private readonly modelInstaller: IModelInstaller;
  private readonly installedModelCatalog: IInstalledModelCatalog;
  private readonly remoteModelCatalog?: IRemoteModelCatalog;

  constructor(params: {
    modelInstaller: IModelInstaller;
    installedModelCatalog: IInstalledModelCatalog;
    remoteModelCatalog?: IRemoteModelCatalog;
  }) {
    this.modelInstaller = params.modelInstaller;
    this.installedModelCatalog = params.installedModelCatalog;
    this.remoteModelCatalog = params.remoteModelCatalog;
  }

  public async execute(
    request: IInstallModelRequest,
    onProgress?: (progress: IModelInstallProgress) => void
  ): Promise<IInstallModelResult> {
    const model = await this.resolveModel(request);

    const installResult = await this.modelInstaller.install(
      {
        model,
        destination: request.destination,
        overwrite: request.overwrite,
        verifyIntegrity: request.verifyIntegrity,
        authToken: request.authToken,
        provider: request.provider,
      },
      onProgress
    );

    const installedModel = createInstalledModel(model, installResult);

    if ((request.registerInstalled ?? true) && installResult.status === "completed") {
      await this.installedModelCatalog.saveInstalled(installedModel);
    }

    return Object.freeze({
      model: installedModel,
      installResult,
    });
  }

  private async resolveModel(request: IInstallModelRequest): Promise<IModel> {
    if (request.model) {
      return request.model;
    }

    if (!request.remoteId?.trim()) {
      throw new Error(
        "InstallModelUseCase requires either a concrete model or a remoteId."
      );
    }

    if (!this.remoteModelCatalog) {
      throw new Error(
        "InstallModelUseCase cannot resolve remote IDs without a remote model catalog."
      );
    }

    const item = await this.remoteModelCatalog.getById(
      request.remoteId.trim(),
      request.provider
    );

    if (!item) {
      throw new Error(
        `Remote model '${request.remoteId.trim()}' could not be resolved.`
      );
    }

    return item.model;
  }
}

function createInstalledModel(
  model: IModel,
  installResult: IModelInstallResult
): IModel {
  const installedArtifactsBySource = new Map(
    (installResult.installedArtifacts ?? []).map((artifact) => [
      artifact.sourceLocation ?? artifact.name,
      artifact,
    ])
  );

  const installedPrimaryArtifact = createInstalledArtifact(
    model.artifact,
    installResult.installedLocation ?? installResult.destination,
    installedArtifactsBySource
  );

  return new Model({
    id: model.id,
    name: model.name,
    version: model.version,
    variant: model.variant,
    publisher: model.publisher,
    kind: model.kind,
    isRunnable: model.isRunnable,
    status: installResult.status === "completed" ? "installed" : model.status,
    source: new ModelSource({
      type: model.source.type,
      sourceId: model.source.sourceId,
      repository: model.source.repository,
      revision: model.source.revision,
      url: model.source.url,
      providerMetadata: model.source.providerMetadata,
    }),
    artifact: installedPrimaryArtifact,
    additionalArtifacts: model.additionalArtifacts.map((artifact) =>
      createInstalledArtifact(artifact, installResult.destination, installedArtifactsBySource)
    ),
    dependencies: model.dependencies,
    precision: model.precision,
    architectureFamily: model.architectureFamily,
    architecture: model.architecture,
    compatibility: model.compatibility,
    requirements: model.requirements,
    resourceProfile: model.resourceProfile,
    description: model.description,
    tags: model.tags,
    license: model.license,
    languageCodes: model.languageCodes,
    requiresAuth: model.requiresAuth,
  });
}

function createInstalledArtifact(
  artifact: IModel["artifact"],
  fallbackLocation: string,
  installedArtifactsBySource: ReadonlyMap<
    string,
    NonNullable<IModelInstallResult["installedArtifacts"]>[number]
  >
): ModelArtifact {
  const installedArtifact = installedArtifactsBySource.get(
    artifact.location ?? artifact.name
  );
  const installedLocation = installedArtifact?.installedLocation ?? fallbackLocation;

  return new ModelArtifact({
    name: artifact.name,
    accessMethod:
      installedLocation && installedLocation !== artifact.location
        ? "local-file"
        : artifact.accessMethod,
    location: installedLocation,
    format: artifact.format,
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.sha256,
    contentType: artifact.contentType,
  });
}
