import type { AssetLibraryMutationAction } from "./assetLibraryActions";
import type { AssetLibraryResourceBackedViewDetail } from "./assetLibraryReadModels";

export interface AssetMutationConfirmationDialogProps {
  readonly action: AssetLibraryMutationAction;
  readonly view: Pick<AssetLibraryResourceBackedViewDetail, "displayName" | "viewKindLabel" | "registrationStatusLabel">;
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function AssetMutationConfirmationDialog({
  action,
  view,
  isPending,
  onCancel,
  onConfirm,
}: AssetMutationConfirmationDialogProps) {
  return (
    <div className="asset-mutation-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-mutation-dialog-title">
      <div className="asset-mutation-dialog__panel">
        <h2 id="asset-mutation-dialog-title">{action.confirmationTitle}</h2>
        <p>{action.confirmationMessage}</p>
        <dl className="asset-library-detail__facts">
          <dt>Source</dt>
          <dd>{view.displayName}</dd>
          <dt>Creates</dt>
          <dd>{action.creates}</dd>
          <dt>Current state</dt>
          <dd>{view.registrationStatusLabel}</dd>
          <dt>Local storage</dt>
          <dd>{action.approvalDefaults.allowFilesystemWrite ? "May write after confirmation" : "No write requested"}</dd>
          <dt>Network or provider</dt>
          <dd>{action.approvalDefaults.allowNetworkAccess ? "May be used after confirmation" : "No access requested"}</dd>
          <dt>Credentials</dt>
          <dd>{action.approvalDefaults.allowCredentialUse ? "Configured credentials may be used" : "No credential use requested"}</dd>
        </dl>
        {action.approvalDefaults.allowPartialCompletion ? (
          <div className="ui-status" role="status">This operation can partly complete. If that happens, you can retry or review the safe details shown here.</div>
        ) : null}
        {action.riskSummary?.length ? (
          <details className="asset-mutation-dialog__details">
            <summary>Review details</summary>
            <ul>
              {action.riskSummary.map((risk) => <li key={risk}>{risk}</li>)}
            </ul>
          </details>
        ) : null}
        <div className="asset-mutation-dialog__actions">
          <button type="button" className="ui-button ui-button--secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </button>
          <button type="button" className="ui-button ui-button--primary" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Working..." : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
