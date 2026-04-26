import type {
  ApplicationSettingDefinition,
  ApplicationSettingValue,
  SecretSettingValue,
  UpdateApplicationSettingRequest,
} from "../../../contracts/settings";
import type { ApplicationSecretsPort, ApplicationSettingsPort } from "../../ports/settings";

export interface UpdateSettingUseCaseDependencies {
  settings: ApplicationSettingsPort;
  secrets: ApplicationSecretsPort;
}

export class UpdateSettingUseCase {
  private readonly settings: ApplicationSettingsPort;
  private readonly secrets: ApplicationSecretsPort;

  public constructor(dependencies: UpdateSettingUseCaseDependencies) {
    this.settings = dependencies.settings;
    this.secrets = dependencies.secrets;
  }

  public async execute(request: UpdateApplicationSettingRequest): Promise<ApplicationSettingValue> {
    const definition = await this.getDefinition(request.key);
    if (definition?.valueKind === "secret") {
      const secretValue = request.value as SecretSettingValue | string;
      const rawSecret = typeof secretValue === "string" ? secretValue : secretValue.maskedValue;
      if (typeof rawSecret !== "string" || rawSecret.length === 0) {
        throw new Error(`Secret setting "${request.key}" requires a non-empty string value.`);
      }
      await this.secrets.setSecret(request.key, rawSecret);
      return {
        key: request.key,
        configured: true,
        masked: true,
        maskedValue: "********",
      };
    }

    return this.settings.updateValue(request);
  }

  private async getDefinition(key: string): Promise<ApplicationSettingDefinition | undefined> {
    const definitions = await this.settings.listDefinitions();
    return definitions.find((definition) => definition.key === key);
  }
}
