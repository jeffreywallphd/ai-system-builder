import type { IModel } from "@domain/models/interfaces/IModel";
import type { IInstalledModelCatalog } from "../ports/interfaces/IInstalledModelCatalog";
import type { IModelInstaller } from "../ports/interfaces/IModelInstaller";

export interface IRemoveModelRequest {
  readonly model?: IModel;
  readonly modelId?: string;
  readonly destination?: string;
  readonly removeArtifacts?: boolean;
  readonly unregisterOnly?: boolean;
}

export interface IRemoveModelResult {
  readonly removed: boolean;
  readonly modelId: string;
}

export class RemoveModelUseCase {
  private readonly installedModelCatalog: IInstalledModelCatalog;
  private readonly modelInstaller: IModelInstaller;

  constructor(params: {
    installedModelCatalog: IInstalledModelCatalog;
    modelInstaller: IModelInstaller;
  }) {
    this.installedModelCatalog = params.installedModelCatalog;
    this.modelInstaller = params.modelInstaller;
  }

  public async execute(request: IRemoveModelRequest): Promise<IRemoveModelResult> {
    const model = await this.resolveModel(request);

    if (!request.unregisterOnly) {
      if (!this.modelInstaller.canUninstall(model)) {
        throw new Error(`Model '${model.id}' cannot be uninstalled by the configured installer.`);
      }

      await this.modelInstaller.uninstall({
        model,
        destination: request.destination,
        removeArtifacts: request.removeArtifacts ?? true,
      });
    }

    const removed = await this.installedModelCatalog.removeInstalled(model.id);

    return Object.freeze({
      removed,
      modelId: model.id,
    });
  }

  private async resolveModel(request: IRemoveModelRequest): Promise<IModel> {
    if (request.model) {
      return request.model;
    }

    const modelId = request.modelId?.trim();

    if (!modelId) {
      throw new Error(
        "RemoveModelUseCase requires either a model or modelId."
      );
    }

    const installedModel = await this.installedModelCatalog.getInstalledById(modelId);

    if (!installedModel) {
      throw new Error(`Installed model '${modelId}' was not found.`);
    }

    return installedModel;
  }
}

