import { describe, expect, it, expectTypeOf } from "../../../../testing/node-test";
import type { AssetCompositionPlanRepositoryPort } from "..";

describe("asset composition ports",()=>{
  it("exports family", async()=>{ const family = await import(".."); expect(Object.keys(family).length).toBeGreaterThan(0); });
  it("requires explicit workspace scoped methods",()=>{
    expectTypeOf<Parameters<AssetCompositionPlanRepositoryPort["readAssetCompositionPlanRecord"]>[0]>().toEqualTypeOf<string>();
    expectTypeOf<Parameters<AssetCompositionPlanRepositoryPort["listActiveDraftBlockedConflictedStaleOrArchivedAssetCompositionPlanRecords"]>[0]>().toEqualTypeOf<string>();
  });
  it("keeps list query filters safe and explicit",()=>{
    expectTypeOf<Parameters<AssetCompositionPlanRepositoryPort["listAssetCompositionPlanRecords"]>[0]>().toMatchTypeOf<{targetWorkspaceId:string; text?: string; limit?: number; cursor?: string}>();
  });
});
