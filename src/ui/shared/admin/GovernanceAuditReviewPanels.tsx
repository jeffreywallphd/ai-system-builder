import { GovernanceAuditEventOutcomes, GovernanceAuditEventTypes, GovernanceAuditSortBy, normalizeGovernanceAuditQuery, type GovernanceAuditEventOutcome, type GovernanceAuditEventRecord, type GovernanceAuditEventType, type GovernanceAuditReviewListQuery } from "./GovernanceAuditReviewModel";
import { redactGovernanceAuditDetails, redactGovernanceAuditValue } from "./GovernanceAuditRedaction";

export interface GovernanceAuditReviewPanelsProps {
  readonly mode: "desktop" | "thin";
  readonly query: GovernanceAuditReviewListQuery;
  readonly events: ReadonlyArray<GovernanceAuditEventRecord>;
  readonly totalCount: number;
  readonly selectedEventId?: string;
  readonly isLoading?: boolean;
  readonly onQueryChange: (query: GovernanceAuditReviewListQuery) => void;
  readonly onSelectEvent: (eventId: string) => void;
}

export function GovernanceAuditReviewPanels(props: GovernanceAuditReviewPanelsProps): JSX.Element {
  const normalizedQuery = normalizeGovernanceAuditQuery(props.query);
  const selectedEvent = props.events.find((event) => event.eventId === props.selectedEventId);
  const currentLimit = normalizedQuery.pagination?.limit ?? 25;
  const currentOffset = normalizedQuery.pagination?.offset ?? 0;
  const pageStart = props.totalCount < 1 ? 0 : currentOffset + 1;
  const pageEnd = Math.min(currentOffset + currentLimit, props.totalCount);
  const hasPrevious = currentOffset > 0;
  const hasNext = currentOffset + currentLimit < props.totalCount;

  return (
    <div className={`ui-governance-audit__grid ui-governance-audit__grid--${props.mode}`}>
      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Filters</h2>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          <div className="ui-governance-audit__filter-grid">
            <label className="ui-field">
              <span className="ui-field__label">Search</span>
              <input
                className="ui-input"
                value={normalizedQuery.search ?? ""}
                onChange={(event) => props.onQueryChange(Object.freeze({
                  ...normalizedQuery,
                  search: event.target.value,
                  pagination: Object.freeze({
                    ...normalizedQuery.pagination,
                    offset: 0,
                  }),
                }))}
                placeholder="Event text, actor, target"
              />
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Event type</span>
              <select
                className="ui-select"
                value={normalizedQuery.eventTypes?.[0] ?? ""}
                onChange={(event) => props.onQueryChange(Object.freeze({
                  ...normalizedQuery,
                  eventTypes: event.target.value
                    ? Object.freeze([event.target.value as GovernanceAuditEventType])
                    : undefined,
                  pagination: Object.freeze({
                    ...normalizedQuery.pagination,
                    offset: 0,
                  }),
                }))}
              >
                <option value="">All</option>
                {Object.values(GovernanceAuditEventTypes).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Outcome</span>
              <select
                className="ui-select"
                value={normalizedQuery.outcomes?.[0] ?? ""}
                onChange={(event) => props.onQueryChange(Object.freeze({
                  ...normalizedQuery,
                  outcomes: event.target.value
                    ? Object.freeze([event.target.value as GovernanceAuditEventOutcome])
                    : undefined,
                  pagination: Object.freeze({
                    ...normalizedQuery.pagination,
                    offset: 0,
                  }),
                }))}
              >
                <option value="">All</option>
                {Object.values(GovernanceAuditEventOutcomes).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Sort by</span>
              <select
                className="ui-select"
                value={normalizedQuery.sorting?.sortBy ?? GovernanceAuditSortBy.occurredAt}
                onChange={(event) => props.onQueryChange(Object.freeze({
                  ...normalizedQuery,
                  sorting: Object.freeze({
                    ...normalizedQuery.sorting,
                    sortBy: event.target.value,
                  }),
                }))}
              >
                <option value={GovernanceAuditSortBy.occurredAt}>Occurred at</option>
                <option value={GovernanceAuditSortBy.eventType}>Event type</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Sort direction</span>
              <select
                className="ui-select"
                value={normalizedQuery.sorting?.sortDirection ?? "desc"}
                onChange={(event) => props.onQueryChange(Object.freeze({
                  ...normalizedQuery,
                  sorting: Object.freeze({
                    ...normalizedQuery.sorting,
                    sortDirection: event.target.value === "asc" ? "asc" : "desc",
                  }),
                }))}
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </label>
            <label className="ui-field">
              <span className="ui-field__label">Page size</span>
              <select
                className="ui-select"
                value={String(currentLimit)}
                onChange={(event) => props.onQueryChange(Object.freeze({
                  ...normalizedQuery,
                  pagination: Object.freeze({
                    limit: Number.parseInt(event.target.value, 10),
                    offset: 0,
                  }),
                }))}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Events</h2>
          <p className="ui-card__subtitle">
            {props.totalCount < 1 ? "No events." : `Showing ${pageStart}-${pageEnd} of ${props.totalCount}`}
          </p>
        </div>
        <div className="ui-card__body ui-stack ui-stack--sm">
          {props.isLoading ? <p className="ui-text-secondary">Loading governance events...</p> : null}
          {!props.isLoading && props.events.length < 1 ? (
            <p className="ui-text-secondary">No governance events matched the current filters.</p>
          ) : null}
          {props.events.length > 0 ? (
            props.mode === "desktop"
              ? (
                <div className="ui-table-wrapper">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">Type</th>
                        <th scope="col">Summary</th>
                        <th scope="col">Outcome</th>
                        <th scope="col">Actor</th>
                        <th scope="col">Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {props.events.map((event) => (
                        <tr
                          key={event.eventId}
                          className={event.eventId === props.selectedEventId ? "ui-governance-audit__row--selected" : undefined}
                        >
                          <td>{formatDate(event.occurredAt)}</td>
                          <td>{event.eventType}</td>
                          <td>
                            <button
                              type="button"
                              className="ui-button ui-button--ghost ui-button--sm"
                              onClick={() => props.onSelectEvent(event.eventId)}
                            >
                              {event.summary}
                            </button>
                          </td>
                          <td><span className={`ui-badge ${outcomeBadgeClass(event.outcome)}`}>{event.outcome}</span></td>
                          <td>{event.actorId ? String(redactGovernanceAuditValue("actorId", event.actorId)) : "-"}</td>
                          <td>{event.targetRef ? String(redactGovernanceAuditValue("targetRef", event.targetRef)) : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
              : (
                <div className="ui-stack ui-stack--xs">
                  {props.events.map((event) => (
                    <button
                      key={event.eventId}
                      type="button"
                      className={`ui-governance-audit__event-card ${event.eventId === props.selectedEventId ? "ui-governance-audit__event-card--selected" : ""}`}
                      onClick={() => props.onSelectEvent(event.eventId)}
                    >
                      <strong>{event.summary}</strong>
                      <span className="ui-text-secondary ui-text-small">{event.eventType} | {formatDate(event.occurredAt)}</span>
                      <span className={`ui-badge ${outcomeBadgeClass(event.outcome)}`}>{event.outcome}</span>
                    </button>
                  ))}
                </div>
              )
          ) : null}

          <div className="ui-page__actions">
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              disabled={!hasPrevious}
              onClick={() => props.onQueryChange(Object.freeze({
                ...normalizedQuery,
                pagination: Object.freeze({
                  ...normalizedQuery.pagination,
                  offset: Math.max(currentOffset - currentLimit, 0),
                }),
              }))}
            >
              Previous
            </button>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              disabled={!hasNext}
              onClick={() => props.onQueryChange(Object.freeze({
                ...normalizedQuery,
                pagination: Object.freeze({
                  ...normalizedQuery.pagination,
                  offset: currentOffset + currentLimit,
                }),
              }))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="ui-card">
        <div className="ui-card__header">
          <h2 className="ui-card__title">Event detail</h2>
        </div>
        <div className="ui-card__body">
          {!selectedEvent ? <p className="ui-text-secondary">Select an event to inspect redacted details.</p> : (
            <div className="ui-stack ui-stack--sm">
              <div className="ui-meta-grid">
                <div className="ui-meta-item"><span className="ui-meta-label">Event</span><span className="ui-meta-value">{selectedEvent.eventType}</span></div>
                <div className="ui-meta-item"><span className="ui-meta-label">Occurred</span><span className="ui-meta-value">{formatDate(selectedEvent.occurredAt)}</span></div>
                <div className="ui-meta-item"><span className="ui-meta-label">Outcome</span><span className="ui-meta-value">{selectedEvent.outcome}</span></div>
                <div className="ui-meta-item"><span className="ui-meta-label">Workspace</span><span className="ui-meta-value">{selectedEvent.workspaceId ?? "-"}</span></div>
                <div className="ui-meta-item"><span className="ui-meta-label">Actor</span><span className="ui-meta-value">{selectedEvent.actorId ? String(redactGovernanceAuditValue("actorId", selectedEvent.actorId)) : "-"}</span></div>
                <div className="ui-meta-item"><span className="ui-meta-label">Target</span><span className="ui-meta-value">{selectedEvent.targetRef ? String(redactGovernanceAuditValue("targetRef", selectedEvent.targetRef)) : "-"}</span></div>
              </div>
              <div className="ui-table-wrapper">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(redactGovernanceAuditDetails(selectedEvent.details) ?? {}).map(([key, value]) => (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{formatDetailValue(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

function formatDetailValue(value: unknown): string {
  if (value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function outcomeBadgeClass(outcome: GovernanceAuditEventOutcome): string {
  switch (outcome) {
    case GovernanceAuditEventOutcomes.succeeded:
      return "ui-badge--success";
    case GovernanceAuditEventOutcomes.failed:
      return "ui-badge--danger";
    case GovernanceAuditEventOutcomes.denied:
    case GovernanceAuditEventOutcomes.rejected:
      return "ui-badge--warning";
    default:
      return "ui-badge--neutral";
  }
}
