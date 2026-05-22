import { useEffect, useMemo, useState } from 'react';
import { createThinClientAssetCompositionClient } from '../../asset-composition/api/thinClientAssetCompositionClient';
import { createThinClientConversationExecutionClient } from '../api/thinClientConversationExecutionClient';

const opId = () => `op-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

export function ConversationRunTestTab({ workspaceId }: { workspaceId: string }) {
  const plansClient = useMemo(() => createThinClientAssetCompositionClient(), []);
  const client = useMemo(() => createThinClientConversationExecutionClient(), []);
  const [plans, setPlans] = useState<any[]>([]);
  const [planId, setPlanId] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [session, setSession] = useState<any>();
  const [transcript, setTranscript] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refreshPlans = async () => { const r = await plansClient.listPlanSummaries({ targetWorkspaceId: workspaceId }); if (r.ok) { const value = r.value as { summaries?: any[] }; const items = value.summaries ?? []; setPlans(items); if (!planId && items[0]?.planId) setPlanId(items[0].planId); } };
  const refreshSessions = async (pid: string) => { if (!pid) return; const r = await client.listConversationSessions({ workspaceId, sourceExecutionPlanId: pid }); if (r.ok) { const xs = (r.value.sessions ?? r.value.items ?? []) as any[]; setSessions(xs); if (!sessionId && xs[0]?.conversationSessionId) setSessionId(xs[0].conversationSessionId); } };
  const refreshSession = async (sid: string) => { if (!sid) return; const r = await client.readConversationSession({ workspaceId, conversationSessionId: sid }); if (r.ok) setSession(r.value); };
  const refreshTranscript = async (sid: string) => { if (!sid) return; const r = await client.readConversationTranscript({ workspaceId, conversationSessionId: sid }); if (r.ok) setTranscript(r.value.entries ?? r.value.messages ?? []); };

  useEffect(() => { void refreshPlans(); }, [workspaceId]);
  useEffect(() => { void refreshSessions(planId); }, [planId]);
  useEffect(() => { void refreshSession(sessionId); void refreshTranscript(sessionId); }, [sessionId]);

  const requiresApproval = (session?.approvalStatus ?? session?.executionApprovalStatus) !== 'approved' && (session?.sessionStatus ?? session?.status) !== 'approved' && (session?.sessionStatus ?? session?.status) !== 'active';
  const canSubmit = !requiresApproval && !!sessionId && !busy;

  return <section className="ui-stack ui-stack--sm"><h2>Run &amp; Test</h2>
    <div className="ui-panel ui-stack ui-stack--xs"><h3>Test an assistant</h3><p>Choose a conversational system from your assets to start a test conversation.</p>
      <label>Run plan<select aria-label='Run plan' value={planId} onChange={(e)=>setPlanId(e.target.value)}><option value=''>Select a run plan</option>{plans.map((p:any)=><option key={p.planId ?? p.id} value={p.planId ?? p.id}>{p.name ?? p.planId ?? p.id}</option>)}</select></label>
      {!planId ? <p>Select a run plan from the Plans tab to continue.</p> : null}
      {planId ? <button type='button' onClick={async()=>{setBusy(true); const r = await client.createConversationSessionFromPlan({ workspaceId, sourceExecutionPlanId: planId }); setBusy(false); if (!r.ok) { setMessage(r.error.message); return; } const id = r.value.conversationSessionId ?? r.value.id ?? ''; setMessage('Test conversation created.'); setSessionId(id); await refreshSessions(planId); await refreshSession(id); }}>Start test conversation</button> : null}
      {sessions.length ? <label>Test conversation<select aria-label='Test conversation' value={sessionId} onChange={(e)=>setSessionId(e.target.value)}>{sessions.map((s:any)=><option key={s.conversationSessionId ?? s.id} value={s.conversationSessionId ?? s.id}>{s.sessionLabel ?? s.systemLabel ?? (s.conversationSessionId ?? s.id)}</option>)}</select></label> : null}
      {requiresApproval && sessionId ? <><p><strong>Ready to start</strong></p><p>Review and approve this test conversation before sending messages.</p><button type='button' onClick={async()=>{setBusy(true); const approvalId = session?.executionApprovalId ?? session?.approvalId ?? ''; if (!approvalId) { setMessage('Approval is not available yet.'); setBusy(false); return; } const r = await client.approveConversationSession({ workspaceId, conversationSessionId: sessionId, executionApprovalId: approvalId }); setBusy(false); setMessage(r.ok ? 'Approved. You can start testing.' : r.error.message); await refreshSession(sessionId); }}>Approve and start testing</button></> : null}
    </div>

    <section className='ui-panel ui-stack ui-stack--xs' aria-label='Conversation'>
      <h3>Conversation</h3>
      {!sessionId ? <p>No conversation yet. Start a test conversation to begin.</p> : null}
      {sessionId && transcript.length === 0 ? <p>Send your first message to test this assistant.</p> : null}
      <ul>{transcript.map((e:any, i:number)=> <li key={e.entryId ?? i}><strong>{(e.role ?? e.kind) === 'assistant' ? 'Assistant' : 'You'}:</strong> {e.text ?? e.content ?? 'A response could not be shown.'}</li>)}</ul>
      <label>Message<textarea aria-label='Message' value={draft} onChange={(e)=>setDraft(e.target.value)} /></label>
      <button type='button' disabled={!canSubmit || !draft.trim()} onClick={async()=>{if(!draft.trim())return; setBusy(true); const text=draft; const r=await client.submitConversationTurn({ workspaceId, conversationSessionId: sessionId, text, operationId: opId() }); if(r.ok){setDraft(''); setMessage('Generating response…'); await refreshTranscript(sessionId);} else {setMessage(r.error.code==='unsupported' ? 'This assistant cannot run here right now.' : r.error.message);} setBusy(false); }}>Send</button>
      {!canSubmit && sessionId ? <p>This assistant can be viewed here, but it must be run from the desktop app.</p> : null}
      {message ? <p role='status'>{message}</p> : null}
    </section>
  </section>;
}
