import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DeploymentPolicyValueKind } from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type {
  ApplyDeploymentPolicyOverrideOperationsRequest,
  UpdateDeploymentPolicyActiveProfileRequest,
} from "@shared/contracts/deployment/DeploymentPolicyWriteContracts";
import type {
  DeploymentPolicyFamilyId,
  DeploymentPolicySettingKey,
  DeploymentProfileId,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import { ROUTE_PATHS } from "@ui/routes/RouteConfig";
import { DeploymentPolicyAdministrationReadService } from "@ui/services/DeploymentPolicyAdministrationReadService";
import { DeploymentPolicyAdministrationWriteService } from "@ui/services/DeploymentPolicyAdministrationWriteService";
import {
  AdminReadonlyProperty,
  AdminSettingsField,
  AdminSettingsSection,
} from "@ui/shared/admin/AdminSettingsFormPrimitives";
import {
  toAdministrationStatusLabel,
  toControlModeLabel,
  type DeploymentPolicyAdministrationInspectionReadModel,
  type DeploymentPolicyEffectiveSettingReadModel,
} from "@ui/shared/admin/DeploymentPolicyAdministrationReadModel";
import { SurfaceStatePanel } from "@ui/shared/components/presentation-state";
import { IdentityAuthSessionStore } from "@ui/shared/identity/IdentityAuthSessionStore";

export interface DeploymentPolicyAdministrationPageProps {
  readonly service?: DeploymentPolicyAdministrationReadService;
  readonly writeService?: DeploymentPolicyAdministrationWriteService;
  readonly sessionStore?: IdentityAuthSessionStore;
}

type InspectionProfileSelector = "active" | "home" | "classroom" | "organization";

interface DeploymentPolicySettingOption {
  readonly id: string;
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
  readonly label: string;
}

interface DeploymentPolicyProfileChangeDraft {
  readonly profileId: DeploymentProfileId;
  readonly reason: string;
  readonly ticketReference: string;
  readonly dryRun: boolean;
  readonly confirmed: boolean;
}

interface DeploymentPolicyOverrideDraft {
  readonly profileId: DeploymentProfileId;
  readonly settingPath: string;
  readonly operation: "upsert" | "remove";
  readonly valueText: string;
  readonly valueBoolean: "true" | "false";
  readonly reason: string;
  readonly ticketReference: string;
  readonly dryRun: boolean;
  readonly confirmed: boolean;
}

export default function DeploymentPolicyAdministrationPage(
  props: DeploymentPolicyAdministrationPageProps = {},
): JSX.Element {
  const service = useMemo(
    () => props.service ?? new DeploymentPolicyAdministrationReadService(),
    [props.service],
  );
  const writeService = useMemo(
    () => props.writeService ?? new DeploymentPolicyAdministrationWriteService(),
    [props.writeService],
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

  const [selectedProfileId, setSelectedProfileId] = useState<InspectionProfileSelector>("active");
  const [inspection, setInspection] = useState<DeploymentPolicyAdministrationInspectionReadModel>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const [profileDraft, setProfileDraft] = useState<DeploymentPolicyProfileChangeDraft>(() => Object.freeze({
    profileId: "home",
    reason: "",
    ticketReference: "",
    dryRun: true,
    confirmed: false,
  }));
  const [overrideDraft, setOverrideDraft] = useState<DeploymentPolicyOverrideDraft>(() => Object.freeze({
    profileId: "home",
    settingPath: "",
    operation: "upsert",
    valueText: "",
    valueBoolean: "true",
    reason: "",
    ticketReference: "",
    dryRun: true,
    confirmed: false,
  }));

  const [profileMutationPending, setProfileMutationPending] = useState(false);
  const [profileMutationError, setProfileMutationError] = useState<string>();
  const [profileMutationValidationIssues, setProfileMutationValidationIssues] = useState<ReadonlyArray<string>>(Object.freeze([]));
  const [profileMutationResult, setProfileMutationResult] = useState<string>();

  const [overrideMutationPending, setOverrideMutationPending] = useState(false);
  const [overrideMutationError, setOverrideMutationError] = useState<string>();
  const [overrideMutationValidationIssues, setOverrideMutationValidationIssues] = useState<ReadonlyArray<string>>(Object.freeze([]));
  const [overrideMutationResult, setOverrideMutationResult] = useState<string>();

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

  const settingOptions = useMemo(
    () => buildSettingOptions(inspection, inspection?.canMutateRuntimeAdminOverrides ?? false),
    [inspection],
  );
  const selectedSetting = useMemo(
    () => resolveSelectedSetting(inspection, overrideDraft.settingPath),
    [inspection, overrideDraft.settingPath],
  );
  const canMutateActiveProfile = inspection?.canMutateActiveProfile ?? false;
  const canMutateOverrides = inspection?.canMutateOverrides ?? false;

  const ticketReferenceRequired = useMemo(
    () => isTicketReferenceRequired(inspection),
    [inspection],
  );
  const dryRunDefaultEnabled = useMemo(
    () => isDryRunDefaultEnabled(inspection),
    [inspection],
  );

  useEffect(() => {
    if (!inspection) {
      return;
    }

    const defaultProfile = inspection.requestedProfileId;
    setProfileDraft((current) => Object.freeze({
      ...current,
      profileId: defaultProfile,
      dryRun: dryRunDefaultEnabled,
    }));

    setOverrideDraft((current) => {
      const fallbackPath = current.settingPath && settingOptions.some((option) => option.id === current.settingPath)
        ? current.settingPath
        : settingOptions[0]?.id ?? "";
      return Object.freeze({
        ...current,
        profileId: defaultProfile,
        settingPath: fallbackPath,
        dryRun: dryRunDefaultEnabled,
      });
    });
  }, [dryRunDefaultEnabled, inspection, settingOptions]);

  const editableCount = inspection?.policyGroups
    .flatMap((group) => group.settings)
    .filter((setting) => setting.administrationStatus === "editable").length ?? 0;
  const inspectOnlyCount = inspection?.policyGroups
    .flatMap((group) => group.settings)
    .filter((setting) => setting.administrationStatus === "inspect-only").length ?? 0;
  const unsupportedCount = inspection?.policyGroups
    .flatMap((group) => group.settings)
    .filter((setting) => setting.administrationStatus === "unsupported").length ?? 0;

  const applyActiveProfileChange = async (): Promise<void> => {
    if (!inspection || !sessionToken || !actorUserIdentityId || !resolvedWorkspaceId) {
      return;
    }
    if (!canMutateActiveProfile) {
      setProfileMutationError("Your session can inspect policy state but cannot change the active deployment profile.");
      setProfileMutationValidationIssues(Object.freeze([]));
      setProfileMutationResult(undefined);
      return;
    }

    const validation = validateProfileChangeDraft({
      draft: profileDraft,
      ticketReferenceRequired,
    });

    if (!validation.ok) {
      setProfileMutationError(validation.message);
      setProfileMutationValidationIssues(Object.freeze([]));
      setProfileMutationResult(undefined);
      return;
    }

    setProfileMutationPending(true);
    setProfileMutationError(undefined);
    setProfileMutationValidationIssues(Object.freeze([]));
    setProfileMutationResult(undefined);

    const request: UpdateDeploymentPolicyActiveProfileRequest = Object.freeze({
      profileId: profileDraft.profileId,
      dryRun: profileDraft.dryRun,
      reason: normalizeOptional(profileDraft.reason),
      ticketReference: normalizeOptional(profileDraft.ticketReference),
    });

    const response = await writeService.updateActiveProfile({
      context: Object.freeze({
        actorUserIdentityId,
        sessionToken,
        workspaceId: resolvedWorkspaceId,
      }),
      request,
    });

    if (!response.ok) {
      setProfileMutationPending(false);
      setProfileMutationError(response.error.message);
      setProfileMutationValidationIssues(formatValidationIssues(response.error.validationIssues));
      return;
    }

    const dryRunLabel = response.data.result.dryRun ? "Dry-run completed" : "Update applied";
    setProfileMutationResult(`${dryRunLabel}: active profile request '${profileDraft.profileId}' validated for scope '${response.data.result.scope.scopeId}'.`);
    setProfileMutationPending(false);
    setProfileDraft((current) => Object.freeze({ ...current, confirmed: false }));
    void loadPolicyState();
  };

  const applyOverrideUpdate = async (): Promise<void> => {
    if (!inspection || !selectedSetting || !sessionToken || !actorUserIdentityId || !resolvedWorkspaceId) {
      return;
    }
    if (!canMutateOverrides) {
      setOverrideMutationError("Your session can inspect policy state but cannot apply deployment policy overrides.");
      setOverrideMutationValidationIssues(Object.freeze([]));
      setOverrideMutationResult(undefined);
      return;
    }

    const validation = validateOverrideDraft({
      draft: overrideDraft,
      selectedSetting,
      ticketReferenceRequired,
    });

    if (!validation.ok) {
      setOverrideMutationError(validation.message);
      setOverrideMutationValidationIssues(Object.freeze([]));
      setOverrideMutationResult(undefined);
      return;
    }

    const operation = overrideDraft.operation === "remove"
      ? Object.freeze({
        operation: "remove" as const,
        familyId: selectedSetting.familyId,
        settingKey: selectedSetting.settingKey,
        expectedControlMode: selectedSetting.controlMode,
      })
      : Object.freeze({
        operation: "upsert" as const,
        familyId: selectedSetting.familyId,
        settingKey: selectedSetting.settingKey,
        value: validation.value,
        valueType: selectedSetting.valueType,
        expectedControlMode: selectedSetting.controlMode,
      });

    const request: ApplyDeploymentPolicyOverrideOperationsRequest = Object.freeze({
      profileId: overrideDraft.profileId,
      dryRun: overrideDraft.dryRun,
      reason: normalizeOptional(overrideDraft.reason),
      ticketReference: normalizeOptional(overrideDraft.ticketReference),
      expectedRevision: selectedSetting.overrideRecord?.revision,
      operations: Object.freeze([operation]),
    });

    setOverrideMutationPending(true);
    setOverrideMutationError(undefined);
    setOverrideMutationValidationIssues(Object.freeze([]));
    setOverrideMutationResult(undefined);

    const response = await writeService.applyOverrideOperations({
      context: Object.freeze({
        actorUserIdentityId,
        sessionToken,
        workspaceId: resolvedWorkspaceId,
      }),
      request,
    });

    if (!response.ok) {
      setOverrideMutationPending(false);
      setOverrideMutationError(response.error.message);
      setOverrideMutationValidationIssues(formatValidationIssues(response.error.validationIssues));
      return;
    }

    const mutation = response.data.result.overrideMutations[0];
    const verb = overrideDraft.operation === "remove" ? "Remove" : "Upsert";
    const dryRunPrefix = response.data.result.dryRun ? "Dry-run" : "Applied";
    setOverrideMutationResult(
      `${dryRunPrefix} ${verb.toLowerCase()} override for '${selectedSetting.familyId}.${selectedSetting.settingKey}' (changed=${mutation?.changed ? "yes" : "no"}).`,
    );
    setOverrideMutationPending(false);
    setOverrideDraft((current) => Object.freeze({ ...current, confirmed: false }));
    void loadPolicyState();
  };

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
            Safely inspect and administer supported deployment-profile settings and policy overrides through authoritative, audited workflows.
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
        description="Choose whether to inspect the active profile or force a supported profile for comparison and update preparation."
        mode="read-only"
        scopeLabel={resolvedWorkspaceId}
        permissionLabel="deployment-policy.state.read"
      >
        <div className="ui-security-policy-page__grid">
          <AdminSettingsField label="Profile selector" hint="Active uses persisted profile selection for this workspace scope.">
            <select
              className="ui-select"
              value={selectedProfileId}
              onChange={(event) => setSelectedProfileId(event.target.value as InspectionProfileSelector)}
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
            permissionLabel="deployment-policy.state.read"
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
            title="Control support matrix"
            description="Clear separation between editable, inspect-only, and unsupported policy controls for this inspected profile."
            mode="read-only"
            scopeLabel={inspection.requestedProfileId}
            permissionLabel="deployment-policy.state.read"
          >
            <div className="ui-security-policy-page__property-grid">
              <AdminReadonlyProperty label="Editable controls" value={editableCount} />
              <AdminReadonlyProperty label="Inspect-only controls" value={inspectOnlyCount} />
              <AdminReadonlyProperty label="Unsupported controls" value={unsupportedCount} />
            </div>
            <p className="ui-text-secondary ui-text-small">
              Unsupported controls are intentionally non-interactive in this surface and require contract/feature expansion before administration workflows can mutate them.
            </p>
          </AdminSettingsSection>

          <AdminSettingsSection
            title="Active profile administration"
            description="Apply a supported active-profile change with explicit confirmation and optional dry-run validation."
            mode={canMutateActiveProfile ? "editable" : "read-only"}
            scopeLabel={inspection.workspaceId}
            permissionLabel="deployment-policy.profile.select"
          >
            {!canMutateActiveProfile ? (
              <p className="ui-text-secondary">
                This session is inspection-only for active profile selection. Use a workspace owner desktop session to apply profile changes.
              </p>
            ) : (
              <>
                <div className="ui-security-policy-page__grid">
              <AdminSettingsField label="Target active profile">
                <select
                  className="ui-select"
                  value={profileDraft.profileId}
                  onChange={(event) => setProfileDraft((current) => Object.freeze({
                    ...current,
                    profileId: event.target.value as DeploymentProfileId,
                  }))}
                >
                  <option value="home">home</option>
                  <option value="classroom">classroom</option>
                  <option value="organization">organization</option>
                </select>
              </AdminSettingsField>
              <AdminSettingsField label="Ticket reference" hint={ticketReferenceRequired ? "Required by active policy controls." : "Optional."}>
                <input
                  className="ui-input"
                  value={profileDraft.ticketReference}
                  onChange={(event) => setProfileDraft((current) => Object.freeze({ ...current, ticketReference: event.target.value }))}
                  placeholder="CHG-2044"
                />
              </AdminSettingsField>
              <AdminSettingsField label="Change reason" hint="Provide clear governance context for audit trails.">
                <input
                  className="ui-input"
                  value={profileDraft.reason}
                  onChange={(event) => setProfileDraft((current) => Object.freeze({ ...current, reason: event.target.value }))}
                  placeholder="Promote stricter approval defaults"
                />
              </AdminSettingsField>
              <AdminSettingsField label="Validation mode" hint="Dry-run validates and returns updated effective snapshot without persistence.">
                <select
                  className="ui-select"
                  value={profileDraft.dryRun ? "dry-run" : "apply"}
                  onChange={(event) => setProfileDraft((current) => Object.freeze({
                    ...current,
                    dryRun: event.target.value === "dry-run",
                  }))}
                >
                  <option value="dry-run">dry-run</option>
                  <option value="apply">apply</option>
                </select>
              </AdminSettingsField>
                </div>
                <label className="ui-checkbox-field">
              <input
                type="checkbox"
                checked={profileDraft.confirmed}
                onChange={(event) => setProfileDraft((current) => Object.freeze({ ...current, confirmed: event.target.checked }))}
              />
              <span>I understand this changes the active deployment-profile posture for the selected workspace scope.</span>
                </label>
                <p className="ui-text-secondary ui-text-small">
              Policy impact: this changes which preset lineage (`home`, `classroom`, `organization`) is used by default for policy evaluation and future override interpretation.
                </p>
                <div className="ui-page__actions">
              <button
                type="button"
                className="ui-button ui-button--primary ui-button--sm"
                disabled={profileMutationPending}
                onClick={() => { void applyActiveProfileChange(); }}
              >
                {profileMutationPending ? "Applying..." : "Apply profile change"}
              </button>
                </div>
              </>
            )}
            {profileMutationError ? <p className="ui-security-policy-page__alert ui-security-policy-page__alert--error" role="alert">{profileMutationError}</p> : null}
            {profileMutationValidationIssues.length > 0 ? (
              <ul className="ui-deployment-policy-admin-page__issue-list">
                {profileMutationValidationIssues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            ) : null}
            {profileMutationResult ? <p className="ui-deployment-policy-admin-page__result" role="status">{profileMutationResult}</p> : null}
          </AdminSettingsSection>

          <AdminSettingsSection
            title="Policy override administration"
            description="Update or remove supported overrides through authoritative typed operations only."
            mode={canMutateOverrides && settingOptions.length > 0 ? "editable" : "read-only"}
            scopeLabel={inspection.requestedProfileId}
            permissionLabel="deployment-policy.override.manage"
          >
            {!canMutateOverrides ? (
              <p className="ui-text-secondary">
                This session is inspection-only for override administration. Use a workspace owner desktop session to apply override mutations.
              </p>
            ) : settingOptions.length < 1 ? (
              <p className="ui-text-secondary">No editable controls are currently available in this profile snapshot.</p>
            ) : (
              <>
                <div className="ui-security-policy-page__grid">
                  <AdminSettingsField label="Target profile" hint="Profile that receives the override record.">
                    <select
                      className="ui-select"
                      value={overrideDraft.profileId}
                      onChange={(event) => setOverrideDraft((current) => Object.freeze({
                        ...current,
                        profileId: event.target.value as DeploymentProfileId,
                      }))}
                    >
                      <option value="home">home</option>
                      <option value="classroom">classroom</option>
                      <option value="organization">organization</option>
                    </select>
                  </AdminSettingsField>
                  <AdminSettingsField label="Editable policy setting">
                    <select
                      className="ui-select"
                      value={overrideDraft.settingPath}
                      onChange={(event) => setOverrideDraft((current) => Object.freeze({
                        ...current,
                        settingPath: event.target.value,
                      }))}
                    >
                      {settingOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </AdminSettingsField>
                  <AdminSettingsField label="Operation">
                    <select
                      className="ui-select"
                      value={overrideDraft.operation}
                      onChange={(event) => setOverrideDraft((current) => Object.freeze({
                        ...current,
                        operation: event.target.value as "upsert" | "remove",
                      }))}
                    >
                      <option value="upsert">upsert override</option>
                      <option value="remove">remove override</option>
                    </select>
                  </AdminSettingsField>

                  {selectedSetting && overrideDraft.operation === "upsert" && selectedSetting.valueType === "boolean" ? (
                    <AdminSettingsField label="Override value">
                      <select
                        className="ui-select"
                        value={overrideDraft.valueBoolean}
                        onChange={(event) => setOverrideDraft((current) => Object.freeze({
                          ...current,
                          valueBoolean: event.target.value as "true" | "false",
                        }))}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </AdminSettingsField>
                  ) : null}

                  {selectedSetting && overrideDraft.operation === "upsert" && selectedSetting.valueType !== "boolean" ? (
                    <AdminSettingsField label="Override value" hint={selectedSetting.validationRuleSummary}>
                      <input
                        className="ui-input"
                        type={selectedSetting.valueType === "number" ? "number" : "text"}
                        value={overrideDraft.valueText}
                        onChange={(event) => setOverrideDraft((current) => Object.freeze({
                          ...current,
                          valueText: event.target.value,
                        }))}
                        placeholder={selectedSetting.valueType === "number" ? "90" : "workspace"}
                      />
                    </AdminSettingsField>
                  ) : null}

                  <AdminSettingsField label="Ticket reference" hint={ticketReferenceRequired ? "Required by policy controls." : "Optional."}>
                    <input
                      className="ui-input"
                      value={overrideDraft.ticketReference}
                      onChange={(event) => setOverrideDraft((current) => Object.freeze({ ...current, ticketReference: event.target.value }))}
                      placeholder="CHG-2044"
                    />
                  </AdminSettingsField>

                  <AdminSettingsField label="Change reason">
                    <input
                      className="ui-input"
                      value={overrideDraft.reason}
                      onChange={(event) => setOverrideDraft((current) => Object.freeze({ ...current, reason: event.target.value }))}
                      placeholder="Align retention with audit posture"
                    />
                  </AdminSettingsField>

                  <AdminSettingsField label="Validation mode">
                    <select
                      className="ui-select"
                      value={overrideDraft.dryRun ? "dry-run" : "apply"}
                      onChange={(event) => setOverrideDraft((current) => Object.freeze({
                        ...current,
                        dryRun: event.target.value === "dry-run",
                      }))}
                    >
                      <option value="dry-run">dry-run</option>
                      <option value="apply">apply</option>
                    </select>
                  </AdminSettingsField>
                </div>

                {selectedSetting ? (
                  <p className="ui-text-secondary ui-text-small">
                    Policy impact: <strong>{selectedSetting.familyId}.{selectedSetting.settingKey}</strong> currently resolves to
                    {" "}<strong>{selectedSetting.effectiveValueDisplay}</strong> from <strong>{selectedSetting.sourceLabel}</strong>.
                    {overrideDraft.operation === "remove"
                      ? " Remove clears only persisted admin override state for this setting/profile."
                      : " Upsert writes a typed override value for this setting/profile."}
                  </p>
                ) : null}

                <label className="ui-checkbox-field">
                  <input
                    type="checkbox"
                    checked={overrideDraft.confirmed}
                    onChange={(event) => setOverrideDraft((current) => Object.freeze({ ...current, confirmed: event.target.checked }))}
                  />
                  <span>I understand this policy override operation is authoritative and auditable.</span>
                </label>

                <div className="ui-page__actions">
                  <button
                    type="button"
                    className="ui-button ui-button--primary ui-button--sm"
                    disabled={
                      overrideMutationPending
                      || (overrideDraft.operation === "remove" && !selectedSetting?.overrideRecord)
                    }
                    onClick={() => { void applyOverrideUpdate(); }}
                  >
                    {overrideMutationPending ? "Applying..." : "Apply override update"}
                  </button>
                  {overrideDraft.operation === "remove" && !selectedSetting?.overrideRecord ? (
                    <span className="ui-text-secondary ui-text-small">No existing admin override record to remove for this setting.</span>
                  ) : null}
                </div>
                {overrideMutationError ? <p className="ui-security-policy-page__alert ui-security-policy-page__alert--error" role="alert">{overrideMutationError}</p> : null}
                {overrideMutationValidationIssues.length > 0 ? (
                  <ul className="ui-deployment-policy-admin-page__issue-list">
                    {overrideMutationValidationIssues.map((issue) => <li key={issue}>{issue}</li>)}
                  </ul>
                ) : null}
                {overrideMutationResult ? <p className="ui-deployment-policy-admin-page__result" role="status">{overrideMutationResult}</p> : null}
              </>
            )}
          </AdminSettingsSection>

          <AdminSettingsSection
            title="Preset comparison"
            description="Compare supported built-in deployment profiles and identify which preset currently drives evaluation."
            mode="read-only"
            scopeLabel="supported profiles"
            permissionLabel="deployment-policy.state.read"
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
            description="Browse policy settings grouped by administration section and inspect effective value provenance with explicit control support state."
            mode="read-only"
            scopeLabel={inspection.requestedProfileId}
            permissionLabel="deployment-policy.state.read"
          >
            <div className="ui-stack ui-stack--md">
              {inspection.policyGroups.map((group) => (
                <section key={group.familyId} className="ui-card ui-deployment-policy-admin-page__group-card">
                  <div className="ui-card__header">
                    <h3 className="ui-card__title">{group.title}</h3>
                    <p className="ui-card__subtitle">{group.description}</p>
                    <p className="ui-text-secondary ui-text-small">
                      <strong>Current impact:</strong> {group.impactSummary}
                    </p>
                    {group.governanceSensitivity !== "standard" ? (
                      <p className="ui-security-policy-page__alert ui-security-policy-page__alert--warning" role="status">
                        <strong>{group.governanceSensitivity === "foundational" ? "Foundational policy family." : "Governance-sensitive family."}</strong>
                        {" "}{group.governanceWarning ?? "Changes can materially affect governance posture."}
                      </p>
                    ) : null}
                    {group.featureImpacts.length > 0 ? (
                      <div className="ui-stack ui-stack--2xs">
                        <span className="ui-text-secondary ui-text-small"><strong>Policy-controlled areas (currently supported):</strong></span>
                        <ul className="ui-deployment-policy-admin-page__impact-list">
                          {group.featureImpacts.map((impact) => (
                            <li key={impact.areaId}>
                              <strong>{impact.label}:</strong> {impact.currentBehavior}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
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
                            <th scope="col">Administration status</th>
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
                                <div className="ui-stack ui-stack--2xs">
                                  <span>{toAdministrationStatusLabel(setting.administrationStatus)}</span>
                                  <span className="ui-text-secondary ui-text-small">{setting.administrationStatusReason}</span>
                                </div>
                              </td>
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

export function validateProfileChangeDraft(input: {
  readonly draft: DeploymentPolicyProfileChangeDraft;
  readonly ticketReferenceRequired: boolean;
}):
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string } {
  if (!input.draft.confirmed) {
    return Object.freeze({ ok: false, message: "Confirm profile impact before applying this change." });
  }

  if (input.ticketReferenceRequired && !normalizeOptional(input.draft.ticketReference)) {
    return Object.freeze({ ok: false, message: "Ticket reference is required for this policy update." });
  }

  return Object.freeze({ ok: true });
}

export function validateOverrideDraft(input: {
  readonly draft: DeploymentPolicyOverrideDraft;
  readonly selectedSetting?: DeploymentPolicyEffectiveSettingReadModel;
  readonly ticketReferenceRequired: boolean;
}):
  | { readonly ok: true; readonly value?: string | number | boolean }
  | { readonly ok: false; readonly message: string } {
  if (!input.selectedSetting) {
    return Object.freeze({ ok: false, message: "Select an editable setting before applying an override operation." });
  }

  if (!input.draft.confirmed) {
    return Object.freeze({ ok: false, message: "Confirm override impact before applying this operation." });
  }

  if (input.ticketReferenceRequired && !normalizeOptional(input.draft.ticketReference)) {
    return Object.freeze({ ok: false, message: "Ticket reference is required for this policy update." });
  }

  if (input.draft.operation === "remove") {
    if (!input.selectedSetting.overrideRecord) {
      return Object.freeze({ ok: false, message: "Cannot remove override because no admin override record exists for this setting." });
    }
    return Object.freeze({ ok: true });
  }

  const parsedValue = parseOverrideValue(input.selectedSetting.valueType, input.draft.valueText, input.draft.valueBoolean);
  if (!parsedValue.ok) {
    return parsedValue;
  }

  return Object.freeze({
    ok: true,
    value: parsedValue.value,
  });
}

function parseOverrideValue(
  valueType: DeploymentPolicyValueKind,
  valueText: string,
  valueBoolean: "true" | "false",
):
  | { readonly ok: true; readonly value: string | number | boolean }
  | { readonly ok: false; readonly message: string } {
  if (valueType === "boolean") {
    return Object.freeze({ ok: true, value: valueBoolean === "true" });
  }

  if (valueType === "number") {
    const numericValue = Number(valueText);
    if (!Number.isFinite(numericValue)) {
      return Object.freeze({ ok: false, message: "Override value must be a finite number." });
    }
    return Object.freeze({ ok: true, value: numericValue });
  }

  return Object.freeze({ ok: true, value: valueText.trim() });
}

function resolveSelectedSetting(
  inspection: DeploymentPolicyAdministrationInspectionReadModel | undefined,
  settingPath: string,
): DeploymentPolicyEffectiveSettingReadModel | undefined {
  if (!inspection || !settingPath) {
    return undefined;
  }

  for (const group of inspection.policyGroups) {
    for (const setting of group.settings) {
      if (`${setting.familyId}.${setting.settingKey}` === settingPath) {
        return setting;
      }
    }
  }

  return undefined;
}

function buildSettingOptions(
  inspection: DeploymentPolicyAdministrationInspectionReadModel | undefined,
  includeRuntimeAdminControls: boolean,
): ReadonlyArray<DeploymentPolicySettingOption> {
  if (!inspection) {
    return Object.freeze([]);
  }

  const options: DeploymentPolicySettingOption[] = [];
  for (const group of inspection.policyGroups) {
    for (const setting of group.settings) {
      if (setting.administrationStatus !== "editable") {
        continue;
      }
      if (!includeRuntimeAdminControls && setting.controlMode === "runtime-admin") {
        continue;
      }

      const id = `${setting.familyId}.${setting.settingKey}`;
      options.push(Object.freeze({
        id,
        familyId: setting.familyId,
        settingKey: setting.settingKey,
        label: `${group.title} - ${setting.settingKey}`,
      }));
    }
  }

  return Object.freeze(options.sort((left, right) => left.label.localeCompare(right.label)));
}

function normalizeOptional(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function formatValidationIssues(
  issues: ReadonlyArray<{ readonly path: string; readonly message: string }>,
): ReadonlyArray<string> {
  if (issues.length < 1) {
    return Object.freeze([]);
  }

  return Object.freeze(issues.map((issue) => `${issue.path}: ${issue.message}`));
}

function isTicketReferenceRequired(inspection: DeploymentPolicyAdministrationInspectionReadModel | undefined): boolean {
  const setting = inspection?.policyGroups
    .find((group) => group.familyId === "admin-controls")
    ?.settings.find((entry) => entry.settingKey === "policyChangeRequiresTicketReference");

  return typeof setting?.effectiveValue === "boolean" ? setting.effectiveValue : true;
}

function isDryRunDefaultEnabled(inspection: DeploymentPolicyAdministrationInspectionReadModel | undefined): boolean {
  const setting = inspection?.policyGroups
    .find((group) => group.familyId === "admin-controls")
    ?.settings.find((entry) => entry.settingKey === "policyDryRunModeEnabledByDefault");

  return typeof setting?.effectiveValue === "boolean" ? setting.effectiveValue : true;
}
