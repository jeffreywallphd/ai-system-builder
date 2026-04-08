import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATHS } from "@ui/routes/RouteConfig";
import { DeploymentPolicyAdministrationReadService } from "@ui/services/DeploymentPolicyAdministrationReadService";
import {
  AdminReadonlyProperty,
  AdminSettingsField,
  AdminSettingsSection,
} from "@ui/shared/admin/AdminSettingsFormPrimitives";
import { toControlModeLabel, type DeploymentPolicyAdministrationInspectionReadModel } from "@ui/shared/admin/DeploymentPolicyAdministrationReadModel";
import { SurfaceStatePanel } from "@ui/shared/components/presentation-state";
import { IdentityAuthSessionStore } from "@ui/shared/identity/IdentityAuthSessionStore";

export interface DeploymentPolicyAdministrationPageProps {
  readonly service?: DeploymentPolicyAdministrationReadService;
  readonly sessionStore?: IdentityAuthSessionStore;
}

export default function DeploymentPolicyAdministrationPage(
  props: DeploymentPolicyAdministrationPageProps = {},
): JSX.Element {
  const service = useMemo(
    () => props.service ?? new DeploymentPolicyAdministrationReadService(),
    [props.service],
  );
  const sessionStore = useMemo(
    () => props.sessionStore ?? new IdentityAuthSessionStore(),
    [props.sessionStore],
  );
  const [session] = useState(() => sessionStore.getSession());

  const sessionToken = session?.sessionToken;
  const actorUserIdentityId = session?.userIdentityId;
  const resolvedWorkspaceId = session?.workspaceContext?.resolvedWorkspaceId
    ?? session?.workspaceContext?.requestedWorkspaceId
    ?? session?.initialCapabilityState?.workspaceId
    ?? "";

  const roleKeys = useMemo(() => {
    const workspaceId = resolvedWorkspaceId;
    const workspaceRoles = workspaceId
      ? session?.workspaceContext?.workspaces.find((workspace) => workspace.workspaceId === workspaceId)?.effectiveRoles
      : undefined;
    return workspaceRoles ?? session?.initialCapabilityState?.effectiveRoles ?? Object.freeze([]);
  }, [resolvedWorkspaceId, session?.initialCapabilityState?.effectiveRoles, session?.workspaceContext?.workspaces]);
  const canInspect = roleKeys.includes("owner") || roleKeys.includes("admin");

  const [selectedProfileId, setSelectedProfileId] = useState<"active" | "home" | "classroom" | "organization">("active");
  const [inspection, setInspection] = useState<DeploymentPolicyAdministrationInspectionReadModel>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const loadPolicyState = async (): Promise<void> => {
    if (!sessionToken || !actorUserIdentityId || !resolvedWorkspaceId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);

    const response = await service.readPolicyAdministrationState({
      actorUserIdentityId,
      sessionToken,
      request: Object.freeze({
        workspaceId: resolvedWorkspaceId,
        profileId: selectedProfileId === "active" ? undefined : selectedProfileId,
      }),
    });

    if (!response.ok) {
      setInspection(undefined);
      setErrorMessage(response.error.message);
      setIsLoading(false);
      return;
    }

    setInspection(response.data.inspection);
    setErrorMessage(undefined);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!sessionToken || !actorUserIdentityId || !resolvedWorkspaceId) {
      return;
    }
    void loadPolicyState();
  }, [actorUserIdentityId, resolvedWorkspaceId, selectedProfileId, sessionToken]);

  if (!sessionToken || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-deployment-policy-admin-page">
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: "Deployment profile and policy state",
            message: "Sign in with an authenticated administrative session before inspecting deployment profile policy state.",
          })}
          action={<Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>}
        />
      </section>
    );
  }

  if (!canInspect) {
    return (
      <section className="ui-page ui-deployment-policy-admin-page">
        <SurfaceStatePanel
          state={Object.freeze({
            kind: "permission-denied",
            title: "Deployment profile and policy state",
            message: "Only workspace owner/admin sessions can inspect deployment profile policy administration state.",
          })}
          action={<Link className="ui-button ui-button--secondary" to={ROUTE_PATHS.settings}>Back to settings</Link>}
        />
      </section>
    );
  }

  return (
    <section className="ui-page ui-deployment-policy-admin-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Deployment profile and policy state</h1>
          <p className="ui-page__subtitle">
            Inspect active deployment profile posture, compare supported presets, and review effective policy values with clear provenance.
          </p>
        </div>
        <div className="ui-page__actions">
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.settings}>Back to settings</Link>
          <Link className="ui-button ui-button--secondary ui-button--sm" to={ROUTE_PATHS.adminShell}>Desktop administration shell</Link>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            disabled={isLoading}
            onClick={() => { void loadPolicyState(); }}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <AdminSettingsSection
        title="Inspection scope"
        description="Choose whether to inspect the active profile or force a specific supported profile for comparison."
        mode="read-only"
        scopeLabel={resolvedWorkspaceId}
        permissionLabel="system.manage"
      >
        <div className="ui-security-policy-page__grid">
          <AdminSettingsField label="Profile selector" hint="Active uses the persisted profile selection for this workspace scope.">
            <select
              className="ui-select"
              value={selectedProfileId}
              onChange={(event) => setSelectedProfileId(event.target.value as typeof selectedProfileId)}
            >
              <option value="active">active (resolved)</option>
              <option value="home">home</option>
              <option value="classroom">classroom</option>
              <option value="organization">organization</option>
            </select>
          </AdminSettingsField>
        </div>
      </AdminSettingsSection>

      {errorMessage ? <p className="ui-security-policy-page__alert ui-security-policy-page__alert--error" role="alert">{errorMessage}</p> : null}

      {!inspection ? (
        <section className="ui-card">
          <div className="ui-card__body">
            <p className="ui-text-secondary">{isLoading ? "Loading deployment policy state..." : "No deployment policy state loaded yet."}</p>
          </div>
        </section>
      ) : (
        <>
          <AdminSettingsSection
            title="Effective profile summary"
            description="Understand the profile source and effective policy snapshot used for evaluation."
            mode="read-only"
            scopeLabel={inspection.workspaceId}
            permissionLabel="system.manage"
          >
            <div className="ui-security-policy-page__property-grid">
              <AdminReadonlyProperty label="Active profile" value={inspection.activeProfileId} />
              <AdminReadonlyProperty label="Requested profile" value={inspection.requestedProfileId} />
              <AdminReadonlyProperty label="Profile source" value={inspection.activeProfileSourceLabel} />
              <AdminReadonlyProperty label="Evaluated at" value={inspection.evaluatedAt} />
              <AdminReadonlyProperty label="Policy families" value={inspection.totalFamilyCount} />
              <AdminReadonlyProperty label="Policy settings" value={inspection.totalSettingCount} />
              <AdminReadonlyProperty label="Admin overrides" value={inspection.sourceBreakdown["admin-state"] ?? 0} />
              <AdminReadonlyProperty label="Preset defaults" value={inspection.sourceBreakdown["profile-preset"] ?? 0} />
              <AdminReadonlyProperty label="Policy defaults" value={inspection.sourceBreakdown["policy-default"] ?? 0} />
              <AdminReadonlyProperty label="Validation issues" value={inspection.validationIssueCount} />
            </div>
            <p className="ui-text-secondary ui-text-small">{inspection.activeProfileSummary}</p>
          </AdminSettingsSection>

          <AdminSettingsSection
            title="Preset comparison"
            description="Compare supported built-in deployment profiles and identify which preset currently drives evaluation."
            mode="read-only"
            scopeLabel="supported profiles"
            permissionLabel="system.manage"
          >
            <div className="ui-deployment-policy-admin-page__preset-grid">
              {inspection.presetComparisons.map((preset) => (
                <article
                  key={preset.profileId}
                  className={`ui-deployment-policy-admin-page__preset-card${preset.isRequestedProfile ? " ui-deployment-policy-admin-page__preset-card--requested" : ""}`}
                >
                  <h3 className="ui-card__title">{preset.profileId}</h3>
                  <p className="ui-card__subtitle">{preset.scopeLabel}</p>
                  <p className="ui-text-secondary ui-text-small">{preset.rationale}</p>
                  <p className="ui-text-secondary ui-text-small">Lineage: {preset.lineage.join(" -> ")}</p>
                  <div className="ui-admin-settings-section__badges">
                    {preset.isActiveProfile ? <span className="ui-admin-settings-badge">Active</span> : null}
                    {preset.isRequestedProfile ? <span className="ui-admin-settings-badge ui-admin-settings-badge--read-only">Inspected</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </AdminSettingsSection>

          <AdminSettingsSection
            title="Policy groups and effective values"
            description="Browse policy settings grouped by administration section and inspect effective value provenance without editing raw records."
            mode="read-only"
            scopeLabel={inspection.requestedProfileId}
            permissionLabel="system.manage"
          >
            <div className="ui-stack ui-stack--md">
              {inspection.policyGroups.map((group) => (
                <section key={group.familyId} className="ui-card ui-deployment-policy-admin-page__group-card">
                  <div className="ui-card__header">
                    <h3 className="ui-card__title">{group.title}</h3>
                    <p className="ui-card__subtitle">{group.description}</p>
                  </div>
                  <div className="ui-card__body">
                    <div className="ui-table-wrapper">
                      <table className="ui-table">
                        <thead>
                          <tr>
                            <th scope="col">Setting</th>
                            <th scope="col">Effective value</th>
                            <th scope="col">Source</th>
                            <th scope="col">Control mode</th>
                            <th scope="col">Provenance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.settings.map((setting) => (
                            <tr key={`${group.familyId}.${setting.settingKey}`}>
                              <td>
                                <div className="ui-stack ui-stack--2xs">
                                  <span><strong>{setting.settingKey}</strong></span>
                                  <span className="ui-text-secondary ui-text-small">{setting.description}</span>
                                  {setting.validationRuleSummary ? <span className="ui-text-secondary ui-text-small">{setting.validationRuleSummary}</span> : null}
                                </div>
                              </td>
                              <td>
                                <span>{setting.effectiveValueDisplay}</span>
                                <span className="ui-text-secondary ui-text-small"> ({setting.valueType})</span>
                              </td>
                              <td>{setting.sourceLabel}</td>
                              <td>{toControlModeLabel(setting.controlMode)}</td>
                              <td>
                                <span className="ui-text-secondary ui-text-small">{setting.provenanceSummary}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </AdminSettingsSection>
        </>
      )}
    </section>
  );
}
