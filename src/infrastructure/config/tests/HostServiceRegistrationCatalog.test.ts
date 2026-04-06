import { describe, expect, it } from "bun:test";
import {
  AuthoritativeServerHostRuntime,
  DesktopHostRuntime,
  WorkerHostRuntime,
} from "../../../hosts/HostRuntimeCatalog";
import {
  HostComposableServiceKinds,
  HostServiceRegistrationError,
  createHostServiceRegistry,
} from "../HostServiceRegistration";
import {
  AuthoritativeControlPlaneRequiredServiceIds,
  assertAuthoritativeControlPlaneServiceCoverage,
  assertDesktopHostServiceCoverage,
  composeHostServiceRegistrationPlan,
  DesktopHostRequiredServiceIds,
} from "../HostServiceRegistrationCatalog";

describe("HostServiceRegistrationCatalog", () => {
  it("composes authoritative host services with required startup dependency coverage", () => {
    const plan = composeHostServiceRegistrationPlan({
      host: AuthoritativeServerHostRuntime,
      requiredStartupDependencyIds: [
        "dep:application:control-plane-services",
        "dep:infrastructure:authoritative-server-adapters",
      ],
    });

    expect(plan.hostId).toBe(AuthoritativeServerHostRuntime.hostId);
    expect(plan.servicesByLayer.application.length).toBeGreaterThan(0);
    expect(plan.servicesByLayer.infrastructure.length).toBeGreaterThan(0);
    expect(plan.servicesByLayer.host.length).toBeGreaterThan(0);
    expect(Object.keys(plan.startupDependencyCoverage)).toContain("dep:application:control-plane-services");

    expect(() => assertAuthoritativeControlPlaneServiceCoverage(plan)).not.toThrow();

    const selectedServiceIds = new Set(plan.selectedServices.map((service) => service.serviceId));
    for (const requiredServiceId of AuthoritativeControlPlaneRequiredServiceIds) {
      expect(selectedServiceIds.has(requiredServiceId)).toBeTrue();
    }
  });

  it("rejects host leakage when a desktop host composes authoritative-only service ids", () => {
    expect(() => composeHostServiceRegistrationPlan({
      host: DesktopHostRuntime,
      includeServiceIds: ["svc:application:identity-control-plane"],
    })).toThrow(HostServiceRegistrationError);
  });

  it("asserts required desktop host service coverage", () => {
    const plan = composeHostServiceRegistrationPlan({
      host: DesktopHostRuntime,
      requiredStartupDependencyIds: ["dep:application:desktop-runtime-services"],
    });
    expect(() => assertDesktopHostServiceCoverage(plan)).not.toThrow();
    const selected = new Set(plan.selectedServices.map((service) => service.serviceId));
    for (const requiredServiceId of DesktopHostRequiredServiceIds) {
      expect(selected.has(requiredServiceId)).toBeTrue();
    }
  });

  it("fails startup dependency validation when required dependency has no composed services", () => {
    expect(() => composeHostServiceRegistrationPlan({
      host: WorkerHostRuntime,
      requiredStartupDependencyIds: ["dep:infrastructure:authoritative-server-adapters"],
    })).toThrow(HostServiceRegistrationError);
  });
});

describe("HostServiceRegistration", () => {
  it("rejects circular service registrations", () => {
    expect(() => createHostServiceRegistry([
      {
        serviceId: "svc:test:a",
        description: "service a",
        kind: HostComposableServiceKinds.applicationPort,
        boundaryLayer: "application",
        dependsOn: ["svc:test:b"],
      },
      {
        serviceId: "svc:test:b",
        description: "service b",
        kind: HostComposableServiceKinds.applicationPort,
        boundaryLayer: "application",
        dependsOn: ["svc:test:a"],
      },
    ])).toThrow(HostServiceRegistrationError);
  });
});

