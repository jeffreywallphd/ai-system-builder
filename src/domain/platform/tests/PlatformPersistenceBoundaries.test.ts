import { describe, expect, it } from "bun:test";
import {
  CorePlatformAggregatePersistenceBoundaries,
  PlatformPersistenceAuthorityScopes,
  PlatformPersistenceDomains,
  PlatformPersistenceModelKinds,
} from "../PlatformPersistenceBoundaries";

describe("platform aggregate persistence boundaries", () => {
  it("covers all required core platform domains with authoritative write boundaries", () => {
    const expectedDomains = new Set(Object.values(PlatformPersistenceDomains));
    const coveredDomains = new Set(CorePlatformAggregatePersistenceBoundaries.map((entry) => entry.domain));

    expect(coveredDomains).toEqual(expectedDomains);
    for (const entry of CorePlatformAggregatePersistenceBoundaries) {
      expect(entry.authorityScope).toBe(PlatformPersistenceAuthorityScopes.authoritativeServer);
      expect(entry.authoritativeModelKind).toBe(PlatformPersistenceModelKinds.authoritativeWriteModel);
      expect(entry.repositoryTargets.length).toBeGreaterThan(0);
      expect(entry.readModels.length).toBeGreaterThan(0);
    }
  });

  it("keeps aggregate identifiers unique across the boundary catalog", () => {
    const seen = new Set<string>();
    for (const entry of CorePlatformAggregatePersistenceBoundaries) {
      expect(seen.has(entry.aggregateId)).toBe(false);
      seen.add(entry.aggregateId);
    }
  });
});

