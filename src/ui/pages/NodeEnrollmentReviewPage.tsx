import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  NodeEnrollmentDetailDto,
  NodePendingEnrollmentSummaryDto,
} from "@shared/contracts/nodes/NodeTrustApiContracts";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { NodeEnrollmentReviewService } from "../services/NodeEnrollmentReviewService";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import type {
  IdentityAuthPersistedSession,
  IdentityAuthSessionStore as IdentityAuthSessionStoreContract,
} from "@shared/identity/IdentityAuthSessionStore";
import {
  SurfaceActionButtonStrip,
  createSurfaceActionContext,
  type SurfaceActionDescriptor,
} from "@ui/shared/actions";
import {
  NodeEnrollmentDecisionPanel,
  NodeEnrollmentPendingListPanel,
  type NodeAdministrationSurface,
} from "@ui/shared/nodes/NodeTrustAdministrationPanels";

interface NodeEnrollmentReviewPageProps {
  readonly service?: NodeEnrollmentReviewService;
  readonly sessionStore?: IdentityAuthSessionStoreContract;
}

export default function NodeEnrollmentReviewPage(props: NodeEnrollmentReviewPageProps = {}): JSX.Element {
  const navigate = useNavigate();
  const service = useMemo(() => props.service ?? new NodeEnrollmentReviewService(), [props.service]);
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const [session] = useState(() => sessionStore.getSession());
  const sessionToken = session?.sessionToken;

  const surface = useMemo<NodeAdministrationSurface>(
    () => (session?.sessionAccessChannel === "desktop" ? "desktop" : "thin-client"),
    [session?.sessionAccessChannel],
  );

  const [enrollments, setEnrollments] = useState<ReadonlyArray<NodePendingEnrollmentSummaryDto>>(Object.freeze([]));
  const [selectedRequestId, setSelectedRequestId] = useState<string>();
  const [selectedEnrollmentDetail, setSelectedEnrollmentDetail] = useState<NodeEnrollmentDetailDto>();
  const [decisionNote, setDecisionNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();

  const actorPermissionIds = useMemo(() => {
    const permissions = ["node.enrollment.view"];
    if (isNodeTrustAdminSession(session)) {
      permissions.push("node.enrollment.review");
    }
    return Object.freeze(permissions);
  }, [session]);

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

  const pageActions = useMemo<ReadonlyArray<SurfaceActionDescriptor>>(
    () => Object.freeze([
      {
        id: "node-enrollment-back-to-settings",
        label: "Back to settings",
        scope: "page",
        tone: "secondary",
        onInvoke: () => {
          navigate(ROUTE_PATHS.settings);
        },
      },
      {
        id: "node-enrollment-refresh",
        label: isLoading ? "Refreshing..." : "Refresh",
        scope: "page",
        tone: "secondary",
        availability: () => (isLoading
          ? Object.freeze({ disabled: true, disabledReason: "Pending request refresh is already running." })
          : Object.freeze({})),
        onInvoke: async () => {
          await refresh();
        },
      },
    ]),
    [isLoading, navigate],
  );

  const pageActionContext = useMemo(
    () => createSurfaceActionContext({
      actorPermissionIds,
      surface,
      surfaceCapabilities: Object.freeze(["inline-actions", "menu-actions", "confirmations"]),
      selection: Object.freeze({ selectedRequestId }),
      meta: Object.freeze({ isLoading }),
    }),
    [actorPermissionIds, isLoading, selectedRequestId, surface],
  );

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
        <SurfaceActionButtonStrip
          actions={pageActions}
          context={pageActionContext}
          scope="page"
          className="ui-page__actions"
        />
      </div>

      {errorMessage ? <p className="ui-node-enrollment-review-page__alert ui-node-enrollment-review-page__alert--error" role="alert">{errorMessage}</p> : null}
      {statusMessage ? <p className="ui-node-enrollment-review-page__alert ui-node-enrollment-review-page__alert--success" role="status">{statusMessage}</p> : null}

      <div className="ui-node-enrollment-review-page__grid">
        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Pending requests</h2>
          </div>
          <div className="ui-card__body">
            <NodeEnrollmentPendingListPanel
              surface={surface}
              enrollments={enrollments}
              selectedRequestId={selectedRequestId}
              isLoading={isLoading}
              actorPermissionIds={actorPermissionIds}
              onSelectEnrollment={async (requestId) => {
                setSelectedRequestId(requestId);
                setErrorMessage(undefined);
                await loadEnrollmentDetail(requestId);
              }}
            />
          </div>
        </section>

        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Review decision</h2>
          </div>
          <div className="ui-card__body ui-stack ui-stack--sm">
            <NodeEnrollmentDecisionPanel
              surface={surface}
              actorPermissionIds={actorPermissionIds}
              selectedEnrollment={selectedEnrollment}
              selectedEnrollmentDetail={selectedEnrollmentDetail}
              selectedRequestId={selectedRequestId}
              decisionNote={decisionNote}
              isMutating={isMutating}
              onDecisionNoteChange={setDecisionNote}
              onApprove={async () => {
                if (!selectedRequestId) {
                  return;
                }
                await runMutation(async () => {
                  const response = await service.approveNodeEnrollment({
                    requestId: selectedRequestId,
                    decisionNote: decisionNote.trim() || undefined,
                  }, sessionToken);
                  if (!response.ok || !response.data) {
                    setErrorMessage(response.error?.message ?? "Unable to approve node enrollment.");
                    return;
                  }
                  setDecisionNote("");
                  setStatusMessage(`Approved \"${response.data.enrollment.displayName}\" (${response.data.node.trustState}).`);
                  await refresh();
                });
              }}
              onReject={async () => {
                if (!selectedRequestId) {
                  return;
                }
                await runMutation(async () => {
                  const response = await service.rejectNodeEnrollment({
                    requestId: selectedRequestId,
                    decisionNote: decisionNote.trim() || undefined,
                  }, sessionToken);
                  if (!response.ok || !response.data) {
                    setErrorMessage(response.error?.message ?? "Unable to reject node enrollment.");
                    return;
                  }
                  setDecisionNote("");
                  setStatusMessage(`Rejected \"${response.data.enrollment.displayName}\" (${response.data.node.trustState}).`);
                  await refresh();
                });
              }}
            />
          </div>
        </section>
      </div>
    </section>
  );
}

function isNodeTrustAdminSession(session?: IdentityAuthPersistedSession): boolean {
  const workspaceId = session?.workspaceContext?.resolvedWorkspaceId ?? session?.workspaceContext?.requestedWorkspaceId;
  const workspaceRoles = workspaceId
    ? session?.workspaceContext?.workspaces.find((workspace) => workspace.workspaceId === workspaceId)?.effectiveRoles
    : undefined;
  const fallbackRoles = session?.initialCapabilityState?.effectiveRoles ?? Object.freeze([]);
  const roles = workspaceRoles ?? fallbackRoles;
  return roles.includes("owner") || roles.includes("admin");
}
