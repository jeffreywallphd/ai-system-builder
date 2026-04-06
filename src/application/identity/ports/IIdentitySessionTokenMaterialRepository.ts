import type {
  IdentityPersistenceMutationContext,
  IdentityPersistenceMutationResult,
  IdentitySessionTokenMaterialLookupQuery,
  IdentitySessionTokenMaterialRecord,
} from "../../../shared/dto/identity/IdentityPersistenceDtos";

export interface IIdentitySessionTokenMaterialQueryRepository {
  getSessionTokenMaterialBySessionId(
    sessionId: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined>;
  getSessionTokenMaterialByTokenHash(
    tokenHash: string,
  ): Promise<IdentitySessionTokenMaterialRecord | undefined>;
  listSessionTokenMaterial(
    query: IdentitySessionTokenMaterialLookupQuery,
  ): Promise<ReadonlyArray<IdentitySessionTokenMaterialRecord>>;
}

export interface IIdentitySessionTokenMaterialWriteRepository {
  saveSessionTokenMaterial(
    record: IdentitySessionTokenMaterialRecord,
    mutation?: IdentityPersistenceMutationContext,
  ): Promise<IdentityPersistenceMutationResult<IdentitySessionTokenMaterialRecord>>;
  invalidateSessionTokenMaterial(
    sessionId: string,
    invalidatedAt: string,
    mutation?: IdentityPersistenceMutationContext,
  ): Promise<IdentityPersistenceMutationResult<IdentitySessionTokenMaterialRecord | undefined>>;
}

export interface IIdentitySessionTokenMaterialRepository
  extends IIdentitySessionTokenMaterialQueryRepository, IIdentitySessionTokenMaterialWriteRepository {}
