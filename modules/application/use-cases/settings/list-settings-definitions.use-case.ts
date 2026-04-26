import type { ApplicationSettingDefinition } from "../../../contracts/settings";
import type { ApplicationSettingsPort } from "../../ports/settings";

export interface ListSettingsDefinitionsUseCaseDependencies {
  settings: ApplicationSettingsPort;
}

export class ListSettingsDefinitionsUseCase {
  private readonly settings: ApplicationSettingsPort;

  public constructor(dependencies: ListSettingsDefinitionsUseCaseDependencies) {
    this.settings = dependencies.settings;
  }

  public async execute(): Promise<ApplicationSettingDefinition[]> {
    return this.settings.listDefinitions();
  }
}
