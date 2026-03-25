import type { Agent } from "../../../domain/agents/Agent";
import {
  AgentExecutionSessionStatuses,
  createAgentExecutionSession,
  transitionAgentExecutionSession,
  type AgentExecutionStepOutcome,
  type AgentExecutionSession,
  type AgentExecutionTerminalState,
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
  readonly terminalState: AgentExecutionTerminalState;
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
    emit({ type: AgentRuntimeEventTypes.sessionStarted, planId: plan.planId, metadata: { sessionId: session.id } });
    session = await this.persistSession(session);
    emit({
      type: AgentRuntimeEventTypes.sessionPersisted,
      planId: plan.planId,
      metadata: { sessionId: session.id, status: session.status },
    });
    session = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.ready });
    emit({
      type: AgentRuntimeEventTypes.sessionTransitioned,
      planId: plan.planId,
      metadata: { sessionId: session.id, status: AgentExecutionSessionStatuses.ready },
    });
    session = await this.persistSession(session);
    emit({
      type: AgentRuntimeEventTypes.sessionPersisted,
      planId: plan.planId,
      metadata: { sessionId: session.id, status: session.status },
    });
    session = transitionAgentExecutionSession(session, { status: AgentExecutionSessionStatuses.running });
    emit({
      type: AgentRuntimeEventTypes.sessionTransitioned,
      planId: plan.planId,
      metadata: { sessionId: session.id, status: AgentExecutionSessionStatuses.running },
    });
    session = await this.persistSession(session);
    emit({
      type: AgentRuntimeEventTypes.sessionPersisted,
      planId: plan.planId,
      metadata: { sessionId: session.id, status: session.status },
    });

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
        const blockedSession = await this.completeSession(
          session,
          "failed",
          executionId,
          emit,
          plan.planId,
          "blocked",
        );
        const terminalState = blockedSession.terminalState ?? Object.freeze({
          reason: "blocked",
          hadPartialProgress: false,
          completedStepCount: 0,
          attemptedStepCount: 0,
        });
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
          terminalState,
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
        emit({
          type: AgentRuntimeEventTypes.stepAttemptStarted,
          planId: plan.planId,
          stepId: step.stepId,
          metadata: { attempt: attempts, maxAttempts: retryPolicy.maxAttemptsPerStep, toolId: step.toolId },
        });
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

        classifiedFailure = this.classifyExecutionFailure(step.stepId, stepResult, retryPolicy);
        if (!classifiedFailure || !isAgentRuntimeFailureRetryable(classifiedFailure)) {
          break;
        }
        if (attempts < retryPolicy.maxAttemptsPerStep) {
          emit({
            type: AgentRuntimeEventTypes.retryScheduled,
            planId: plan.planId,
            stepId: step.stepId,
            metadata: { attempt: attempts, nextAttempt: attempts + 1, reason: classifiedFailure.message },
          });
          continue;
        }
        classifiedFailure = Object.freeze({
          ...classifiedFailure,
          retryable: false,
          retryExhausted: true,
        });
        emit({
          type: AgentRuntimeEventTypes.retryExhausted,
          planId: plan.planId,
          stepId: step.stepId,
          metadata: { attempts, maxAttempts: retryPolicy.maxAttemptsPerStep, reason: classifiedFailure.message },
        });
        break;
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
      if (status === "completed") {
        emit({ type: AgentRuntimeEventTypes.unitCompleted, planId: plan.planId, stepId: step.stepId, status, metadata: { attempts } });
      } else if (status === "cancelled") {
        emit({ type: AgentRuntimeEventTypes.unitCancelled, planId: plan.planId, stepId: step.stepId, status, metadata: { attempts } });
      } else {
        emit({ type: AgentRuntimeEventTypes.unitFailed, planId: plan.planId, stepId: step.stepId, status, metadata: { attempts } });
      }

      workingMemory = this.workingMemoryService.appendExecutionOutcome(workingMemory, {
        stepId: step.stepId,
        status: result.status,
        output: stepOutput,
        outputAssetId,
        errorMessage: result.errorMessage,
      });
      session = await this.appendStepOutcome(
        session,
        Object.freeze({
          stepId: step.stepId,
          status,
          attempts,
          toolId: step.toolId,
          output: stepOutput,
          outputAssetId,
          errorMessage: result.errorMessage,
        }),
        emit,
        plan.planId,
      );
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
      emit({
        type: AgentRuntimeEventTypes.executionFailed,
        planId: plan.planId,
        status: "failed",
        metadata: {
          failureKind: terminalFailure.kind,
          hadPartialProgress: outcomes.some((outcome) => outcome.status === "completed"),
        },
      });
    }

    const memoryWrite = await this.memoryWriteService.writeExecutionOutcome(agent, plan, {
      agentId: agent.id,
      executionId,
      planId: plan.planId,
      status: finalStatus,
      outcomes: Object.freeze(outcomes.map((outcome) => Object.freeze({
        stepId: outcome.stepId,
        status: outcome.status === "blocked" ? "failed" : outcome.status,
        output: outcome.output,
        errorMessage: outcome.errorMessage,
        outputAssetId: outcome.outputAssetId,
      }))),
      finalOutput: finalOutput || undefined,
      workingMemory,
    });
    emit({ type: AgentRuntimeEventTypes.memoryPersisted, planId: plan.planId, metadata: { persistedEntries: memoryWrite.persisted.length } });

    const terminalSession = await this.completeSession(
      session,
      finalStatus === "completed" ? "completed" : finalStatus === "cancelled" ? "cancelled" : "failed",
      executionId,
      emit,
      plan.planId,
    );
    const terminalState = terminalSession.terminalState ?? Object.freeze({
      reason: finalStatus === "completed" ? "completed" : finalStatus === "cancelled" ? "cancelled" : "failed",
      hadPartialProgress: terminalSession.stepOutcomes.some((outcome) => outcome.status === "completed")
        && finalStatus !== "completed",
      completedStepCount: terminalSession.stepOutcomes.filter((outcome) => outcome.status === "completed").length,
      attemptedStepCount: terminalSession.stepOutcomes.length,
    });
    if (finalStatus === "completed") {
      emit({ type: AgentRuntimeEventTypes.executionCompleted, planId: plan.planId, status: "completed" });
    } else if (finalStatus === "cancelled") {
      emit({ type: AgentRuntimeEventTypes.executionCancelled, planId: plan.planId, status: "cancelled" });
    }

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
      terminalState,
      failure: terminalFailure,
      events: Object.freeze(events),
    });
  }

  private normalizeRetryPolicy(retryPolicy: AgentRuntimeRetryPolicy | undefined): AgentRuntimeRetryPolicy {
    const attempts = retryPolicy?.maxAttemptsPerStep ?? DefaultAgentRuntimeRetryPolicy.maxAttemptsPerStep;
    return Object.freeze({ maxAttemptsPerStep: Math.max(1, Math.min(5, Math.trunc(attempts))) });
  }

  private classifyExecutionFailure(
    stepId: string,
    result: AgentExecutionResult,
    retryPolicy: AgentRuntimeRetryPolicy,
  ): AgentRuntimeFailure | undefined {
    if (result.status === "completed") {
      return undefined;
    }
    if (result.status === "cancelled") {
      return {
        kind: "cancelled",
        stepId,
        message: result.errorMessage ?? "Execution cancelled.",
        retryable: false,
        retryClassificationSource: "heuristic",
      };
    }
    const metadataRetryable = this.resolveMetadataRetryable(result);
    const baseFailure: AgentRuntimeFailure = {
      kind: "execution-failed",
      stepId,
      message: result.errorMessage ?? "Execution failed.",
      retryable: metadataRetryable ?? this.isHeuristicallyRetryable(result),
      retryClassificationSource: metadataRetryable === undefined ? "heuristic" : "result-metadata",
    };
    if (!retryPolicy.classifyFailure) {
      return baseFailure;
    }
    const classified = retryPolicy.classifyFailure({ stepId, result, fallback: baseFailure });
    const detail = `${result.errorMessage ?? ""} ${result.stoppedReason}`.toLowerCase();
    if (classified.kind !== "execution-failed") {
      return classified;
    }
    return Object.freeze({
      ...classified,
      retryClassificationSource: classified.retryClassificationSource ?? "policy",
      message: classified.message || (detail ? result.errorMessage ?? "Execution failed." : "Execution failed."),
    });
  }

  private resolveMetadataRetryable(result: AgentExecutionResult): boolean | undefined {
    if (!result.metadata) {
      return undefined;
    }
    const retryable = result.metadata.retryable;
    if (typeof retryable === "boolean") {
      return retryable;
    }
    const failureClass = result.metadata.failureClass;
    if (typeof failureClass === "string") {
      if (failureClass === "retryable") {
        return true;
      }
      if (failureClass === "non-retryable") {
        return false;
      }
    }
    return undefined;
  }

  private isHeuristicallyRetryable(result: AgentExecutionResult): boolean {
    const detail = `${result.errorMessage ?? ""} ${result.stoppedReason}`.toLowerCase();
    return /timeout|temporar|throttle|rate limit|busy|unavailable/.test(detail);
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
    executionId: string,
    emit?: (event: Omit<AgentRuntimeProgressEvent, "occurredAt" | "executionId" | "agentId">) => void,
    planId?: string,
    terminalReason?: AgentExecutionTerminalState["reason"],
  ): Promise<AgentExecutionSession> {
    const completedStepCount = session.stepOutcomes.filter((outcome) => outcome.status === "completed").length;
    const attemptedStepCount = session.stepOutcomes.length;
    const reason = terminalReason
      ?? (status === "completed" ? "completed" : status === "cancelled" ? "cancelled" : "failed");
    const transitioned = transitionAgentExecutionSession(session, {
      status: status === "completed"
        ? AgentExecutionSessionStatuses.completed
        : status === "failed"
          ? AgentExecutionSessionStatuses.failed
          : AgentExecutionSessionStatuses.cancelled,
      terminalState: {
        reason,
        hadPartialProgress: completedStepCount > 0 && reason !== "completed",
        completedStepCount,
        attemptedStepCount,
      },
      appendExecutionRun: {
        runId: executionId,
        planId: session.executionPlan?.planId,
        status: status === "completed"
          ? "completed"
          : status === "failed"
            ? "failed"
            : "cancelled",
      },
    });
    emit?.({
      type: AgentRuntimeEventTypes.sessionTransitioned,
      planId,
      metadata: { sessionId: session.id, status: transitioned.status },
    });
    const persisted = await this.persistSession(transitioned);
    emit?.({
      type: AgentRuntimeEventTypes.sessionPersisted,
      planId,
      metadata: { sessionId: session.id, status: persisted.status },
    });
    return persisted;
  }

  private async appendStepOutcome(
    session: AgentExecutionSession,
    outcome: AgentExecutionStepOutcome,
    emit?: (event: Omit<AgentRuntimeProgressEvent, "occurredAt" | "executionId" | "agentId">) => void,
    planId?: string,
  ): Promise<AgentExecutionSession> {
    const outputWithDiagnostics = transitionAgentExecutionSession(session, {
      status: session.status,
      appendStepOutcome: outcome,
      appendDiagnostic: outcome.outputAssetId ? { assetId: outcome.outputAssetId } : undefined,
    });
    const persisted = await this.persistSession(outputWithDiagnostics);
    emit?.({
      type: AgentRuntimeEventTypes.sessionPersisted,
      planId,
      metadata: { sessionId: session.id, status: persisted.status, stepOutcomes: persisted.stepOutcomes.length },
    });
    return persisted;
  }
}
