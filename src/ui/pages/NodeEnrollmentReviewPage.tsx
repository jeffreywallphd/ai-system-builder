import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  NodeEnrollmentDetailDto,
  NodePendingEnrollmentSummaryDto,
} from "../../shared/contracts/nodes/NodeTrustApiContracts";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { NodeEnrollmentReviewService } from "../services/NodeEnrollmentReviewService";
import { IdentityAuthSessionStore } from "../shared/identity/IdentityAuthSessionStore";
import type { IdentityAuthSessionStore as IdentityAuthSessionStoreContract } from "../shared/identity/IdentityAuthSessionStore";

interface NodeEnrollmentReviewPageProps {
  readonly service?: NodeEnrollmentReviewService;
  readonly sessionStore?: IdentityAuthSessionStoreContract;
}

export default function NodeEnrollmentReviewPage(props: NodeEnrollmentReviewPageProps = {}): JSX.Element {
  const service = useMemo(() => props.service ?? new NodeEnrollmentReviewService(), [props.service]);
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;

  const [enrollments, setEnrollments] = useState<ReadonlyArray<NodePendingEnrollmentSummaryDto>>(Object.freeze([]));
  const [selectedRequestId, setSelectedRequestId] = useState<string>();
  const [selectedEnrollmentDetail, setSelectedEnrollmentDetail] = useState<NodeEnrollmentDetailDto>();
  const [decisionNote, setDecisionNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();

  const selectedEnrollment = enrollments.find((enrollment) => enrollment.requestId === selectedRequestId);

  const loadEnrollmentDetail = async (requestId: string): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    const response = await service.getNodeEnrollmentDetail({ requestId }, sessionToken);
    if (!response.ok || !response.data) {
      setSelectedEnrollmentDetail(undefined);
      setErrorMessage(response.error?.message ?? "Unable to load enrollment details.");
      return;
    }
    setSelectedEnrollmentDetail(response.data.enrollment);
  };

  const refresh = async (preferredRequestId?: string): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const pendingResponse = await service.listPendingNodeEnrollments({ limit: 200 }, sessionToken);
      if (!pendingResponse.ok || !pendingResponse.data) {
        setErrorMessage(pendingResponse.error?.message ?? "Unable to load pending enrollment requests.");
        return;
      }

      setEnrollments(pendingResponse.data.enrollments);
      const requestId = preferredRequestId
        ?? (selectedRequestId && pendingResponse.data.enrollments.some((entry) => entry.requestId === selectedRequestId)
          ? selectedRequestId
          : pendingResponse.data.enrollments[0]?.requestId);
      setSelectedRequestId(requestId);
      if (!requestId) {
        setSelectedEnrollmentDetail(undefined);
        return;
      }
      await loadEnrollmentDetail(requestId);
    } catch {
      setErrorMessage("Node enrollment review request failed.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    void refresh();
  }, [sessionToken]);

  const runMutation = async (action: () => Promise<void>): Promise<void> => {
    setIsMutating(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    try {
      await action();
    } finally {
      setIsMutating(false);
    }
  };

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-node-enrollment-review-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Node enrollment review</h1>
            <p className="ui-card__subtitle">
              Sign in with an authenticated admin account before reviewing pending node enrollment requests.
            </p>
          </div>
          <div className="ui-card__body">
            <Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-page ui-node-enrollment-review-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Node enrollment review</h1>
          <p className="ui-page__subtitle">
            Review pending compute and hybrid node enrollment requests, then approve or reject each request.
          </p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.settings}>Back to settings</Link>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            disabled={isLoading}
            onClick={() => { void refresh(); }}
          >
            Refresh
          </button>
        </div>
      </div>

      {errorMessage ? <p className="ui-node-enrollment-review-page__alert ui-node-enrollment-review-page__alert--error" role="alert">{errorMessage}</p> : null}
      {statusMessage ? <p className="ui-node-enrollment-review-page__alert ui-node-enrollment-review-page__alert--success" role="status">{statusMessage}</p> : null}

      <div className="ui-node-enrollment-review-page__grid">
        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Pending requests</h2>
          </div>
          <div className="ui-card__body">
            {isLoading && enrollments.length === 0 ? <p className="ui-text-secondary">Loading pending enrollment requests...</p> : null}
            {!isLoading && enrollments.length === 0 ? <p className="ui-text-secondary">No pending enrollment requests.</p> : null}
            {enrollments.length > 0 ? (
              <div className="ui-table-wrapper">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Node</th>
                      <th scope="col">Type</th>
                      <th scope="col">Capabilities</th>
                      <th scope="col">Tags</th>
                      <th scope="col">Requested</th>
                      <th scope="col">Trust status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((enrollment) => (
                      <tr
                        key={enrollment.requestId}
                        className={enrollment.requestId === selectedRequestId ? "ui-node-enrollment-review-page__table-row--selected" : undefined}
                      >
                        <td>
                          <button
                            type="button"
                            className="ui-button ui-button--ghost ui-button--sm ui-node-enrollment-review-page__select-button"
                            onClick={() => {
                              setSelectedRequestId(enrollment.requestId);
                              setErrorMessage(undefined);
                              void loadEnrollmentDetail(enrollment.requestId);
                            }}
                          >
                            {enrollment.displayName}
                          </button>
                          <div className="ui-text-secondary ui-text-small">{enrollment.nodeId}</div>
                        </td>
                        <td>{enrollment.nodeType}</td>
                        <td>{formatCapabilitySummary(enrollment)}</td>
                        <td>{formatDeploymentTags(enrollment.deploymentTags)}</td>
                        <td>{formatRequestedAt(enrollment.requestedAt)}</td>
                        <td>{formatTrustStatus(enrollment.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>

        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Review decision</h2>
          </div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            {!selectedEnrollment ? <p className="ui-text-secondary">Select a pending request to review details and take action.</p> : null}
            {selectedEnrollment ? (
              <>
                <div className="ui-node-enrollment-review-page__detail-grid">
                  <div>
                    <strong>Display name</strong>
                    <div className="ui-text-secondary">{selectedEnrollment.displayName}</div>
                  </div>
                  <div>
                    <strong>Node type</strong>
                    <div className="ui-text-secondary">{selectedEnrollment.nodeType}</div>
                  </div>
                  <div>
                    <strong>Trust status</strong>
                    <div className="ui-text-secondary">{formatTrustStatus(selectedEnrollment.status)}</div>
                  </div>
                  <div>
                    <strong>Request time</strong>
                    <div className="ui-text-secondary">{formatRequestedAt(selectedEnrollment.requestedAt)}</div>
                  </div>
                  <div>
                    <strong>Capabilities</strong>
                    <div className="ui-text-secondary">{formatCapabilitySummary(selectedEnrollment)}</div>
                  </div>
                  <div>
                    <strong>Deployment tags</strong>
                    <div className="ui-text-secondary">{formatDeploymentTags(selectedEnrollment.deploymentTags)}</div>
                  </div>
                </div>
                <label className="ui-field">
                  <span className="ui-field__label">Decision note</span>
                  <textarea
                    className="ui-textarea ui-node-enrollment-review-page__decision-note"
                    value={decisionNote}
                    onChange={(event) => setDecisionNote(event.target.value)}
                    placeholder="Optional note for audit and operators"
                  />
                </label>
                <div className="ui-page__actions">
                  <button
                    type="button"
                    className="ui-button ui-button--primary ui-button--sm"
                    disabled={isMutating}
                    onClick={() => {
                      if (!selectedRequestId) {
                        return;
                      }
                      void runMutation(async () => {
                        const response = await service.approveNodeEnrollment({
                          requestId: selectedRequestId,
                          decisionNote: decisionNote.trim() || undefined,
                        }, sessionToken);
                        if (!response.ok || !response.data) {
                          setErrorMessage(response.error?.message ?? "Unable to approve node enrollment.");
                          return;
                        }
                        setDecisionNote("");
                        setStatusMessage(`Approved "${response.data.enrollment.displayName}" (${response.data.node.trustState}).`);
                        await refresh();
                      });
                    }}
                  >
                    {isMutating ? "Approving..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--danger ui-button--sm"
                    disabled={isMutating}
                    onClick={() => {
                      if (!selectedRequestId) {
                        return;
                      }
                      void runMutation(async () => {
                        const response = await service.rejectNodeEnrollment({
                          requestId: selectedRequestId,
                          decisionNote: decisionNote.trim() || undefined,
                        }, sessionToken);
                        if (!response.ok || !response.data) {
                          setErrorMessage(response.error?.message ?? "Unable to reject node enrollment.");
                          return;
                        }
                        setDecisionNote("");
                        setStatusMessage(`Rejected "${response.data.enrollment.displayName}" (${response.data.node.trustState}).`);
                        await refresh();
                      });
                    }}
                  >
                    {isMutating ? "Rejecting..." : "Reject"}
                  </button>
                </div>
                {selectedEnrollmentDetail?.decisionNote ? (
                  <p className="ui-text-secondary ui-text-small">Latest decision note: {selectedEnrollmentDetail.decisionNote}</p>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function formatCapabilitySummary(
  enrollment: Pick<NodePendingEnrollmentSummaryDto, "capabilityProfile"> | Pick<NodeEnrollmentDetailDto, "capabilityProfile">,
): string {
  const capabilityList = enrollment.capabilityProfile.enabledCapabilities.join(", ");
  const scheduling = enrollment.capabilityProfile.supportsRemoteScheduling ? "remote scheduling enabled" : "remote scheduling disabled";
  if (!capabilityList) {
    return scheduling;
  }
  return `${capabilityList} (${scheduling})`;
}

function formatDeploymentTags(tags: ReadonlyArray<string>): string {
  if (tags.length === 0) {
    return "none";
  }
  return tags.join(", ");
}

function formatRequestedAt(requestedAt: string): string {
  const parsed = Date.parse(requestedAt);
  if (!Number.isFinite(parsed)) {
    return requestedAt;
  }
  return new Date(parsed).toLocaleString();
}

function formatTrustStatus(status: string): string {
  switch (status) {
    case "under-review":
      return "pending-enrollment (under review)";
    case "submitted":
      return "pending-enrollment (submitted)";
    case "approved":
      return "trusted (approved)";
    case "rejected":
      return "quarantined (rejected)";
    case "withdrawn":
      return "enrollment withdrawn";
    case "expired":
      return "enrollment expired";
    default:
      return status;
  }
}
