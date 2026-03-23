import type { ModelCreationEnvironment } from "../../../domain/model-training/ModelCreationSupport";

export interface IModelCreationEnvironmentGateway {
  getEnvironment(): Promise<ModelCreationEnvironment>;
}
