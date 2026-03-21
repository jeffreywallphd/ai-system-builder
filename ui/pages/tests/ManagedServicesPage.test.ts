import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ManagedServicesPage", () => {
  it("wires the managed services store into a mobile-friendly runtime administration page", () => {
    const source = readSource("ui/pages/ManagedServicesPage.tsx");

    expect(source).toContain("Managed Services");
    expect(source).toContain("managedServicesStore.initialize");
    expect(source).toContain("<ManagedServicesPanel");
    expect(source).toContain("managedServicesStore.start");
    expect(source).toContain("managedServicesStore.stop");
    expect(source).toContain("managedServicesStore.restart");
    expect(source).toContain("managedServicesStore.ensureRunning");
    expect(source).toContain("managedServicesStore.startCapability");
    expect(source).toContain("phone-driven administration");
  });
});
