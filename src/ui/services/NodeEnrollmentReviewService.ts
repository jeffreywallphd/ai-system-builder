import { resolveDesktopIdentityApiBaseUrl } from "../desktop/identity/resolveDesktopIdentityApiBaseUrl";
import {
  HttpNodeEnrollmentReviewClient,
  type NodeEnrollmentReviewClient,
} from "../shared/nodes/NodeEnrollmentReviewClient";
import { resolveWebIdentityApiBaseUrl } from "../web/identity/resolveWebIdentityApiBaseUrl";

export class NodeEnrollmentReviewService {
  private readonly client: NodeEnrollmentReviewClient;

  public constructor(client: NodeEnrollmentReviewClient = createDefaultNodeEnrollmentReviewClient()) {
    this.client = client;
  }

  public listPendingNodeEnrollments: NodeEnrollmentReviewClient["listPendingNodeEnrollments"] = (request, sessionToken) => (
    this.client.listPendingNodeEnrollments(request, sessionToken)
  );

  public getNodeEnrollmentDetail: NodeEnrollmentReviewClient["getNodeEnrollmentDetail"] = (request, sessionToken) => (
    this.client.getNodeEnrollmentDetail(request, sessionToken)
  );

  public approveNodeEnrollment: NodeEnrollmentReviewClient["approveNodeEnrollment"] = (request, sessionToken) => (
    this.client.approveNodeEnrollment(request, sessionToken)
  );

  public rejectNodeEnrollment: NodeEnrollmentReviewClient["rejectNodeEnrollment"] = (request, sessionToken) => (
    this.client.rejectNodeEnrollment(request, sessionToken)
  );
}

function createDefaultNodeEnrollmentReviewClient(): NodeEnrollmentReviewClient {
  const desktopBaseUrl = resolveDesktopIdentityApiBaseUrl();
  const baseUrl = desktopBaseUrl ?? resolveWebIdentityApiBaseUrl();
  return new HttpNodeEnrollmentReviewClient(baseUrl);
}
