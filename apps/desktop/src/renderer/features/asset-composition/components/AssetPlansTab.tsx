import { useEffect, useMemo, useState } from "react";

const REL_KINDS = [
  ["depends-on", "Depends on"],
  ["feeds-into", "Feeds into"],
  ["configures", "Configures"],
  ["uses-model", "Uses model"],
  ["uses-data", "Uses data"],
  ["produces-output", "Produces output"],
  ["requires-capability", "Requires capability"],
  ["supports", "Supports"],
] as const;

const PLAN_STATUS: Record<string, string> = { draft: "Draft", valid: "Ready for planning", blocked: "Blocked", conflicted: "Needs attention", stale: "Refresh needed", unsupported: "Not supported", invalid: "Invalid", archived: "Archived" };
const NODE_STATUS: Record<string, string> = { "ready-for-planning": "Ready for planning", planned: "Planned", blocked: "Blocked", conflicted: "Needs attention", "missing-projection": "Missing asset", "stale-projection": "Refresh needed", unsupported: "Not supported", invalid: "Invalid", disabled: "Disabled" };
const REL_STATUS: Record<string, string> = { compatible: "Looks compatible", unknown: "Not checked", blocked: "Blocked", conflicted: "Needs attention", "missing-dependency": "Missing requirement", unsupported: "Not supported", stale: "Refresh needed", invalid: "Invalid" };

const safe = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;
const statusLabel = (table: Record<string, string>, v: unknown, fallback = "Needs attention") => table[String(v ?? "").trim()] ?? fallback;
const sanitizeMessage = (v: unknown) => safe(v, "Needs attention.").replace(/(token|secret|path|base64|workflow|prompt|payload|provider|command|env)/ig, "[hidden]").slice(0, 240);

export function AssetPlansTab({ workspaceId, client, projectionClient }: { workspaceId: string; client: any; projectionClient: any; }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedPlan, setSelectedPlan] = useState<any>();
  const [available, setAvailable] = useState<any[]>([]);
  const [state, setState] = useState<"idle"|"loading"|"error">("idle");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectionId, setProjectionId] = useState("");
  const [sourceNodeId, setSourceNodeId] = useState("");
  const [relationshipKind, setRelationshipKind] = useState("depends-on");
  const [targetNodeId, setTargetNodeId] = useState("");

  const canMutate = Boolean(client.addProjectionToPlan);

  async function refreshPlans(selectId?: string) {
    setState("loading");
    const r = await client.listPlans({ targetWorkspaceId: workspaceId });
    if (!r.ok) { setState("error"); setMessage(r.error.message); return; }
    const items = r.value.plans ?? r.value.items ?? [];
    setPlans(items);
    const next = selectId ?? selectedPlanId ?? items[0]?.planId;
    setSelectedPlanId(next ?? "");
    setState("idle");
  }

  async function refreshPlanDetail(planId: string) {
    if (!planId) return;
    const r = await client.readPlan({ targetWorkspaceId: workspaceId, planId });
    if (!r.ok) { setMessage(r.error.message); return; }
    setSelectedPlan(r.value.plan ?? r.value);
  }

  useEffect(() => { void refreshPlans(); }, [workspaceId]);
  useEffect(() => { if (selectedPlanId) void refreshPlanDetail(selectedPlanId); }, [selectedPlanId]);
  useEffect(() => { (async () => {
    if (!projectionClient?.listProjections) return;
    const r = await projectionClient.listProjections(workspaceId);
    if (!r.ok) return;
    setAvailable((r.value.projections ?? r.value.items ?? []).filter((x:any) => x.status === "ready-for-planning"));
  })(); }, [workspaceId, projectionClient]);

  const planRows = useMemo(() => plans.map((p) => ({ id: p.planId, name: safe(p.name, "Untitled plan"), description: p.description, status: statusLabel(PLAN_STATUS, p.status, "Needs attention"), nodes: p.nodes?.length ?? p.planningSummary?.totalNodes ?? 0, rels: p.relationships?.length ?? p.planningSummary?.totalRelationships ?? 0, missing: p.planningSummary?.missingDependencyCount ?? 0, updatedAt: p.updatedAt })), [plans]);

  return <section className="ui-stack ui-stack--sm"><h2>Plans</h2>
  <form onSubmit={async (e)=>{e.preventDefault(); if(!name.trim()){setMessage("Name is required."); return;} const r=await client.createPlan({targetWorkspaceId:workspaceId,name:name.trim(),description:description.trim()||undefined}); if(!r.ok){setMessage(r.error.message);return;} setMessage("Plan created."); setName(""); setDescription(""); const id=r.value.plan?.planId ?? r.value.planId; await refreshPlans(id); if(id) await refreshPlanDetail(id); }} className="ui-panel ui-stack ui-stack--xs"><h3>Create plan</h3><p><small>A plan organizes assets before runtime setup. Nothing runs from this screen.</small></p><label>Name <input aria-label="Name" value={name} onChange={(e)=>setName(e.target.value)} /></label><label>Description <input aria-label="Description" value={description} onChange={(e)=>setDescription(e.target.value)} /></label><button>Create plan</button></form>
  {state==="loading"?<p role="status">Loading plans...</p>:null}
  {state==="error"?<p role="alert">Unable to load plans right now.</p>:null}
  {!planRows.length&&state==="idle"?<p>No plans yet. Create a plan to organize assets before building a system.</p>:null}
  <ul>{planRows.map((p)=><li key={p.id}><button onClick={()=>setSelectedPlanId(p.id)}>{p.name}</button> — {p.status} — Nodes {p.nodes} · Connections {p.rels} · Missing requirements {p.missing}</li>)}</ul>
  {selectedPlan?<section className="ui-panel ui-stack ui-stack--xs"><h3>Plan details</h3><p><strong>{safe(selectedPlan.name,"Untitled plan")}</strong> — {statusLabel(PLAN_STATUS, selectedPlan.status)}</p>
  <h4>Assets in this plan</h4>
  {canMutate?<div><select aria-label="Asset to add" value={projectionId} onChange={(e)=>setProjectionId(e.target.value)}><option value="">Select an asset</option>{available.map((a:any)=><option key={a.projectionId} value={a.projectionId}>{safe(a.displayName,"Asset")} ({safe(a.sourceKind,"Workspace")})</option>)}</select><button onClick={async()=>{if(!projectionId)return; const r=await client.addProjectionToPlan({targetWorkspaceId:workspaceId,planId:selectedPlan.planId,projectionId}); setMessage(r.ok?"Added to plan.":r.error.message); if(r.ok) await refreshPlanDetail(selectedPlan.planId);}}>Add to plan</button></div>:<p>Adding assets to plans is not available yet.</p>}
  <ul>{(selectedPlan.nodes??[]).map((n:any)=><li key={n.nodeId}>{safe(n.label,n.selectedProjection?.displayLabel??"Asset")} — {statusLabel(NODE_STATUS,n.status)} <button onClick={async()=>{const r=await client.removeProjectionFromPlan?.({targetWorkspaceId:workspaceId,planId:selectedPlan.planId,projectionId:n.selectedProjection?.projectionId}); if(!r){setMessage("Removing assets from plans is not available yet."); return;} setMessage(r.ok?"Removed.":sanitizeMessage(r.error.message)||"Remove connections first."); if(r.ok) await refreshPlanDetail(selectedPlan.planId);}}>Remove</button></li>)}</ul>
  <h4>Connections</h4>
  {client.connectNodes?<div><select aria-label="Source asset" value={sourceNodeId} onChange={(e)=>setSourceNodeId(e.target.value)}><option value="">Source</option>{(selectedPlan.nodes??[]).map((n:any)=><option key={n.nodeId} value={n.nodeId}>{safe(n.label,"Asset")}</option>)}</select>
  <select aria-label="Relationship kind" value={relationshipKind} onChange={(e)=>setRelationshipKind(e.target.value)}>{REL_KINDS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
  <select aria-label="Target asset" value={targetNodeId} onChange={(e)=>setTargetNodeId(e.target.value)}><option value="">Target</option>{(selectedPlan.nodes??[]).map((n:any)=><option key={n.nodeId} value={n.nodeId}>{safe(n.label,"Asset")}</option>)}</select>
  <button onClick={async()=>{const r=await client.connectNodes({targetWorkspaceId:workspaceId,planId:selectedPlan.planId,sourceNodeId,kind:relationshipKind,targetNodeId}); setMessage(r.ok?"Connection added.":r.error.message); if(r.ok) await refreshPlanDetail(selectedPlan.planId);}}>Add connection</button></div>:<p>Connections are not available yet.</p>}
  <ul>{(selectedPlan.relationships??[]).map((rel:any)=><li key={rel.relationshipId}>{safe(selectedPlan.nodes?.find((n:any)=>n.nodeId===rel.sourceNodeId)?.label,"Asset")} {REL_KINDS.find(([v])=>v===rel.kind)?.[1]??"Connects to"} {safe(selectedPlan.nodes?.find((n:any)=>n.nodeId===rel.targetNodeId)?.label,"Asset")} — {statusLabel(REL_STATUS,rel.compatibilityStatus)} <button onClick={async()=>{const r=await client.disconnectNodes?.({targetWorkspaceId:workspaceId,planId:selectedPlan.planId,relationshipId:rel.relationshipId}); if(!r){setMessage("Removing connections is not available yet."); return;} setMessage(r.ok?"Connection removed.":r.error.message); if(r.ok) await refreshPlanDetail(selectedPlan.planId);}}>Remove connection</button></li>)}</ul>
  {client.validatePlan?<button onClick={async()=>{const r=await client.validatePlan({targetWorkspaceId:workspaceId,planId:selectedPlan.planId}); setMessage(r.ok?"Plan checked.":r.error.message); if(r.ok) await refreshPlanDetail(selectedPlan.planId);}}>Check plan</button>:<p>Plan checking is not available yet.</p>}
  <h4>Messages / Needs attention</h4><ul>{([...(selectedPlan.blockers??[]),...(selectedPlan.compatibilityDiagnostics??[])]).slice(0,8).map((d:any,idx:number)=><li key={idx}>{sanitizeMessage(d.message)}</li>)}</ul>
  </section>:null}
  {message?<p role="status">{message}</p>:null}</section>;
}
