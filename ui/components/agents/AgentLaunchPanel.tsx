import { useEffect, useMemo, useState } from "react";
import {
  AgentTriggerKinds,
  type AgentRunControlAction,
  type AgentRunRequest,
  type AgentRunTrigger,
  type AgentSessionSummaryReadModel,
} from "../../../application/agents/contracts/AgentRunContracts";
import type { TriggerAgentLaunchRequest } from "../../../application/agents/TriggerAgentLaunchUseCase";
import type { AgentLaunchReadModel } from "../../../application/agents/contracts/AgentRunContracts";
import type { AgentStudioSnapshotReadModel } from "../../../infrastructure/api/agents/AgentStudioBackendApi";
import { AgentRunControls } from "./AgentRunControls";
import { TriggerSelector } from "./TriggerSelector";
import { TriggerConfigFields } from "./TriggerConfigFields";

interface AgentLaunchPanelProps {
  readonly snapshot?: AgentStudioSnapshotReadModel;
  readonly latestLaunch?: AgentLaunchReadModel;
  readonly selectedSession?: AgentSessionSummaryReadModel;
  readonly isBusy: boolean;
  readonly pendingControlAction?: AgentRunControlAction;
  readonly onLaunch: (request: AgentRunRequest) => void;
  readonly onTriggerLaunch: (request: TriggerAgentLaunchRequest) => void;
  readonly onControlRun: (sessionId: string, action: AgentRunControlAction) => void;
}

function parseKvRows(text: string): Readonly<Record<string, string>> {
  const pairs = text
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key = "", ...valueParts] = entry.split("=");
      return [key.trim(), valueParts.join("=").trim()] as const;
    })
    .filter(([key, value]) => key.length > 0 && value.length > 0);
  return Object.fromEntries(pairs);
}

export function AgentLaunchPanel(props: AgentLaunchPanelProps): JSX.Element {
  const [inputText, setInputText] = useState("");
  const [contextText, setContextText] = useState("");
  const [metadataText, setMetadataText] = useState("");
  const [triggerKind, setTriggerKind] = useState<"manual" | "backend">(AgentTriggerKinds.manual);
  const [triggerSource, setTriggerSource] = useState("");
  const [triggerInvokedBy, setTriggerInvokedBy] = useState("");

  useEffect(() => {
    if (!props.latestLaunch) {
      return;
    }
    setInputText(Object.entries(props.latestLaunch.binding.input).map(([k, v]) => `${k}=${String(v)}`).join("\n"));
    setContextText(Object.entries(props.latestLaunch.binding.contextOverrides).map(([k, v]) => `${k}=${String(v)}`).join("\n"));
    setMetadataText(Object.entries(props.latestLaunch.binding.metadata).map(([k, v]) => `${k}=${v}`).join("\n"));
    setTriggerKind(props.latestLaunch.binding.trigger.kind);
    setTriggerInvokedBy(props.latestLaunch.binding.trigger.invokedBy ?? "");
    setTriggerSource(props.latestLaunch.binding.trigger.source ?? "");
  }, [props.latestLaunch?.launch.executionId]);

  const trigger = useMemo<AgentRunTrigger>(() => ({
    kind: triggerKind,
    invokedBy: triggerInvokedBy.trim() || undefined,
    source: triggerSource.trim() || undefined,
  }), [triggerInvokedBy, triggerKind, triggerSource]);

  const isBackendTriggerInvalid = trigger.kind === AgentTriggerKinds.backend && !trigger.source;

  if (!props.snapshot) {
    return null;
  }

  return (
    <div className="ui-card ui-stack ui-stack--sm" data-testid="agent-launch-panel">
      <h3 className="ui-heading-3">Launch & run control</h3>
      <label className="ui-label">Run input (key=value per line)</label>
      <textarea className="ui-input" rows={3} value={inputText} onChange={(event) => setInputText(event.target.value)} />
      <label className="ui-label">Context overrides (key=value per line)</label>
      <textarea className="ui-input" rows={3} value={contextText} onChange={(event) => setContextText(event.target.value)} />
      <label className="ui-label">Metadata (key=value per line)</label>
      <textarea className="ui-input" rows={3} value={metadataText} onChange={(event) => setMetadataText(event.target.value)} />

      <TriggerSelector value={triggerKind} disabled={props.isBusy} onChange={setTriggerKind} />
      <TriggerConfigFields
        triggerKind={triggerKind}
        invokedBy={triggerInvokedBy}
        source={triggerSource}
        disabled={props.isBusy}
        onInvokedByChange={setTriggerInvokedBy}
        onSourceChange={setTriggerSource}
      />
      {isBackendTriggerInvalid ? <p className="ui-text-secondary">Backend trigger requires trigger.source.</p> : null}

      <div className="ui-row ui-row--wrap">
        <button
          className="ui-button ui-button--primary ui-button--sm"
          disabled={props.isBusy || !props.snapshot.capabilities.launch || isBackendTriggerInvalid}
          onClick={() => {
            const request = {
              agentId: props.snapshot!.agent.agent.id,
              input: parseKvRows(inputText),
              contextOverrides: parseKvRows(contextText),
              metadata: parseKvRows(metadataText),
              trigger,
            };
            if (trigger.kind === AgentTriggerKinds.backend && props.snapshot?.capabilities.triggerLaunch) {
              props.onTriggerLaunch(request as TriggerAgentLaunchRequest);
              return;
            }
            props.onLaunch(request);
          }}
        >
          Launch agent
        </button>
      </div>

      <AgentRunControls
        session={props.selectedSession}
        controls={props.snapshot.capabilities.controls}
        isBusy={props.isBusy}
        pendingAction={props.pendingControlAction}
        onControlRun={props.onControlRun}
      />

      {props.latestLaunch ? (
        <p className="ui-text-secondary">
          Latest launch: {props.latestLaunch.launch.executionId} ({props.latestLaunch.launch.status}),
          steps {props.latestLaunch.operational.executionProgress.completedStepCount}/{props.latestLaunch.operational.executionProgress.attemptedStepCount},
          memory writes {props.latestLaunch.operational.memoryWriteSummary.persistedCount}
        </p>
      ) : null}
    </div>
  );
}
