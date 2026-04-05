import type { IdentitySessionTokenMaterialRecord } from "../../contracts/IdentityApplicationContracts";

export interface IIdentitySessionTokenMaterialRepository {
  saveSessionTokenMaterial(record: IdentitySessionTokenMaterialRecord): Promise<IdentitySessionTokenMaterialRecord>;
  getSessionTokenMaterialBySessionId(sessionId: string): Promise<IdentitySessionTokenMaterialRecord | undefined>;
  getSessionTokenMaterialByTokenHash(tokenHash: string): Promise<IdentitySessionTokenMaterialRecord | undefined>;
  invalidateSessionTokenMaterial(
    sessionId: string,
    invalidatedAt: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined>;
}
