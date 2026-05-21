import { describe, expect, it, expectTypeOf } from "../../../../testing/node-test";
import type { AssetDraftRepositoryPort, AssetOverrideRepositoryPort, AuthoredAssetRepositoryPort, AssetRevisionRepositoryPort } from "..";

describe("asset authoring ports",()=>{
 it("exports family", async ()=>{ const family = await import(".."); expect(Object.keys(family).length).toBeGreaterThan(0); });
 it("requires explicit workspace ids",()=>{
  expectTypeOf<Parameters<AuthoredAssetRepositoryPort["readAuthoredAssetRecordByWorkspace"]>[0]>().toEqualTypeOf<string>();
  expectTypeOf<Parameters<AssetDraftRepositoryPort["readAssetDraftRecord"]>[0]>().toEqualTypeOf<string>();
  expectTypeOf<Parameters<AssetOverrideRepositoryPort["readAssetOverrideRecord"]>[0]>().toEqualTypeOf<string>();
  expectTypeOf<Parameters<AssetRevisionRepositoryPort["readAssetRevisionRecord"]>[0]>().toEqualTypeOf<string>();
 });
});
