import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import {
  HttpStorageAdministrationClient,
  type StorageAdministrationClient,
} from "../shared/storage/StorageAdministrationClient";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export class StorageAdministrationService {
  private readonly client: StorageAdministrationClient;

  public constructor(client: StorageAdministrationClient = createDefaultStorageAdministrationClient()) {
    this.client = client;
  }

  public listStorageInstances: StorageAdministrationClient["listStorageInstances"] = (request, sessionToken) => (
    this.client.listStorageInstances(request, sessionToken)
  );

  public getStorageInstanceDetail: StorageAdministrationClient["getStorageInstanceDetail"] = (request, sessionToken) => (
    this.client.getStorageInstanceDetail(request, sessionToken)
  );

  public getStorageInstanceHealth: StorageAdministrationClient["getStorageInstanceHealth"] = (request, sessionToken) => (
    this.client.getStorageInstanceHealth(request, sessionToken)
  );
}

function createDefaultStorageAdministrationClient(): StorageAdministrationClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpStorageAdministrationClient(baseUrl);
}
