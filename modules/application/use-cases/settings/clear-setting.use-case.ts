import type {
  ApplicationSettingDefinition,
  ApplicationSettingValue,
  ClearApplicationSettingRequest,
} from "../../../contracts/settings";
import type { ApplicationSecretsPort, ApplicationSettingsPort } from "../../ports/settings";

export interface ClearSettingUseCaseDependencies {
  settings: ApplicationSettingsPort;
  secrets: ApplicationSecretsPort;
}

export class ClearSettingUseCase {
  private readonly settings: ApplicationSettingsPort;
  private readonly secrets: ApplicationSecretsPort;

  public constructor(dependencies: ClearSettingUseCaseDependencies) {
    this.settings = dependencies.settings;
    this.secrets = dependencies.secrets;
  }

  public async execute(request: ClearApplicationSettingRequest): Promise<ApplicationSettingValue> {
    const definition = await this.getDefinition(request.key);
    if (definition?.valueKind === "secret") {
      await this.secrets.clearSecret(request.key);
      return {
        key: request.key,
        configured: false,
        masked: false,
      };
    }

    return this.settings.clearValue(request);
  }

  private async getDefinition(key: string): Promise<ApplicationSettingDefinition | undefined> {
    const definitions = await this.settings.listDefinitions();
    return definitions.find((definition) => definition.key === key);
  }
}
