import { useEffect, useState } from "react";

import type {
  AssetPackageInspectionSummary,
  AssetPackageRecord,
} from "../../../contracts/asset-package";
import { ApplicationIcon } from "../components/ApplicationIcon";
import { EmptyState } from "../components/EmptyState";
import { WorkflowSequence, WorkflowStep } from "../components/WorkflowSequence";

export type AssetPackageClientResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export interface AssetPackageClient {
  inspect(input: { readonly workspaceId: string; readonly bytes: Uint8Array }): Promise<AssetPackageClientResult<AssetPackageInspectionSummary>>;
  admit(input: {
    readonly workspaceId: string;
    readonly inspectionId: string;
    readonly packageDigest: string;
    readonly approvalScope: "workspace";
    readonly approvedCapabilities: readonly string[];
  }): Promise<AssetPackageClientResult<AssetPackageRecord>>;
  list(workspaceId: string): Promise<AssetPackageClientResult<readonly AssetPackageRecord[]>>;
  activate(input: { readonly workspaceId: string; readonly recordId: string }): Promise<AssetPackageClientResult<AssetPackageRecord>>;
  disable(input: { readonly workspaceId: string; readonly recordId: string }): Promise<AssetPackageClientResult<AssetPackageRecord>>;
  rollback(input: { readonly workspaceId: string; readonly recordId: string }): Promise<AssetPackageClientResult<AssetPackageRecord>>;
}

export interface AssetPackageManagerProps {
  readonly workspaceId: string;
  readonly client: AssetPackageClient;
}

export function AssetPackageManager({ workspaceId, client }: AssetPackageManagerProps) {
  const [inspection, setInspection] = useState<AssetPackageInspectionSummary>();
  const [packages, setPackages] = useState<readonly AssetPackageRecord[]>([]);
  const [approvedCapabilities, setApprovedCapabilities] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    setInspection(undefined);
    setApprovedCapabilities([]);
    setError(undefined);
    setNotice(undefined);
    setLoading(true);
    void client.list(workspaceId).then((result) => {
      if (!active) return;
      if (result.ok) setPackages(result.value);
      else setError(result.error.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [client, workspaceId]);

  async function inspect(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    setInspection(undefined);
    setApprovedCapabilities([]);
    try {
      const result = await client.inspect({ workspaceId, bytes: new Uint8Array(await file.arrayBuffer()) });
      if (!result.ok) setError(result.error.message);
      else setInspection(result.value);
    } catch {
      setError("The package could not be read or inspected.");
    } finally {
      setBusy(false);
    }
  }

  async function admit() {
    if (!inspection) return;
    setBusy(true);
    setError(undefined);
    const result = await client.admit({
      workspaceId,
      inspectionId: inspection.inspectionId,
      packageDigest: inspection.packageDigest,
      approvalScope: "workspace",
      approvedCapabilities,
    });
    if (!result.ok) setError(result.error.message);
    else {
      setPackages((current) => replaceRecord(current, result.value));
      setNotice(`${result.value.displayName} was installed for this workspace.`);
      setInspection(undefined);
      setApprovedCapabilities([]);
    }
    setBusy(false);
  }

  async function mutate(record: AssetPackageRecord, operation: "activate" | "disable" | "rollback") {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const result = await client[operation]({ workspaceId, recordId: record.recordId });
    if (!result.ok) setError(result.error.message);
    else {
      const refreshed = await client.list(workspaceId);
      setPackages(refreshed.ok ? refreshed.value : replaceRecord(packages, result.value));
      setNotice(`${result.value.displayName} is now ${result.value.status}.`);
    }
    setBusy(false);
  }

  const allCapabilitiesApproved = inspection?.requestedCapabilities.every((capability) => approvedCapabilities.includes(capability)) ?? false;

  return (
    <section className="ui-panel ui-panel--sectioned asset-package-manager" aria-labelledby="asset-packages-title">
      <header className="ui-panel__section-header">
        <div className="ui-panel-heading ui-panel-heading--violet">
          <span className="ui-panel-heading__icon" aria-hidden="true"><ApplicationIcon name="upload" /></span>
          <div><h2 id="asset-packages-title" className="ui-panel__title">Import asset packages</h2><p className="ui-text-muted">Inspect, approve, install, and activate reusable asset packages without executing package code.</p></div>
        </div>
      </header>
      <div className="ui-panel__section-body ui-stack">
        {error ? <p className="ui-status ui-status--error" role="alert">{error}</p> : null}
        {notice ? <p className="ui-status ui-status--success" role="status">{notice}</p> : null}
        <WorkflowSequence ariaLabel="Asset package import steps">
          <WorkflowStep title="Select and inspect" description="Choose an .aisb-package file. Inspection verifies the bounded container, hashes, compatibility, and evidence without running its contents." active={!inspection}>
            <label className="asset-package-manager__file ui-button ui-button--secondary">
              <ApplicationIcon name="upload" /><span>{busy ? "Inspecting…" : "Choose package"}</span>
              <input type="file" accept=".aisb-package,application/vnd.ai-system-builder.package.v1+json" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void inspect(file); }} />
            </label>
          </WorkflowStep>
          <WorkflowStep title="Review trust and permissions" description="Admission remains blocked until inspection succeeds and every requested capability is explicitly approved." active={Boolean(inspection)}>
            {!inspection ? <p className="ui-text-muted">Select a package to view its verified identity, evidence, compatibility, and capabilities.</p> : (
              <div className="ui-stack ui-stack--sm">
                <dl className="asset-package-manager__summary">
                  <div><dt>Package</dt><dd>{inspection.displayName ?? inspection.packageId ?? "Unknown"} {inspection.version ? `v${inspection.version}` : ""}</dd></div>
                  <div><dt>Contents</dt><dd>{inspection.definitionCount} definitions · {inspection.implementationCount} implementations · {inspection.entryCount} files</dd></div>
                  <div><dt>Evidence</dt><dd>Signature: {inspection.signatureStatus} · Provenance: {inspection.provenanceStatus} · SBOM: {inspection.sbomStatus}</dd></div>
                  <div><dt>Compatibility</dt><dd>{inspection.supportedDeploymentProfiles.join(", ") || "No supported deployment profile declared"}</dd></div>
                </dl>
                {inspection.issues.length ? <ul className="asset-package-manager__issues">{inspection.issues.map((issue, index) => <li key={`${issue.code}-${index}`} data-severity={issue.severity}><strong>{issue.severity}:</strong> {issue.message}</li>)}</ul> : <p className="ui-status ui-status--success">No inspection issues were found.</p>}
                <fieldset className="ui-workflow__subpanel"><legend>Requested capabilities</legend>
                  {inspection.requestedCapabilities.length ? inspection.requestedCapabilities.map((capability) => (
                    <label className="ui-workflow__checkbox-row" key={capability}><input type="checkbox" checked={approvedCapabilities.includes(capability)} onChange={(event) => setApprovedCapabilities(toggle(approvedCapabilities, capability, event.currentTarget.checked))} /><span>{capability}</span></label>
                  )) : <p className="ui-text-muted">This package requests no host capabilities.</p>}
                </fieldset>
              </div>
            )}
          </WorkflowStep>
          <WorkflowStep title="Install for this workspace" description="Installation stores immutable definitions and implementation releases. Activation is a separate, reversible action.">
            <button type="button" className="ui-button" disabled={busy || !inspection?.eligibleForAdmission || !allCapabilitiesApproved} onClick={() => void admit()}><ApplicationIcon name="save" /><span>Install package</span></button>
          </WorkflowStep>
        </WorkflowSequence>
        <section className="asset-package-manager__installed" aria-labelledby="installed-packages-title">
          <h3 id="installed-packages-title">Installed packages</h3>
          {loading ? <p role="status">Loading installed packages…</p> : packages.length === 0 ? <EmptyState title="No packages installed" description="Inspected packages you approve will appear here." icon="assets" compact /> : (
            <ul className="asset-package-manager__records">{packages.map((record) => <li key={record.recordId} className="ui-workflow__subpanel"><div><strong>{record.displayName}</strong> <span className="ui-type-badge ui-type-badge--violet">{record.status.toUpperCase()}</span><p className="ui-text-muted">{record.packageId} · v{record.version} · {record.trustLevel ?? "unverified"}</p></div><div className="asset-package-manager__record-actions">{record.status !== "active" ? <button type="button" disabled={busy} onClick={() => void mutate(record, "activate")}><ApplicationIcon name="play" /><span>Activate</span></button> : <button type="button" className="ui-button--secondary" disabled={busy} onClick={() => void mutate(record, "disable")}><ApplicationIcon name="close" /><span>Disable</span></button>}{record.previousActiveRecordId ? <button type="button" className="ui-button--secondary" disabled={busy} onClick={() => void mutate(record, "rollback")}><ApplicationIcon name="refresh" /><span>Rollback</span></button> : null}</div></li>)}</ul>
          )}
        </section>
      </div>
    </section>
  );
}

function toggle(values: readonly string[], value: string, enabled: boolean): readonly string[] {
  return enabled ? Array.from(new Set([...values, value])) : values.filter((entry) => entry !== value);
}

function replaceRecord(records: readonly AssetPackageRecord[], record: AssetPackageRecord): readonly AssetPackageRecord[] {
  return [...records.filter((entry) => entry.recordId !== record.recordId), record].sort((left, right) => left.displayName.localeCompare(right.displayName));
}
