import { useEffect, useState } from "react";
import type { AgentGoalPriorityLevel } from "../../../domain/agents/AgentGoal";
import {
  AgentPlanningStrategyModes,
  SupportedAgentPlanningStrategies,
  type AgentPlanningStrategy,
} from "../../../domain/agents/Agent";
import {
  AgentMemoryRetentionModes,
  AgentMemoryRetrievalStrategies,
  AgentMemoryTypes,
  type AgentMemoryConfiguration,
  type AgentMemoryType,
} from "../../../domain/agents/AgentMemory";
import {
  AgentApprovalStatuses,
  type AgentPolicy,
  type AgentToolAccessPolicy,
} from "../../../domain/agents/AgentPolicy";
import type { ConfigureAgentGoalsRequest } from "../../../application/agents/ConfigureAgentGoalsUseCase";
import type { AgentStudioSnapshotReadModel } from "../../../infrastructure/api/agents/AgentStudioBackendApi";
import type { CanonicalAssetManagementService } from "../../services/CanonicalAssetManagementService";
import { CompositionSummaryCard } from "./CompositionSummaryCard";
import { OutputAssetExplorerPanel } from "./OutputAssetExplorerPanel";

interface AgentDetailPanelProps {
  readonly snapshot?: AgentStudioSnapshotReadModel;
  readonly isBusy: boolean;
  readonly canonicalAssetManagementService: CanonicalAssetManagementService;
  readonly onSaveGoals: (request: ConfigureAgentGoalsRequest) => void;
  readonly onSavePolicy: (policy: AgentPolicy) => void;
  readonly onSaveTools: (tools: AgentToolAccessPolicy) => void;
  readonly onSaveMemory: (memory: AgentMemoryConfiguration) => void;
  readonly onSaveStrategy: (strategy: AgentPlanningStrategy) => void;
}

function toCsv(values: ReadonlyArray<string> | undefined): string {
  return (values ?? []).join(", ");
}

function fromCsv(raw: string): ReadonlyArray<string> {
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

export function AgentDetailPanel(props: AgentDetailPanelProps): JSX.Element {
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [goalObjective, setGoalObjective] = useState("");
  const [newGoalId, setNewGoalId] = useState("");
  const [newGoalObjective, setNewGoalObjective] = useState("");

  const [allowedToolIdsText, setAllowedToolIdsText] = useState("");
  const [allowedMcpBindingsText, setAllowedMcpBindingsText] = useState("");
  const [scopeConstraintsText, setScopeConstraintsText] = useState("");

  const [restrictedActionsText, setRestrictedActionsText] = useState("");
  const [requiredApprovalsText, setRequiredApprovalsText] = useState("");
  const [deniedPermissionsText, setDeniedPermissionsText] = useState("");
  const [policyMaxSteps, setPolicyMaxSteps] = useState("");
  const [policyMaxWallClockMs, setPolicyMaxWallClockMs] = useState("");
  const [policyMaxTokens, setPolicyMaxTokens] = useState("");
  const [policyMaxUsd, setPolicyMaxUsd] = useState("");
  const [sandboxNetworkAllowed, setSandboxNetworkAllowed] = useState(false);
  const [sandboxAllowedHosts, setSandboxAllowedHosts] = useState("");
  const [sandboxAllowedProtocols, setSandboxAllowedProtocols] = useState("");
  const [sandboxFilesystemAllowed, setSandboxFilesystemAllowed] = useState(false);
  const [sandboxReadPaths, setSandboxReadPaths] = useState("");
  const [sandboxWritePaths, setSandboxWritePaths] = useState("");
  const [sandboxAssetsRead, setSandboxAssetsRead] = useState(true);
  const [sandboxAssetsWrite, setSandboxAssetsWrite] = useState(false);
  const [sandboxEnvironmentMode, setSandboxEnvironmentMode] = useState<"inherit-runtime" | "none" | "allowlist">("none");
  const [sandboxAllowedEnvVars, setSandboxAllowedEnvVars] = useState("");

  const [memoryAssetsText, setMemoryAssetsText] = useState("");
  const [memoryStrategy, setMemoryStrategy] = useState<AgentMemoryConfiguration["retrieval"]["strategy"]>(AgentMemoryRetrievalStrategies.latestFirst);
  const [memoryMaxEntries, setMemoryMaxEntries] = useState("5");
  const [memoryRequiredTags, setMemoryRequiredTags] = useState("");
  const [memoryTypesText, setMemoryTypesText] = useState("");
  const [memoryRetrievableTypesText, setMemoryRetrievableTypesText] = useState("");
  const [memoryWritableTypesText, setMemoryWritableTypesText] = useState("");
  const [memorySessionOnlyTypesText, setMemorySessionOnlyTypesText] = useState("");
  const [memoryRetentionMode, setMemoryRetentionMode] = useState<"disabled" | "bounded">(AgentMemoryRetentionModes.bounded);
  const [memoryMaxDurableEntries, setMemoryMaxDurableEntries] = useState("");

  const [strategy, setStrategy] = useState<AgentPlanningStrategy>({ strategyId: "deterministic", mode: AgentPlanningStrategyModes.deterministicLinear });

  useEffect(() => {
    const agent = props.snapshot?.agent.agent;
    if (!agent) {
      return;
    }

    setAllowedToolIdsText(agent.toolAccess.allowedToolIds.join("\n"));
    setAllowedMcpBindingsText((agent.toolAccess.allowedMcpTools ?? []).map((binding) => `${binding.toolId}|${binding.serverId}|${binding.toolName}`).join("\n"));
    setScopeConstraintsText(agent.toolAccess.scopeConstraints.map((constraint) => `${constraint.toolId}|${constraint.allowedScopes.join(",")}`).join("\n"));

    setRestrictedActionsText(agent.policy.restrictedActions.join("\n"));
    setRequiredApprovalsText(
      agent.policy.safetyConstraints.requiredApprovals
        .map((approval) => [approval.permissionId, approval.minimumStatus, approval.scopeType, approval.scopeId ?? ""].join("|"))
        .join("\n"),
    );
    setDeniedPermissionsText(agent.policy.safetyConstraints.deniedPermissionIds.join("\n"));
    setPolicyMaxSteps(agent.policy.executionLimits.maxSteps?.toString() ?? "");
    setPolicyMaxWallClockMs(agent.policy.executionLimits.maxWallClockMs?.toString() ?? "");
    setPolicyMaxTokens(agent.policy.costLimits.maxTokens?.toString() ?? "");
    setPolicyMaxUsd(agent.policy.costLimits.maxEstimatedUsd?.toString() ?? "");
    setSandboxNetworkAllowed(agent.policy.safetyConstraints.sandbox.network.allowed);
    setSandboxAllowedHosts(toCsv(agent.policy.safetyConstraints.sandbox.network.allowedHosts));
    setSandboxAllowedProtocols(toCsv(agent.policy.safetyConstraints.sandbox.network.allowedProtocols));
    setSandboxFilesystemAllowed(agent.policy.safetyConstraints.sandbox.filesystem.allowed);
    setSandboxReadPaths(toCsv(agent.policy.safetyConstraints.sandbox.filesystem.readPaths));
    setSandboxWritePaths(toCsv(agent.policy.safetyConstraints.sandbox.filesystem.writePaths));
    setSandboxAssetsRead(Boolean(agent.policy.safetyConstraints.sandbox.assets.read));
    setSandboxAssetsWrite(Boolean(agent.policy.safetyConstraints.sandbox.assets.write));
    setSandboxEnvironmentMode(agent.policy.safetyConstraints.sandbox.environment.mode);
    setSandboxAllowedEnvVars(toCsv(agent.policy.safetyConstraints.sandbox.environment.allowedEnvVars));

    setMemoryAssetsText(
      agent.memory.assets
        .map((asset) => [asset.assetId, asset.assetVersionId ?? "", asset.memoryType, asset.lineageTag ?? ""].join("|"))
        .join("\n"),
    );
    setMemoryStrategy(agent.memory.retrieval.strategy);
    setMemoryMaxEntries(agent.memory.retrieval.maxEntries.toString());
    setMemoryRequiredTags(toCsv(agent.memory.retrieval.requiredTags));
    setMemoryTypesText(toCsv(agent.memory.retrieval.memoryTypes));
    setMemoryRetrievableTypesText(toCsv(agent.memory.policy.retrievableTypes));
    setMemoryWritableTypesText(toCsv(agent.memory.policy.writableTypes));
    setMemorySessionOnlyTypesText(toCsv(agent.memory.policy.sessionOnlyTypes));
    setMemoryRetentionMode(agent.memory.policy.retentionMode as "disabled" | "bounded");
    setMemoryMaxDurableEntries(agent.memory.policy.maxDurableEntries?.toString() ?? "");

    setStrategy(agent.planningStrategy);
    const firstGoal = agent.goals[0];
    if (firstGoal) {
      setSelectedGoalId(firstGoal.id);
      setGoalObjective(firstGoal.objective);
    }
  }, [props.snapshot?.agent.agent.updatedAt]);

  if (!props.snapshot) {
    return (
      <section className="ui-card ui-stack ui-stack--sm" data-testid="agent-detail-panel">
        <h2 className="ui-heading-2">Agent detail</h2>
        <p className="ui-text-secondary">Select an agent to load detail.</p>
      </section>
    );
  }

  const agent = props.snapshot.agent.agent;
  const selectedGoal = agent.goals.find((goal) => goal.id === selectedGoalId);

  const moveGoal = (goalId: string, offset: number) => {
    const ids = [...agent.goals].sort((a, b) => a.priorityOrder - b.priorityOrder).map((goal) => goal.id);
    const index = ids.indexOf(goalId);
    if (index < 0) {
      return;
    }
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= ids.length) {
      return;
    }
    const [moved] = ids.splice(index, 1);
    ids.splice(nextIndex, 0, moved);
    props.onSaveGoals({ agentId: agent.id, operations: [{ type: "reorder", goalIdsInPriorityOrder: ids }] });
  };

  return (
    <section className="ui-stack ui-stack--sm" data-testid="agent-detail-panel">
      <div className="ui-card ui-stack ui-stack--sm">
        <h2 className="ui-heading-2">{agent.name}</h2>
        <p className="ui-text-secondary">{agent.id} — {agent.status}</p>
      </div>
      <CompositionSummaryCard
        title="Composition metadata"
        taxonomy={props.snapshot.agent.taxonomy}
        contract={props.snapshot.agent.contract}
      />
      <OutputAssetExplorerPanel
        title="Memory asset references"
        canonicalAssetManagementService={props.canonicalAssetManagementService}
        assetIds={agent.memory.assets.map((entry) => entry.assetId.toString())}
        emptyMessage="No memory assets are configured for this agent."
      />

      <div className="ui-card ui-stack ui-stack--sm">
        <h3 className="ui-heading-3">Goals</h3>
        <ul className="ui-stack ui-stack--xs">
          {agent.goals.map((goal) => (
            <li key={goal.id}>
              <span>{goal.priorityOrder}. {goal.objective}</span>
              <div className="ui-row ui-row--wrap">
                <button className="ui-button ui-button--ghost ui-button--sm" onClick={() => moveGoal(goal.id, -1)} disabled={props.isBusy}>Up</button>
                <button className="ui-button ui-button--ghost ui-button--sm" onClick={() => moveGoal(goal.id, 1)} disabled={props.isBusy}>Down</button>
                <button className="ui-button ui-button--ghost ui-button--sm" onClick={() => { setSelectedGoalId(goal.id); setGoalObjective(goal.objective); }} disabled={props.isBusy}>Edit</button>
                <button className="ui-button ui-button--ghost ui-button--sm" onClick={() => props.onSaveGoals({ agentId: agent.id, operations: [{ type: "remove", goalId: goal.id }] })} disabled={props.isBusy}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="ui-row ui-row--wrap">
          <input className="ui-input" value={goalObjective} onChange={(event) => setGoalObjective(event.target.value)} placeholder="Goal objective" />
          <button
            className="ui-button ui-button--secondary ui-button--sm"
            disabled={props.isBusy || !selectedGoal}
            onClick={() => {
              if (!selectedGoal) {
                return;
              }
              props.onSaveGoals({
                agentId: agent.id,
                operations: [{
                  type: "update",
                  goalId: selectedGoal.id,
                  goal: {
                    objective: goalObjective,
                    constraints: selectedGoal.constraints,
                    successCriteria: selectedGoal.successCriteria,
                    priority: selectedGoal.priority as AgentGoalPriorityLevel,
                    priorityOrder: selectedGoal.priorityOrder,
                    requiredToolIds: selectedGoal.requiredToolIds,
                  },
                }],
              });
            }}
          >Save goal</button>
        </div>
        <div className="ui-row ui-row--wrap">
          <input className="ui-input" value={newGoalId} onChange={(event) => setNewGoalId(event.target.value)} placeholder="new goal id" />
          <input className="ui-input" value={newGoalObjective} onChange={(event) => setNewGoalObjective(event.target.value)} placeholder="new goal objective" />
          <button
            className="ui-button ui-button--secondary ui-button--sm"
            disabled={props.isBusy}
            onClick={() => {
              props.onSaveGoals({
                agentId: agent.id,
                operations: [{
                  type: "add",
                  goal: {
                    id: newGoalId,
                    objective: newGoalObjective,
                    constraints: [],
                    successCriteria: ["complete"],
                    priority: "normal",
                    priorityOrder: agent.goals.length + 1,
                    requiredToolIds: [],
                  },
                }],
              });
            }}
          >Add goal</button>
        </div>
      </div>

      <details className="ui-card ui-stack ui-stack--sm" open>
        <summary><strong>Policy</strong></summary>
        <label className="ui-label">Restricted actions (one per line)</label>
        <textarea className="ui-input" rows={3} value={restrictedActionsText} onChange={(event) => setRestrictedActionsText(event.target.value)} />
        <label className="ui-label">Denied permissions (one per line)</label>
        <textarea className="ui-input" rows={3} value={deniedPermissionsText} onChange={(event) => setDeniedPermissionsText(event.target.value)} />
        <label className="ui-label">Required approvals (permission|status|scopeType|scopeId)</label>
        <textarea className="ui-input" rows={4} value={requiredApprovalsText} onChange={(event) => setRequiredApprovalsText(event.target.value)} />
        <div className="ui-row ui-row--wrap">
          <label className="ui-label">maxSteps <input className="ui-input" value={policyMaxSteps} onChange={(event) => setPolicyMaxSteps(event.target.value)} /></label>
          <label className="ui-label">maxWallClockMs <input className="ui-input" value={policyMaxWallClockMs} onChange={(event) => setPolicyMaxWallClockMs(event.target.value)} /></label>
          <label className="ui-label">maxTokens <input className="ui-input" value={policyMaxTokens} onChange={(event) => setPolicyMaxTokens(event.target.value)} /></label>
          <label className="ui-label">maxEstimatedUsd <input className="ui-input" value={policyMaxUsd} onChange={(event) => setPolicyMaxUsd(event.target.value)} /></label>
        </div>
        <div className="ui-row ui-row--wrap">
          <label className="ui-label"><input type="checkbox" checked={sandboxNetworkAllowed} onChange={(event) => setSandboxNetworkAllowed(event.target.checked)} /> network.allowed</label>
          <label className="ui-label"><input type="checkbox" checked={sandboxFilesystemAllowed} onChange={(event) => setSandboxFilesystemAllowed(event.target.checked)} /> filesystem.allowed</label>
          <label className="ui-label"><input type="checkbox" checked={sandboxAssetsRead} onChange={(event) => setSandboxAssetsRead(event.target.checked)} /> assets.read</label>
          <label className="ui-label"><input type="checkbox" checked={sandboxAssetsWrite} onChange={(event) => setSandboxAssetsWrite(event.target.checked)} /> assets.write</label>
        </div>
        <label className="ui-label">network.allowedHosts (csv)</label>
        <input className="ui-input" value={sandboxAllowedHosts} onChange={(event) => setSandboxAllowedHosts(event.target.value)} />
        <label className="ui-label">network.allowedProtocols (csv)</label>
        <input className="ui-input" value={sandboxAllowedProtocols} onChange={(event) => setSandboxAllowedProtocols(event.target.value)} />
        <label className="ui-label">filesystem.readPaths (csv)</label>
        <input className="ui-input" value={sandboxReadPaths} onChange={(event) => setSandboxReadPaths(event.target.value)} />
        <label className="ui-label">filesystem.writePaths (csv)</label>
        <input className="ui-input" value={sandboxWritePaths} onChange={(event) => setSandboxWritePaths(event.target.value)} />
        <label className="ui-label" htmlFor="agent-env-mode">environment.mode</label>
        <select id="agent-env-mode" className="ui-input" value={sandboxEnvironmentMode} onChange={(event) => setSandboxEnvironmentMode(event.target.value as "inherit-runtime" | "none" | "allowlist") }>
          <option value="none">none</option>
          <option value="inherit-runtime">inherit-runtime</option>
          <option value="allowlist">allowlist</option>
        </select>
        <label className="ui-label">environment.allowedEnvVars (csv)</label>
        <input className="ui-input" value={sandboxAllowedEnvVars} onChange={(event) => setSandboxAllowedEnvVars(event.target.value)} />
        <button className="ui-button ui-button--secondary ui-button--sm" disabled={props.isBusy} onClick={() => {
          const nextToolAccess: AgentToolAccessPolicy = {
            allowedToolIds: allowedToolIdsText.split("\n").map((value) => value.trim()).filter(Boolean),
            allowedMcpTools: allowedMcpBindingsText.split("\n").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
              const [toolId = "", serverId = "", toolName = ""] = entry.split("|");
              return { toolId: toolId.trim(), serverId: serverId.trim(), toolName: toolName.trim() };
            }),
            scopeConstraints: scopeConstraintsText.split("\n").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
              const [toolId = "", rawScopes = ""] = entry.split("|");
              return { toolId: toolId.trim(), allowedScopes: fromCsv(rawScopes) };
            }),
          };

          props.onSavePolicy({
            toolAccess: nextToolAccess,
            restrictedActions: restrictedActionsText.split("\n").map((entry) => entry.trim()).filter(Boolean),
            costLimits: {
              maxTokens: policyMaxTokens ? Number(policyMaxTokens) : undefined,
              maxEstimatedUsd: policyMaxUsd ? Number(policyMaxUsd) : undefined,
            },
            executionLimits: {
              maxSteps: policyMaxSteps ? Number(policyMaxSteps) : undefined,
              maxWallClockMs: policyMaxWallClockMs ? Number(policyMaxWallClockMs) : undefined,
            },
            safetyConstraints: {
              requiredApprovals: requiredApprovalsText.split("\n").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
                const [permissionId = "", minimumStatus = AgentApprovalStatuses.approved, scopeType = "tool", scopeId = ""] = entry.split("|");
                return {
                  permissionId: permissionId.trim(),
                  minimumStatus: minimumStatus.trim() as typeof AgentApprovalStatuses[keyof typeof AgentApprovalStatuses],
                  scopeType: scopeType.trim() as "tool" | "workspace" | "global",
                  scopeId: scopeId.trim() || undefined,
                };
              }),
              deniedPermissionIds: deniedPermissionsText.split("\n").map((entry) => entry.trim()).filter(Boolean),
              sandbox: {
                network: { allowed: sandboxNetworkAllowed, allowedHosts: fromCsv(sandboxAllowedHosts), allowedProtocols: fromCsv(sandboxAllowedProtocols) as ReadonlyArray<"http" | "https" | "ws" | "wss" | "tcp" | "udp"> },
                filesystem: { allowed: sandboxFilesystemAllowed, readPaths: fromCsv(sandboxReadPaths), writePaths: fromCsv(sandboxWritePaths) },
                assets: { read: sandboxAssetsRead, write: sandboxAssetsWrite },
                environment: { mode: sandboxEnvironmentMode, allowedEnvVars: fromCsv(sandboxAllowedEnvVars) },
              },
            },
          });
        }}>Save policy</button>
      </details>

      <details className="ui-card ui-stack ui-stack--sm" open>
        <summary><strong>Tools</strong></summary>
        <label className="ui-label">Allowed tool ids (one per line)</label>
        <textarea className="ui-input" rows={5} value={allowedToolIdsText} onChange={(event) => setAllowedToolIdsText(event.target.value)} />
        <label className="ui-label">Allowed MCP bindings (toolId|serverId|toolName)</label>
        <textarea className="ui-input" rows={4} value={allowedMcpBindingsText} onChange={(event) => setAllowedMcpBindingsText(event.target.value)} />
        <label className="ui-label">Scope constraints (toolId|scope1,scope2)</label>
        <textarea className="ui-input" rows={4} value={scopeConstraintsText} onChange={(event) => setScopeConstraintsText(event.target.value)} />
        <button
          className="ui-button ui-button--secondary ui-button--sm"
          disabled={props.isBusy}
          onClick={() => {
            props.onSaveTools({
              allowedToolIds: allowedToolIdsText.split("\n").map((value) => value.trim()).filter(Boolean),
              allowedMcpTools: allowedMcpBindingsText.split("\n").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
                const [toolId = "", serverId = "", toolName = ""] = entry.split("|");
                return { toolId: toolId.trim(), serverId: serverId.trim(), toolName: toolName.trim() };
              }),
              scopeConstraints: scopeConstraintsText.split("\n").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
                const [toolId = "", rawScopes = ""] = entry.split("|");
                return { toolId: toolId.trim(), allowedScopes: fromCsv(rawScopes) };
              }),
            });
          }}
        >Save tools</button>
      </details>

      <details className="ui-card ui-stack ui-stack--sm" open>
        <summary><strong>Memory</strong></summary>
        <label className="ui-label">Asset references (assetId|assetVersionId|memoryType|lineageTag)</label>
        <textarea className="ui-input" rows={5} value={memoryAssetsText} onChange={(event) => setMemoryAssetsText(event.target.value)} />
        <label className="ui-label" htmlFor="agent-memory-strategy">Retrieval strategy</label>
        <select id="agent-memory-strategy" className="ui-input" value={memoryStrategy} onChange={(event) => setMemoryStrategy(event.target.value as AgentMemoryConfiguration["retrieval"]["strategy"])}>
          {Object.values(AgentMemoryRetrievalStrategies).map((entry) => (
            <option key={entry} value={entry}>{entry}</option>
          ))}
        </select>
        <label className="ui-label">retrieval.maxEntries</label>
        <input className="ui-input" value={memoryMaxEntries} onChange={(event) => setMemoryMaxEntries(event.target.value)} />
        <label className="ui-label">retrieval.requiredTags (csv)</label>
        <input className="ui-input" value={memoryRequiredTags} onChange={(event) => setMemoryRequiredTags(event.target.value)} />
        <label className="ui-label">retrieval.memoryTypes (csv)</label>
        <input className="ui-input" value={memoryTypesText} onChange={(event) => setMemoryTypesText(event.target.value)} />
        <label className="ui-label">policy.retrievableTypes (csv)</label>
        <input className="ui-input" value={memoryRetrievableTypesText} onChange={(event) => setMemoryRetrievableTypesText(event.target.value)} />
        <label className="ui-label">policy.writableTypes (csv)</label>
        <input className="ui-input" value={memoryWritableTypesText} onChange={(event) => setMemoryWritableTypesText(event.target.value)} />
        <label className="ui-label">policy.sessionOnlyTypes (csv)</label>
        <input className="ui-input" value={memorySessionOnlyTypesText} onChange={(event) => setMemorySessionOnlyTypesText(event.target.value)} />
        <label className="ui-label" htmlFor="agent-memory-retention">Retention mode</label>
        <select id="agent-memory-retention" className="ui-input" value={memoryRetentionMode} onChange={(event) => setMemoryRetentionMode(event.target.value as "disabled" | "bounded")}>
          {Object.values(AgentMemoryRetentionModes).map((mode) => (
            <option key={mode} value={mode}>{mode}</option>
          ))}
        </select>
        <label className="ui-label">policy.retention.maxDurableEntries</label>
        <input className="ui-input" value={memoryMaxDurableEntries} onChange={(event) => setMemoryMaxDurableEntries(event.target.value)} />
        <button className="ui-button ui-button--secondary ui-button--sm" disabled={props.isBusy} onClick={() => {
          props.onSaveMemory({
            agentId: agent.id,
            assets: memoryAssetsText.split("\n").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
              const [assetId = "", assetVersionId = "", memoryType = AgentMemoryTypes.working, lineageTag = ""] = entry.split("|");
              return {
                assetId,
                assetVersionId: assetVersionId.trim() || undefined,
                memoryType: memoryType.trim() as AgentMemoryType,
                lineageTag: lineageTag.trim() || undefined,
              };
            }),
            retrieval: {
              strategy: memoryStrategy,
              maxEntries: Number(memoryMaxEntries),
              requiredTags: fromCsv(memoryRequiredTags),
              memoryTypes: fromCsv(memoryTypesText) as ReadonlyArray<AgentMemoryType>,
            },
            policy: {
              retrievableTypes: fromCsv(memoryRetrievableTypesText) as ReadonlyArray<AgentMemoryType>,
              writableTypes: fromCsv(memoryWritableTypesText) as ReadonlyArray<AgentMemoryType>,
              sessionOnlyTypes: fromCsv(memorySessionOnlyTypesText) as ReadonlyArray<AgentMemoryType>,
              retention: {
                mode: memoryRetentionMode,
                maxDurableEntries: memoryMaxDurableEntries ? Number(memoryMaxDurableEntries) : undefined,
              },
            },
            revision: agent.memory.revision,
          });
        }}>Save memory</button>
      </details>

      <details className="ui-card ui-stack ui-stack--sm" open>
        <summary><strong>Strategy</strong></summary>
        <label className="ui-label" htmlFor="agent-strategy">Planning strategy</label>
        <select
          id="agent-strategy"
          className="ui-input"
          value={`${strategy.strategyId}@${strategy.mode}`}
          onChange={(event) => {
            const [strategyId, mode] = event.target.value.split("@");
            setStrategy({ strategyId, mode: mode as AgentPlanningStrategy["mode"] });
          }}
        >
          {SupportedAgentPlanningStrategies.map((item) => (
            <option key={`${item.strategyId}@${item.mode}`} value={`${item.strategyId}@${item.mode}`}>
              {item.strategyId}@{item.mode}
            </option>
          ))}
        </select>
        <button className="ui-button ui-button--secondary ui-button--sm" disabled={props.isBusy} onClick={() => props.onSaveStrategy(strategy)}>Save strategy</button>
      </details>
    </section>
  );
}
