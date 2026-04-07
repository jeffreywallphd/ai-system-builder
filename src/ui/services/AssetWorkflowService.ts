import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import {
  HttpAssetWorkflowClient,
  type AssetWorkflowClient,
} from "../shared/assets/AssetWorkflowClient";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export class AssetWorkflowService {
  private readonly client: AssetWorkflowClient;

  public constructor(client: AssetWorkflowClient = createDefaultAssetWorkflowClient()) {
    this.client = client;
  }

  public listAssets: AssetWorkflowClient["listAssets"] = (request, sessionToken) => (
    this.client.listAssets(request, sessionToken)
  );

  public getAssetDetail: AssetWorkflowClient["getAssetDetail"] = (request, sessionToken) => (
    this.client.getAssetDetail(request, sessionToken)
  );

  public initiateUpload: AssetWorkflowClient["initiateUpload"] = (request, sessionToken) => (
    this.client.initiateUpload(request, sessionToken)
  );

  public authorizeDownload: AssetWorkflowClient["authorizeDownload"] = (request, sessionToken) => (
    this.client.authorizeDownload(request, sessionToken)
  );

  public resolvePreview: AssetWorkflowClient["resolvePreview"] = (request, sessionToken) => (
    this.client.resolvePreview(request, sessionToken)
  );
}

function createDefaultAssetWorkflowClient(): AssetWorkflowClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpAssetWorkflowClient(baseUrl);
}
