import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import {
  HttpNodeInventoryClient,
  type NodeInventoryClient,
} from "../shared/nodes/NodeInventoryClient";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export class NodeInventoryService {
  private readonly client: NodeInventoryClient;

  public constructor(client: NodeInventoryClient = createDefaultNodeInventoryClient()) {
    this.client = client;
  }

  public listNodeInventory: NodeInventoryClient["listNodeInventory"] = (request, sessionToken) => (
    this.client.listNodeInventory(request, sessionToken)
  );

  public getNodeInventoryDetail: NodeInventoryClient["getNodeInventoryDetail"] = (request, sessionToken) => (
    this.client.getNodeInventoryDetail(request, sessionToken)
  );

  public revokeNodeTrust: NodeInventoryClient["revokeNodeTrust"] = (request, sessionToken) => (
    this.client.revokeNodeTrust(request, sessionToken)
  );
}

function createDefaultNodeInventoryClient(): NodeInventoryClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpNodeInventoryClient(baseUrl);
}
