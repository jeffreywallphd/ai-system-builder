import { describe, expect, it } from "bun:test";
import {
  AuthoritativeServerBootstrapPipelineStageAdoptionStates,
  AuthoritativeServerBootstrapPipelineStageDefinitions,
  AuthoritativeServerBootstrapPipelineStageIds,
  AuthoritativeServerBootstrapReadinessStates,
  AuthoritativeServerBootstrapStageExecutionStates,
  createAuthoritativeServerBootstrapPipelineState,
  deriveAuthoritativeServerBootstrapReadiness,
  listAuthoritativeServerBootstrapPipelineStages,
  updateAuthoritativeServerBootstrapPipelineStageState,
} from "../composition/contracts/AuthoritativeServerBootstrapPipelineStateModel";

describe("AuthoritativeServerBootstrapPipelineStateModel", () => {
  it("defines explicit staged bootstrap order with deterministic sequence numbers", () => {
    const stages = listAuthoritativeServerBootstrapPipelineStages();
    expect(stages.map((stage) => stage.stageId)).toEqual([
      AuthoritativeServerBootstrapPipelineStageIds.configurationLoad,
      AuthoritativeServerBootstrapPipelineStageIds.securityMaterialResolution,
      AuthoritativeServerBootstrapPipelineStageIds.persistenceInitialization,
      AuthoritativeServerBootstrapPipelineStageIds.migrationExecution,
      AuthoritativeServerBootstrapPipelineStageIds.subsystemComposition,
      AuthoritativeServerBootstrapPipelineStageIds.readinessVerification,
      AuthoritativeServerBootstrapPipelineStageIds.transportStartup,
      AuthoritativeServerBootstrapPipelineStageIds.shutdownPreparation,
    ]);
    expect(stages.map((stage) => stage.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(stages.every((stage) => stage.description.length > 10)).toBeTrue();
    expect(stages.every((stage) => stage.ownedModules.length > 0)).toBeTrue();
    expect(stages[7]?.adoptionState).toBe(AuthoritativeServerBootstrapPipelineStageAdoptionStates.active);
  });

  it("creates initial pipeline state as pending and not-ready across all stages", () => {
    const state = createAuthoritativeServerBootstrapPipelineState();
    expect(state.stages).toHaveLength(8);
    expect(state.stages.every((stage) => stage.executionState === AuthoritativeServerBootstrapStageExecutionStates.pending)).toBeTrue();
    expect(state.stages.every((stage) => stage.readinessState === AuthoritativeServerBootstrapReadinessStates.notReady)).toBeTrue();
    expect(state.readiness).toBe(AuthoritativeServerBootstrapReadinessStates.notReady);
  });

  it("derives ready state only after readiness verification and transport startup succeed", () => {
    let state = createAuthoritativeServerBootstrapPipelineState();
    state = updateAuthoritativeServerBootstrapPipelineStageState({
      state,
      stageId: AuthoritativeServerBootstrapPipelineStageIds.readinessVerification,
      executionState: AuthoritativeServerBootstrapStageExecutionStates.success,
      readinessState: AuthoritativeServerBootstrapReadinessStates.ready,
    });
    expect(state.readiness).toBe(AuthoritativeServerBootstrapReadinessStates.notReady);

    state = updateAuthoritativeServerBootstrapPipelineStageState({
      state,
      stageId: AuthoritativeServerBootstrapPipelineStageIds.transportStartup,
      executionState: AuthoritativeServerBootstrapStageExecutionStates.success,
      readinessState: AuthoritativeServerBootstrapReadinessStates.ready,
    });
    expect(state.readiness).toBe(AuthoritativeServerBootstrapReadinessStates.ready);
  });

  it("derives degraded readiness when any stage fails", () => {
    const state = createAuthoritativeServerBootstrapPipelineState();
    const failed = updateAuthoritativeServerBootstrapPipelineStageState({
      state,
      stageId: AuthoritativeServerBootstrapPipelineStageIds.persistenceInitialization,
      executionState: AuthoritativeServerBootstrapStageExecutionStates.failed,
      readinessState: AuthoritativeServerBootstrapReadinessStates.degraded,
      failedAt: "2026-04-12T14:00:00.000Z",
      failure: {
        name: "Error",
        message: "sqlite bootstrap failed",
      },
    });

    expect(failed.readiness).toBe(AuthoritativeServerBootstrapReadinessStates.degraded);
    const failedStage = failed.stages.find(
      (stage) => stage.stageId === AuthoritativeServerBootstrapPipelineStageIds.persistenceInitialization,
    );
    expect(failedStage?.executionState).toBe(AuthoritativeServerBootstrapStageExecutionStates.failed);
    expect(failedStage?.failure?.message).toBe("sqlite bootstrap failed");
    expect(deriveAuthoritativeServerBootstrapReadiness(failed.stages)).toBe(AuthoritativeServerBootstrapReadinessStates.degraded);
  });

  it("exposes immutable stage definitions", () => {
    expect(Object.isFrozen(AuthoritativeServerBootstrapPipelineStageDefinitions)).toBeTrue();
    for (const stage of AuthoritativeServerBootstrapPipelineStageDefinitions) {
      expect(Object.isFrozen(stage)).toBeTrue();
      expect(Object.isFrozen(stage.ownedModules)).toBeTrue();
      expect(Object.isFrozen(stage.hostBootstrapBindings)).toBeTrue();
      expect(Object.isFrozen(stage.authoritativeStageBindings)).toBeTrue();
    }
  });
});

