import type { Agent } from "../../../domain/agents/Agent";
import {
  AgentExecutionSessionStatuses,
  createAgentExecutionSession,
  transitionAgentExecutionSession,
  type AgentExecutionSession,
} from "../../../domain/agents/AgentExecutionSession";
import { mapAgentPlanToBackbone } from "../contracts/AgentExecutionMapping";
import type { AgentPlanningInterface } from "../contracts/AgentPlanningStrategy";
import type { AgentMemoryRetrievalService } from "../contracts/AgentMemoryRetrieval";
import type { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import type { AgentExecutionResult } from "../models/AgentExecutionResult";
import type { IAgentExecutionSessionRepository } from "../../ports/interfaces/IAgentExecutionSessionRepository";
import {
  DefaultAgentRuntimeRetryPolicy,
  isAgentRuntimeFailureRetryable,
  type AgentRuntimeFailure,
  type AgentRuntimeRetryPolicy,
} from "../contracts/AgentRuntimeFailurePolicy";
import { AgentRuntimeEventTypes, type AgentRuntimeProgressEvent } from "../contracts/AgentRuntimeProgress";
import { AgentWorkingMemoryService } from "./AgentWorkingMemoryService";
import { AgentMemoryWriteService, type AgentMemoryWriteResult } from "./AgentMemoryWriteService";
import type { AgentWorkingMemory } from "../../../domain/agents/AgentWorkingMemory";
import { AssetId } from "../../../domain/assets/AssetId";
import type { AgentMcpToolGovernanceService } from "./AgentMcpToolGovernanceService";

export interface AgentRunnerRequest {
  readonly agent: Agent;
  readonly retryPolicy?: AgentRuntimeRetryPolicy;
  readonly onProgress?: (event: AgentRuntimeProgressEvent) => void;
}

export interface AgentRunnerStepResult {
  readonly stepId: string;
  readonly goalId?: string;
  readonly toolId: string;
  readonly action: string;
  readonly status: "completed" | "failed" | "cancelled" | "blocked";
  readonly output?: string;
  readonly outputAssetId?: AssetId;
  readonly errorMessage?: string;
  readonly attempts: number;
}

export interface AgentRunnerResult {
  readonly agentId: string;
  readonly executionId: string;
  readonly planId: string;
  readonly session: AgentExecutionSession;
  readonly status: "completed" | "failed" | "cancelled" | "blocked";
  readonly outcomes: ReadonlyArray<AgentRunnerStepResult>;
  readonly finalOutput?: string;
  readonly workingMemory: AgentWorkingMemory;
  readonly memoryWrite: AgentMemoryWriteResult;
  readonly failure?: AgentRuntimeFailure;
  readonly events: ReadonlyArray<AgentRuntimeProgressEvent>;
}

export class AgentRunnerService {
  constructor(
    private readonly planner: AgentPlanningInterface,
    private readonly executeAgentToolsUseCase: ExecuteAgentToolsUseCase,
    private readonly memoryRetrievalService: AgentMemoryRetrievalService,
    private readonly memoryWriteService: AgentMemoryWriteService,
    private readonly workingMemoryService: AgentWorkingMemoryService = new AgentWorkingMemoryService(),
    private readonly governanceService?: AgentMcpToolGovernanceService,
    private readonly sessionRepository?: IAgentExecutionSessionRepository,
  ) {}

  public async run(request: AgentRunnerRequest): Promise<AgentRunnerResult> {
    const { agent } = request;
    const retryPolicy = this.normalizeRetryPolicy(request.retryPolicy);
    const events: AgentRuntimeProgressEvent[] = [];
    const executionId = `agent:${agent.id}:${Date.now()}`;

    const emit = (event: Omit<AgentRuntimeProgressEvent, "occurredAt" | "executionId" | "agentId">) => {
      const fullEvent = Object.freeze({
        ...event,
        occurredAt: new Date().toISOString(),
        executionId,
        agentId: agent.id,
      });
      events.push(fullEvent);
      request.onProgress?.(fullEvent);
    };

    emit({ type: AgentRuntimeEventTypes.executionStarted });

    const plan = await this.planner.plan({ agent });
    emit({ type: AgentRuntimeEventTypes.planPrepared, planId: plan.planId, metadata: { stepCount: plan.steps.length } });

    let session = createAgentExecutionSession({
      id: `agent-session:${agent.id}:${plan.planId}`,
      agentId: agent.id,
      planId: plan.planId,
      status: AgentExecutionSessionStatuses.pending,
    });
    session = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.ready });
    session = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.running });
    session = await this.persistSession(session);

    if (this.governanceService) {
      const governance = await this.governanceService.validatePlan(agent, plan);
      emit({
        type: AgentRuntimeEventTypes.governanceValidated,
        planId: plan.planId,
        metadata: { allowed: governance.allowed, decision: governance.decision, issueCount: governance.issues.length },
      });
      if (!governance.allowed) {
        const failure: AgentRuntimeFailure = {
          kind: this.toGovernanceFailureKind(governance.decision as "approval-required" | "denied" | "unavailable" | "incompatible"),
          message: governance.issues.map((issue) => issue.message).join("; "),
          governanceDecision: governance.decision,
          retryable: false,
        };
        emit({ type: AgentRuntimeEventTypes.executionBlocked, planId: plan.planId, status: "blocked", metadata: { decision: governance.decision } });
        const blockedSession = await this.completeSession(session, "failed");
        return Object.freeze({
          agentId: agent.id,
          executionId,
          planId: plan.planId,
          session: blockedSession,
          status: "blocked",
          outcomes: Object.freeze([]),
          workingMemory: this.workingMemoryService.createFromRetrievedMemory({
            sessionId: blockedSession.id,
            agent,
            plan,
            retrievedMemory: Object.freeze([]),
          }),
          memoryWrite: Object.freeze({ persisted: Object.freeze([]), skipped: Object.freeze([]) }),
          failure,
          events: Object.freeze(events),
        });
      }
    }

    const retrievedMemory = await this.memoryRetrievalService.retrieveMemory({ agent });
    let workingMemory = this.workingMemoryService.createFromRetrievedMemory({
      sessionId: session.id,
      agent,
      plan,
      retrievedMemory,
    });

    const mapped = mapAgentPlanToBackbone({ session, plan });
    emit({ type: AgentRuntimeEventTypes.unitMapped, planId: plan.planId, metadata: { unitCount: mapped.plan.units.length } });

    const outcomes: AgentRunnerStepResult[] = [];
    let finalStatus: AgentRunnerResult["status"] = "completed";
    let finalOutput = "";
    let terminalFailure: AgentRuntimeFailure | undefined;

    for (const step of plan.steps) {
      let attempts = 0;
      let stepResult: AgentExecutionResult | undefined;
      let classifiedFailure: AgentRuntimeFailure | undefined;

      while (attempts < retryPolicy.maxAttemptsPerStep) {
        attempts += 1;
        stepResult = await this.executeAgentToolsUseCase.execute({
          input: step.intent.action,
          executionId: `${executionId}:${step.stepId}:attempt:${attempts}`,
          maxIterations: 1,
          toolSelection: {
            mode: "capabilityIds",
            capabilityIds: [step.toolId],
          },
          metadata: Object.freeze({
            origin: "agent-runner-service",
            agentId: agent.id,
            planId: plan.planId,
            stepId: step.stepId,
            expectedOutputKey: step.intent.expectedOutputKey ?? null,
          }),
        });

        classifiedFailure = this.classifyExecutionFailure(step.stepId, stepResult);
        if (!classifiedFailure || !isAgentRuntimeFailureRetryable(classifiedFailure) || attempts >= retryPolicy.maxAttemptsPerStep) {
          break;
        }
      }

      const result = stepResult!;
      const stepOutput = result.finalOutput ?? result.steps[0]?.resultText;
      const outputAssetIdRaw = typeof result.metadata?.outputAssetId === "string"
        ? result.metadata.outputAssetId
        : undefined;
      const outputAssetId = outputAssetIdRaw ? AssetId.from(outputAssetIdRaw) : undefined;
      const status = result.status === "completed"
        ? "completed"
        : result.status === "cancelled"
          ? "cancelled"
          : "failed";
      outcomes.push(Object.freeze({
        stepId: step.stepId,
        goalId: step.goalId,
        toolId: step.toolId,
        action: step.intent.action,
        status,
        output: stepOutput,
        outputAssetId,
        errorMessage: result.errorMessage,
        attempts,
      }));
      emit({ type: AgentRuntimeEventTypes.unitCompleted, planId: plan.planId, stepId: step.stepId, status, metadata: { attempts } });

      workingMemory = this.workingMemoryService.appendExecutionOutcome(workingMemory, {
        stepId: step.stepId,
        status: result.status,
        output: stepOutput,
        outputAssetId,
        errorMessage: result.errorMessage,
      });
      finalOutput = [finalOutput, stepOutput].filter(Boolean).join("\n");

      if (result.status !== "completed") {
        finalStatus = result.status === "cancelled" ? "cancelled" : "failed";
        terminalFailure = classifiedFailure ?? {
          kind: result.status === "cancelled" ? "cancelled" : "execution-failed",
          stepId: step.stepId,
          message: result.errorMessage ?? "Execution failed.",
          retryable: false,
        };
        break;
      }
    }

    if (terminalFailure && finalStatus === "failed") {
      emit({ type: AgentRuntimeEventTypes.executionFailed, planId: plan.planId, status: "failed", metadata: { failureKind: terminalFailure.kind } });
    }

    const memoryWrite = await this.memoryWriteService.writeExecutionOutcome(agent, plan, {
      agentId: agent.id,
      executionId,
      planId: plan.planId,
      status: finalStatus,
      outcomes: Object.freeze(outcomes.map((outcome) => Object.freeze({
        stepId: outcome.stepId,
        status: outcome.status,
        output: outcome.output,
        errorMessage: outcome.errorMessage,
        outputAssetId: outcome.outputAssetId,
      }))),
      finalOutput: finalOutput || undefined,
      workingMemory,
    });
    emit({ type: AgentRuntimeEventTypes.memoryPersisted, planId: plan.planId, metadata: { persistedEntries: memoryWrite.persisted.length } });

    const terminalSession = await this.completeSession(session, finalStatus === "completed" ? "completed" : finalStatus === "cancelled" ? "cancelled" : "failed");

    return Object.freeze({
      agentId: agent.id,
      executionId,
      planId: plan.planId,
      session: terminalSession,
      status: finalStatus,
      outcomes: Object.freeze(outcomes),
      finalOutput: finalOutput || undefined,
      workingMemory,
      memoryWrite,
      failure: terminalFailure,
      events: Object.freeze(events),
    });
  }

  private normalizeRetryPolicy(retryPolicy: AgentRuntimeRetryPolicy | undefined): AgentRuntimeRetryPolicy {
    const attempts = retryPolicy?.maxAttemptsPerStep ?? DefaultAgentRuntimeRetryPolicy.maxAttemptsPerStep;
    return Object.freeze({ maxAttemptsPerStep: Math.max(1, Math.min(5, Math.trunc(attempts))) });
  }

  private classifyExecutionFailure(stepId: string, result: AgentExecutionResult): AgentRuntimeFailure | undefined {
    if (result.status === "completed") {
      return undefined;
    }
    if (result.status === "cancelled") {
      return {
        kind: "cancelled",
        stepId,
        message: result.errorMessage ?? "Execution cancelled.",
        retryable: false,
      };
    }
    const detail = `${result.errorMessage ?? ""} ${result.stoppedReason}`.toLowerCase();
    const retryable = /timeout|temporar|throttle|rate limit|busy/.test(detail);
    return {
      kind: "execution-failed",
      stepId,
      message: result.errorMessage ?? "Execution failed.",
      retryable,
    };
  }

  private toGovernanceFailureKind(decision: "approval-required" | "denied" | "unavailable" | "incompatible"): AgentRuntimeFailure["kind"] {
    if (decision === "approval-required") {
      return "governance-approval-required";
    }
    if (decision === "unavailable") {
      return "governance-unavailable";
    }
    if (decision === "incompatible") {
      return "governance-incompatible";
    }
    return "governance-denied";
  }

  private async persistSession(session: AgentExecutionSession): Promise<AgentExecutionSession> {
    if (!this.sessionRepository) {
      return session;
    }
    return this.sessionRepository.save(session);
  }

  private async completeSession(
    session: AgentExecutionSession,
    status: "completed" | "failed" | "cancelled",
  ): Promise<AgentExecutionSession> {
    const transitioned = transitionAgentExecutionSession(session, {
      status: status === "completed"
        ? AgentExecutionSessionStatuses.completed
        : status === "failed"
          ? AgentExecutionSessionStatuses.failed
          : AgentExecutionSessionStatuses.cancelled,
    });
    return this.persistSession(transitioned);
  }
}
