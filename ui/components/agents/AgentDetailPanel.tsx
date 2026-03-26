import { useEffect, useState } from "react";
import type { AgentGoalPriorityLevel } from "../../../domain/agents/AgentGoal";
import { AgentPlanningStrategyModes, SupportedAgentPlanningStrategies, type AgentPlanningStrategy } from "../../../domain/agents/Agent";
import type { AgentMemoryConfiguration } from "../../../domain/agents/AgentMemory";
import type { AgentToolAccessPolicy, AgentPolicy } from "../../../domain/agents/AgentPolicy";
import type { AgentLaunchReadModel } from "../../../application/agents/contracts/AgentRunContracts";
import type { ConfigureAgentGoalsRequest } from "../../../application/agents/ConfigureAgentGoalsUseCase";
import type { AgentStudioSnapshotReadModel } from "../../../infrastructure/api/agents/AgentStudioBackendApi";

interface AgentDetailPanelProps {
  readonly snapshot?: AgentStudioSnapshotReadModel;
  readonly latestLaunch?: AgentLaunchReadModel;
  readonly isBusy: boolean;
  readonly onLaunch: () => void;
  readonly onCancelLatest: () => void;
  readonly onSaveGoals: (request: ConfigureAgentGoalsRequest) => void;
  readonly onSavePolicy: (policy: AgentPolicy) => void;
  readonly onSaveTools: (tools: AgentToolAccessPolicy) => void;
  readonly onSaveMemory: (memory: AgentMemoryConfiguration) => void;
  readonly onSaveStrategy: (strategy: AgentPlanningStrategy) => void;
}

export function AgentDetailPanel(props: AgentDetailPanelProps): JSX.Element {
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [goalObjective, setGoalObjective] = useState("");
  const [newGoalId, setNewGoalId] = useState("");
  const [newGoalObjective, setNewGoalObjective] = useState("");
  const [policyJson, setPolicyJson] = useState("{}");
  const [toolsText, setToolsText] = useState("");
  const [memoryJson, setMemoryJson] = useState("{}");
  const [strategy, setStrategy] = useState<AgentPlanningStrategy>({ strategyId: "deterministic", mode: AgentPlanningStrategyModes.deterministicLinear });

  useEffect(() => {
    const agent = props.snapshot?.agent.agent;
    if (!agent) {
      return;
    }
    setPolicyJson(JSON.stringify(agent.policy, null, 2));
    setToolsText(agent.toolAccess.allowedToolIds.join("\n"));
    setMemoryJson(JSON.stringify({
      agentId: agent.id,
      assets: agent.memory.assets,
      retrieval: agent.memory.retrieval,
      policy: {
        maxRetrievalEntries: agent.memory.policy.maxRetrievalEntries,
        retrievableTypes: agent.memory.policy.retrievableTypes,
        writableTypes: agent.memory.policy.writableTypes,
        sessionOnlyTypes: agent.memory.policy.sessionOnlyTypes,
        retention: {
          mode: agent.memory.policy.retentionMode,
          maxDurableEntries: agent.memory.policy.maxDurableEntries,
        },
      },
      revision: agent.memory.revision,
    }, null, 2));
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

  const selectedGoal = agent.goals.find((goal) => goal.id === selectedGoalId);

  return (
    <section className="ui-stack ui-stack--sm" data-testid="agent-detail-panel">
      <div className="ui-card ui-stack ui-stack--sm">
        <h2 className="ui-heading-2">{agent.name}</h2>
        <p className="ui-text-secondary">{agent.id} — {agent.status}</p>
        <div className="ui-row ui-row--wrap">
          <button className="ui-button ui-button--primary ui-button--sm" onClick={props.onLaunch} disabled={props.isBusy || !props.snapshot.capabilities.launch}>Launch agent</button>
          <button className="ui-button ui-button--secondary ui-button--sm" onClick={props.onCancelLatest} disabled={props.isBusy || !props.snapshot.sessions[0]}>Cancel latest run</button>
        </div>
        {props.latestLaunch ? <p className="ui-text-secondary">Latest launch: {props.latestLaunch.launch.executionId} ({props.latestLaunch.launch.status})</p> : null}
      </div>

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
        <textarea className="ui-input" rows={12} value={policyJson} onChange={(event) => setPolicyJson(event.target.value)} />
        <button className="ui-button ui-button--secondary ui-button--sm" disabled={props.isBusy} onClick={() => props.onSavePolicy(JSON.parse(policyJson) as AgentPolicy)}>Save policy</button>
      </details>

      <details className="ui-card ui-stack ui-stack--sm" open>
        <summary><strong>Tools</strong></summary>
        <textarea className="ui-input" rows={6} value={toolsText} onChange={(event) => setToolsText(event.target.value)} />
        <button
          className="ui-button ui-button--secondary ui-button--sm"
          disabled={props.isBusy}
          onClick={() => {
            const allowedToolIds = toolsText.split("\n").map((value) => value.trim()).filter(Boolean);
            props.onSaveTools({
              allowedToolIds,
              allowedMcpTools: agent.policy.toolAccess.allowedMcpTools,
              scopeConstraints: agent.policy.toolAccess.scopeConstraints,
            });
          }}
        >Save tools</button>
      </details>

      <details className="ui-card ui-stack ui-stack--sm" open>
        <summary><strong>Memory</strong></summary>
        <textarea className="ui-input" rows={14} value={memoryJson} onChange={(event) => setMemoryJson(event.target.value)} />
        <button className="ui-button ui-button--secondary ui-button--sm" disabled={props.isBusy} onClick={() => props.onSaveMemory(JSON.parse(memoryJson) as AgentMemoryConfiguration)}>Save memory</button>
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
