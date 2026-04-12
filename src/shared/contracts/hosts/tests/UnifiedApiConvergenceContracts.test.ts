import { describe, expect, it } from "bun:test";
import {
  UnifiedApiContractHomeStatuses,
  UnifiedApiDomainConvergenceContracts,
} from "../UnifiedApiConvergenceContracts";

describe("UnifiedApiConvergenceContracts", () => {
  it("maps every domain to authoritative transport and shared contract homes", () => {
    expect(UnifiedApiDomainConvergenceContracts.length).toBeGreaterThan(0);

    for (const domain of UnifiedApiDomainConvergenceContracts) {
      expect(domain.domainId.length).toBeGreaterThan(0);
      expect(domain.targetApplicationLayer.startsWith("src/")).toBeTrue();
      expect(domain.authoritativeTransport.length).toBeGreaterThan(0);
      expect(domain.contractHomes.length).toBeGreaterThan(0);

      for (const home of domain.contractHomes) {
        const isSharedContracts = home.path.startsWith("src/shared/contracts/");
        const isSharedSchemas = home.path.startsWith("src/shared/schemas/");
        expect(isSharedContracts || isSharedSchemas).toBeTrue();
        expect(home.path.endsWith(".ts")).toBeTrue();
        expect(
          home.status === UnifiedApiContractHomeStatuses.existing
          || home.status === UnifiedApiContractHomeStatuses.proposed,
        ).toBeTrue();
      }
    }
  });
});
