import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATHS } from "@ui/routes/RouteConfig";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import { SurfaceStatePanel } from "@ui/shared/components/presentation-state";
import { GovernanceAuditReviewPanels } from "@ui/shared/admin/GovernanceAuditReviewPanels";
import { GovernanceAuditQueryDefaults, normalizeGovernanceAuditQuery, type GovernanceAuditEventRecord, type GovernanceAuditReviewListQuery } from "@ui/shared/admin/GovernanceAuditReviewModel";
import { GovernanceAuditReviewService } from "@ui/services/GovernanceAuditReviewService";

interface GovernanceAuditReviewPageProps {
  readonly thin?: boolean;
  readonly service?: GovernanceAuditReviewService;
  readonly sessionStore?: IdentityAuthSessionStore;
}

export default function GovernanceAuditReviewPage(props: GovernanceAuditReviewPageProps = {}): JSX.Element {
  const service = useMemo(() => props.service ?? new GovernanceAuditReviewService(), [props.service]);
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const [session] = useState(() => sessionStore.getSession());
  const [query, setQuery] = useState<GovernanceAuditReviewListQuery>(() => normalizeGovernanceAuditQuery(Object.freeze({
    workspaceId: session?.workspaceContext?.resolvedWorkspaceId
      ?? session?.workspaceContext?.requestedWorkspaceId
      ?? session?.initialCapabilityState?.workspaceId,
    includeThinSafeOnly: props.thin ?? false,
    pagination: GovernanceAuditQueryDefaults.pagination,
    sorting: GovernanceAuditQueryDefaults.sorting,
  })));
  const [events, setEvents] = useState<ReadonlyArray<GovernanceAuditEventRecord>>(Object.freeze([]));
  const [totalCount, setTotalCount] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const sessionToken = session?.sessionToken;
  const actorUserIdentityId = session?.userIdentityId;

  const refresh = async (): Promise<void> => {
    if (!sessionToken || !actorUserIdentityId) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(undefined);
    const response = await service.listGovernanceAuditEvents({
      actorUserIdentityId,
      sessionToken,
      query,
    });
    if (!response.ok) {
      setEvents(Object.freeze([]));
      setTotalCount(0);
      setSelectedEventId(undefined);
      setErrorMessage(response.error.message);
      setIsLoading(false);
      return;
    }

    setEvents(response.data.events);
    setTotalCount(response.data.totalCount);
    const selectedPresent = response.data.events.some((event) => event.eventId === selectedEventId);
    setSelectedEventId(selectedPresent ? selectedEventId : response.data.events[0]?.eventId);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!sessionToken || !actorUserIdentityId) {
      return;
    }
    void refresh();
  }, [actorUserIdentityId, query, sessionToken]);

  if (!sessionToken || !actorUserIdentityId || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page">
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: props.thin ? "Governance review (thin)" : "Governance review",
            message: "Sign in with an authenticated administrative session before reviewing governance audit events.",
          })}
          action={<Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>}
        />
      </section>
    );
  }

  return (
    <section className="ui-page ui-governance-audit-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">{props.thin ? "Governance review (thin)" : "Governance review"}</h1>
          <p className="ui-page__subtitle">
            Inspect redacted security and operational governance events, including session, trust, node, sharing, and run-related posture changes.
          </p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.settings}>Back to settings</Link>
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" disabled={isLoading} onClick={() => { void refresh(); }}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {errorMessage ? <p className="ui-governance-audit-page__alert ui-governance-audit-page__alert--error" role="alert">{errorMessage}</p> : null}

      <GovernanceAuditReviewPanels
        mode={props.thin ? "thin" : "desktop"}
        query={query}
        events={events}
        totalCount={totalCount}
        selectedEventId={selectedEventId}
        isLoading={isLoading}
        onQueryChange={(nextQuery) => setQuery(normalizeGovernanceAuditQuery(Object.freeze({
          ...nextQuery,
          includeThinSafeOnly: props.thin ? true : nextQuery.includeThinSafeOnly,
        })))}
        onSelectEvent={setSelectedEventId}
      />
    </section>
  );
}
