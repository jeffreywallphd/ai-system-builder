import { describe, expect, it } from "bun:test";
import { HostBootstrapStageIds } from "@hosts/bootstrap/HostBootstrapPipeline";
import {
  AuthoritativeServerBootstrapStageContracts,
  AuthoritativeServerBootstrapStageHostBindings,
  AuthoritativeServerBootstrapStageIds,
  listAuthoritativeServerBootstrapStageContracts,
} from "../AuthoritativeServerBootstrapStageContracts";

describe("AuthoritativeServerBootstrapStageContracts", () => {
  it("defines typed contracts for config, security, persistence, services, and transport stages", () => {
    const contracts = listAuthoritativeServerBootstrapStageContracts();

    expect(contracts.map((contract) => contract.stageId)).toEqual([
      AuthoritativeServerBootstrapStageIds.config,
      AuthoritativeServerBootstrapStageIds.security,
      AuthoritativeServerBootstrapStageIds.persistence,
      AuthoritativeServerBootstrapStageIds.services,
      AuthoritativeServerBootstrapStageIds.transport,
    ]);

    for (const contract of contracts) {
      expect(contract.boundary.consumes.length).toBeGreaterThan(0);
      expect(contract.boundary.produces.length).toBeGreaterThan(0);
      expect(contract.description.length).toBeGreaterThan(0);
      expect(Object.isFrozen(contract)).toBeTrue();
      expect(Object.isFrozen(contract.boundary)).toBeTrue();
      expect(Object.isFrozen(contract.boundary.consumes)).toBeTrue();
      expect(Object.isFrozen(contract.boundary.produces)).toBeTrue();
    }
  });

  it("binds logical authoritative stages to the shared host bootstrap pipeline stages", () => {
    expect(AuthoritativeServerBootstrapStageHostBindings).toEqual({
      [AuthoritativeServerBootstrapStageIds.config]: HostBootstrapStageIds.configuration,
      [AuthoritativeServerBootstrapStageIds.security]: HostBootstrapStageIds.security,
      [AuthoritativeServerBootstrapStageIds.persistence]: HostBootstrapStageIds.persistence,
      [AuthoritativeServerBootstrapStageIds.services]: HostBootstrapStageIds.dependencies,
      [AuthoritativeServerBootstrapStageIds.transport]: HostBootstrapStageIds.featureRegistration,
    });
  });

  it("exposes immutable contract and binding catalogs", () => {
    expect(Object.isFrozen(AuthoritativeServerBootstrapStageContracts)).toBeTrue();
    expect(Object.isFrozen(AuthoritativeServerBootstrapStageHostBindings)).toBeTrue();
  });
});
