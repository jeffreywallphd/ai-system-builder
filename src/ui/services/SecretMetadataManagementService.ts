import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import {
  HttpSecretMetadataManagementClient,
  type SecretMetadataManagementClient,
} from "../shared/security/SecretMetadataManagementClient";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export class SecretMetadataManagementService {
  private readonly client: SecretMetadataManagementClient;

  public constructor(client: SecretMetadataManagementClient = createDefaultSecretMetadataManagementClient()) {
    this.client = client;
  }

  public createSecret: SecretMetadataManagementClient["createSecret"] = (request, sessionToken) => (
    this.client.createSecret(request, sessionToken)
  );

  public listSecrets: SecretMetadataManagementClient["listSecrets"] = (request, sessionToken) => (
    this.client.listSecrets(request, sessionToken)
  );

  public getSecret: SecretMetadataManagementClient["getSecret"] = (request, sessionToken) => (
    this.client.getSecret(request, sessionToken)
  );

  public rotateSecret: SecretMetadataManagementClient["rotateSecret"] = (request, sessionToken) => (
    this.client.rotateSecret(request, sessionToken)
  );

  public disableSecret: SecretMetadataManagementClient["disableSecret"] = (request, sessionToken) => (
    this.client.disableSecret(request, sessionToken)
  );
}

function createDefaultSecretMetadataManagementClient(): SecretMetadataManagementClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpSecretMetadataManagementClient(baseUrl);
}
