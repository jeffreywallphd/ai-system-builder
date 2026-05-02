import type { ModelBrowseItem, ModelInventoryRecord } from "../../../../../../modules/contracts/model";
import type { ModelManagementApiClient } from "../api/apiModelManagementClient";
import { useModelManagementFeature } from "../hooks/useModelManagementFeature";

function downloadStateLabel(record: ModelInventoryRecord): string {
  if (record.lifecycleStatus === "downloaded" || record.lifecycleStatus === "validated") return "Downloaded";
  if (record.lifecycleStatus === "saved-reference" || record.lifecycleStatus === "remote-reference") return "Reference saved";
  if (record.lifecycleStatus === "invalid") return "Download unavailable/error";
  return "Not downloaded";
}

export function ModelManagementFeature({ client }: { client?: ModelManagementApiClient }) {
  const vm = useModelManagementFeature(client);

  const renderModelMeta = (m: { taskTags?: string[]; inferenceMode?: string; artifactForm?: string }) => (
    <p>
      Tasks: {m.taskTags?.join(", ") || "n/a"} • Inference: {m.inferenceMode || "n/a"} • Artifact: {m.artifactForm || "n/a"}
    </p>
  );

  return <section className="ui-panel ui-stack ui-stack--sm"><h2>Model Management</h2>
    {vm.error ? <p role="alert">{vm.error}</p> : null}
    {vm.status ? <p role="status">{vm.status}</p> : null}

    <section className="ui-stack ui-stack--sm"><h3>Browse models</h3>
      <input className="ui-input" value={vm.query} placeholder="Search models" onChange={(e) => vm.setQuery(e.target.value)} />
      <select className="ui-input" value={vm.provider} onChange={(e) => vm.setProvider(e.target.value as "huggingface")}>
        <option value="huggingface">Hugging Face</option>
      </select>
      <div className="ui-grid ui-grid--two">
        <button className="ui-button" onClick={() => void vm.browse()} disabled={vm.browsing}>Browse</button>
        <button className="ui-button" onClick={vm.clear} disabled={vm.loading}>Clear</button>
      </div>
    </section>

    <section><h3>Browse results</h3>
      <ul>{vm.browseResults.map((m: ModelBrowseItem) => <li key={m.modelId} className="ui-panel ui-stack ui-stack--sm">
        <strong>{m.displayName}</strong>
        <p>{m.modelId}</p>
        {renderModelMeta(m)}
        <div className="ui-grid ui-grid--two">
          <button className="ui-button" onClick={() => void vm.viewDetails(m.modelId)} disabled={vm.loading}>Details</button>
          <button className="ui-button" onClick={() => void vm.saveReference(m)} disabled={vm.loading}>Save Reference</button>
          <button className="ui-button" onClick={() => void vm.download(m)} disabled={vm.downloadingModelId === m.modelId}>{vm.downloadingModelId === m.modelId ? "Downloading..." : "Download"}</button>
        </div>
      </li>)}</ul>
    </section>

    <section className="ui-stack ui-stack--sm"><h3>Server model inventory</h3>
      <button className="ui-button" onClick={() => void vm.refreshInventory()} disabled={vm.inventoryLoading}>{vm.inventoryLoading ? "Refreshing..." : "Refresh"}</button>
      <ul>{vm.inventory.map((m) => <li key={m.modelRecordId} className="ui-panel ui-stack ui-stack--sm">
        <strong>{m.displayName}</strong>
        <p>Provider: {m.provider} • Status: {m.lifecycleStatus} • Download: {downloadStateLabel(m)}</p>
        <p>Model ID: {m.modelId || "n/a"}</p>
        {renderModelMeta(m)}
        <div className="ui-grid ui-grid--two">
          <button className="ui-button" onClick={() => void vm.viewDetails(m.modelId ?? "")} disabled={!m.modelId || vm.loading}>Details</button>
          <button className="ui-button" onClick={() => void vm.deleteRecord(m.modelRecordId)} disabled={vm.deletingModelRecordId === m.modelRecordId}>{vm.deletingModelRecordId === m.modelRecordId ? "Deleting..." : "Delete record"}</button>
        </div>
      </li>)}</ul>
    </section>

    {vm.details ? <details><summary>Model details</summary><dl>
      {Object.entries(vm.details).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}
    </dl></details> : null}
  </section>;
}
