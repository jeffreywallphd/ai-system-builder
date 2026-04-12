import { describe, expect, it } from "bun:test";
import {
  AuthoritativeServerCompositionModuleIds,
  type AuthoritativeServerCompositionModuleId,
} from "../composition/contracts/AuthoritativeServerCompositionModuleContracts";
import {
  AuthoritativeServerCompositionModuleMap,
  listAuthoritativeServerCompositionModules,
} from "../composition/contracts/AuthoritativeServerCompositionModuleMap";

describe("AuthoritativeServerCompositionAssemblyContracts", () => {
  it("defines a deterministic module map for all bounded composition modules", () => {
    const expectedOrder = [
      AuthoritativeServerCompositionModuleIds.startupConfiguration,
      AuthoritativeServerCompositionModuleIds.securityBootstrap,
      AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
      AuthoritativeServerCompositionModuleIds.policyBootstrap,
      AuthoritativeServerCompositionModuleIds.servicePlan,
      AuthoritativeServerCompositionModuleIds.routePlan,
      AuthoritativeServerCompositionModuleIds.executionAdapter,
      AuthoritativeServerCompositionModuleIds.controlPlaneApi,
      AuthoritativeServerCompositionModuleIds.orchestrationRecovery,
      AuthoritativeServerCompositionModuleIds.transport,
      AuthoritativeServerCompositionModuleIds.diagnostics,
    ] as const satisfies ReadonlyArray<AuthoritativeServerCompositionModuleId>;
    expect(AuthoritativeServerCompositionModuleMap.map((module) => module.moduleId)).toEqual(expectedOrder);
  });

  it("keeps module dependencies bounded and forward-safe", () => {
    const knownModuleIds = new Set(
      AuthoritativeServerCompositionModuleMap.map((module) => module.moduleId),
    );
    const moduleIndexById = new Map(
      AuthoritativeServerCompositionModuleMap.map((module, index) => [module.moduleId, index] as const),
    );

    for (const module of AuthoritativeServerCompositionModuleMap) {
      const moduleIndex = moduleIndexById.get(module.moduleId) ?? -1;
      expect(moduleIndex).toBeGreaterThanOrEqual(0);
      expect(module.contractType.endsWith("Contract")).toBeTrue();
      expect(module.summary.length).toBeGreaterThan(10);

      for (const dependency of module.dependsOn) {
        expect(knownModuleIds.has(dependency)).toBeTrue();
        expect(dependency).not.toBe(module.moduleId);
        const dependencyIndex = moduleIndexById.get(dependency) ?? Number.POSITIVE_INFINITY;
        expect(dependencyIndex).toBeLessThan(moduleIndex);
      }
    }
  });

  it("keeps explicit composition dependency allow-lists stable", () => {
    const expectedDependenciesByModuleId = new Map<
      AuthoritativeServerCompositionModuleId,
      ReadonlyArray<AuthoritativeServerCompositionModuleId>
    >([
      [AuthoritativeServerCompositionModuleIds.startupConfiguration, []],
      [AuthoritativeServerCompositionModuleIds.securityBootstrap, [
        AuthoritativeServerCompositionModuleIds.startupConfiguration,
      ]],
      [AuthoritativeServerCompositionModuleIds.persistenceBootstrap, [
        AuthoritativeServerCompositionModuleIds.startupConfiguration,
        AuthoritativeServerCompositionModuleIds.securityBootstrap,
      ]],
      [AuthoritativeServerCompositionModuleIds.policyBootstrap, [
        AuthoritativeServerCompositionModuleIds.startupConfiguration,
        AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
      ]],
      [AuthoritativeServerCompositionModuleIds.servicePlan, [
        AuthoritativeServerCompositionModuleIds.startupConfiguration,
      ]],
      [AuthoritativeServerCompositionModuleIds.routePlan, [
        AuthoritativeServerCompositionModuleIds.startupConfiguration,
      ]],
      [AuthoritativeServerCompositionModuleIds.executionAdapter, [
        AuthoritativeServerCompositionModuleIds.startupConfiguration,
      ]],
      [AuthoritativeServerCompositionModuleIds.controlPlaneApi, [
        AuthoritativeServerCompositionModuleIds.startupConfiguration,
        AuthoritativeServerCompositionModuleIds.securityBootstrap,
        AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
        AuthoritativeServerCompositionModuleIds.policyBootstrap,
        AuthoritativeServerCompositionModuleIds.servicePlan,
        AuthoritativeServerCompositionModuleIds.routePlan,
        AuthoritativeServerCompositionModuleIds.executionAdapter,
      ]],
      [AuthoritativeServerCompositionModuleIds.orchestrationRecovery, [
        AuthoritativeServerCompositionModuleIds.startupConfiguration,
        AuthoritativeServerCompositionModuleIds.policyBootstrap,
      ]],
      [AuthoritativeServerCompositionModuleIds.transport, [
        AuthoritativeServerCompositionModuleIds.controlPlaneApi,
        AuthoritativeServerCompositionModuleIds.orchestrationRecovery,
      ]],
      [AuthoritativeServerCompositionModuleIds.diagnostics, [
        AuthoritativeServerCompositionModuleIds.startupConfiguration,
      ]],
    ]);

    for (const module of AuthoritativeServerCompositionModuleMap) {
      const expectedDependencies = expectedDependenciesByModuleId.get(module.moduleId);
      expect(expectedDependencies).toBeDefined();
      expect(module.dependsOn).toEqual(expectedDependencies);
    }
  });

  it("keeps disposal ownership explicit for persistence and transport modules", () => {
    const mapById = new Map(
      AuthoritativeServerCompositionModuleMap.map((module) => [module.moduleId, module] as const),
    );
    const persistenceModule = mapById.get(AuthoritativeServerCompositionModuleIds.persistenceBootstrap);
    const transportModule = mapById.get(AuthoritativeServerCompositionModuleIds.transport);

    expect(persistenceModule?.disposalResponsibilities).toContain("dispose sqlite persistence runtime");
    expect(transportModule?.disposalResponsibilities).toContain("close runtime host transport");
  });

  it("exposes a stable list function aligned with the module map", () => {
    expect(listAuthoritativeServerCompositionModules()).toBe(AuthoritativeServerCompositionModuleMap);
  });
});
