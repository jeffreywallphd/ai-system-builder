import { describe, expect, it } from "bun:test";
import {
  AuthoritativeServerStartupStageStates,
  createAuthoritativeServerBootstrapStageOrchestrator,
  AuthoritativeServerBootstrapStageOrchestratorError,
} from "../AuthoritativeServerBootstrapStageOrchestrator";
import { createStartupTracer, type StartupSpanLogger } from "@hosts/bootstrap/startupTracer";
import { AuthoritativeServerBootstrapStageIds } from "../AuthoritativeServerBootstrapStageContracts";

class CapturingStartupSpanLogger implements StartupSpanLogger {
  public readonly infoEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly errorEvents: Array<Readonly<Record<string, unknown>>> = [];

  public info(payload: Readonly<Record<string, unknown>>): void {
    this.infoEvents.push(payload);
  }

  public error(payload: Readonly<Record<string, unknown>>): void {
    this.errorEvents.push(payload);
  }
}

describe("AuthoritativeServerBootstrapStageOrchestrator", () => {
  it("runs stages sequentially and emits stage-aligned spans", async () => {
    const logger = new CapturingStartupSpanLogger();
    let now = 100;
    const tracer = createStartupTracer({
      logger,
      traceId: "stage-orchestrator-test-trace",
      startupReason: "stage-orchestrator-test",
      clock: () => now,
    });
    const rootSpan = tracer.startSpan("authoritative-server-bootstrap");
    const orchestrator = createAuthoritativeServerBootstrapStageOrchestrator({
      tracer,
      parentSpan: rootSpan,
    });
    const observedStageIds: string[] = [];
    const initialStatus = orchestrator.getStatus();
    expect(initialStatus.stages.map((stage) => stage.state)).toEqual([
      AuthoritativeServerStartupStageStates.pending,
      AuthoritativeServerStartupStageStates.pending,
      AuthoritativeServerStartupStageStates.pending,
      AuthoritativeServerStartupStageStates.pending,
    ]);
    expect(initialStatus.stages.map((stage) => stage.stageId)).toEqual([
      AuthoritativeServerBootstrapStageIds.services,
      AuthoritativeServerBootstrapStageIds.security,
      AuthoritativeServerBootstrapStageIds.persistence,
      AuthoritativeServerBootstrapStageIds.transport,
    ]);

    await orchestrator.runStage({
      stageId: AuthoritativeServerBootstrapStageIds.services,
      run: () => {
        observedStageIds.push(AuthoritativeServerBootstrapStageIds.services);
        const status = orchestrator.getStatus();
        expect(status.stages[0]?.state).toBe(AuthoritativeServerStartupStageStates.running);
        expect(status.stages[1]?.state).toBe(AuthoritativeServerStartupStageStates.pending);
        now += 5;
      },
    });
    expect(orchestrator.getStatus().stages[0]?.state).toBe(AuthoritativeServerStartupStageStates.success);
    await orchestrator.runStage({
      stageId: AuthoritativeServerBootstrapStageIds.security,
      run: () => {
        observedStageIds.push(AuthoritativeServerBootstrapStageIds.security);
        const status = orchestrator.getStatus();
        expect(status.stages[1]?.state).toBe(AuthoritativeServerStartupStageStates.running);
        now += 5;
      },
    });
    expect(orchestrator.getStatus().stages[1]?.state).toBe(AuthoritativeServerStartupStageStates.success);
    await orchestrator.runStage({
      stageId: AuthoritativeServerBootstrapStageIds.persistence,
      run: () => {
        observedStageIds.push(AuthoritativeServerBootstrapStageIds.persistence);
        const status = orchestrator.getStatus();
        expect(status.stages[2]?.state).toBe(AuthoritativeServerStartupStageStates.running);
        now += 5;
      },
    });
    expect(orchestrator.getStatus().stages[2]?.state).toBe(AuthoritativeServerStartupStageStates.success);
    await orchestrator.runStage({
      stageId: AuthoritativeServerBootstrapStageIds.transport,
      run: () => {
        observedStageIds.push(AuthoritativeServerBootstrapStageIds.transport);
        const status = orchestrator.getStatus();
        expect(status.stages[3]?.state).toBe(AuthoritativeServerStartupStageStates.running);
        now += 5;
      },
    });
    expect(orchestrator.getStatus().stages[3]?.state).toBe(AuthoritativeServerStartupStageStates.success);
    rootSpan.complete();

    expect(observedStageIds).toEqual([
      AuthoritativeServerBootstrapStageIds.services,
      AuthoritativeServerBootstrapStageIds.security,
      AuthoritativeServerBootstrapStageIds.persistence,
      AuthoritativeServerBootstrapStageIds.transport,
    ]);
    const completedStageSpanNames = logger.infoEvents
      .filter((event) => event.event === "startup.span.completed")
      .map((event) => event.spanName)
      .filter((name) => (
        name === AuthoritativeServerBootstrapStageIds.services
        || name === AuthoritativeServerBootstrapStageIds.security
        || name === AuthoritativeServerBootstrapStageIds.persistence
        || name === AuthoritativeServerBootstrapStageIds.transport
      ));
    expect(completedStageSpanNames).toEqual([
      AuthoritativeServerBootstrapStageIds.services,
      AuthoritativeServerBootstrapStageIds.security,
      AuthoritativeServerBootstrapStageIds.persistence,
      AuthoritativeServerBootstrapStageIds.transport,
    ]);
    const servicesSpan = logger.infoEvents.find((event) => event.spanName === AuthoritativeServerBootstrapStageIds.services);
    const servicesMetadata = servicesSpan?.metadata as Record<string, unknown> | undefined;
    expect(servicesMetadata?.stageId).toBe(AuthoritativeServerBootstrapStageIds.services);
    expect(servicesMetadata?.stageSequence).toBe(1);
    expect(servicesMetadata?.stageCount).toBe(4);
  });

  it("fails when stage execution order does not match orchestrator sequence", async () => {
    const tracer = createStartupTracer({
      traceId: "stage-orchestrator-order-failure-trace",
      startupReason: "stage-orchestrator-order-failure",
    });
    const orchestrator = createAuthoritativeServerBootstrapStageOrchestrator({
      tracer,
    });

    await expect(orchestrator.runStage({
      stageId: AuthoritativeServerBootstrapStageIds.security,
      run: () => {},
    })).rejects.toThrow(AuthoritativeServerBootstrapStageOrchestratorError);
  });

  it("marks stage as failed and leaves later stages pending when execution errors", async () => {
    const tracer = createStartupTracer({
      traceId: "stage-orchestrator-stage-failure-trace",
      startupReason: "stage-orchestrator-stage-failure",
    });
    const orchestrator = createAuthoritativeServerBootstrapStageOrchestrator({
      tracer,
    });

    await expect(orchestrator.runStage({
      stageId: AuthoritativeServerBootstrapStageIds.services,
      run: () => {
        throw new Error("services failed");
      },
    })).rejects.toThrow("services failed");

    const status = orchestrator.getStatus();
    expect(status.stages[0]?.state).toBe(AuthoritativeServerStartupStageStates.failed);
    expect(status.stages[1]?.state).toBe(AuthoritativeServerStartupStageStates.pending);
    expect(status.stages[2]?.state).toBe(AuthoritativeServerStartupStageStates.pending);
    expect(status.stages[3]?.state).toBe(AuthoritativeServerStartupStageStates.pending);
  });
});
