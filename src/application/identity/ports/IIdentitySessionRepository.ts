import type { Session } from "../../../domain/identity/IdentityDomain";
import type {
  IdentityPersistenceDeletionResult,
  IdentityPersistenceMutationContext,
  IdentityPersistenceMutationResult,
  IdentitySessionListQuery,
} from "../../../shared/dto/identity/IdentityPersistenceDtos";

export interface IIdentitySessionQueryRepository {
  getSessionById(sessionId: string): Promise<Session | undefined>;
  listSessions(query: IdentitySessionListQuery): Promise<ReadonlyArray<Session>>;
}

export interface IIdentitySessionWriteRepository {
  saveSession(
    session: Session,
    mutation?: IdentityPersistenceMutationContext,
  ): Promise<IdentityPersistenceMutationResult<Session>>;
  removeSession(
    sessionId: string,
    mutation?: IdentityPersistenceMutationContext,
  ): Promise<IdentityPersistenceDeletionResult>;
}

export interface IIdentitySessionRepository
  extends IIdentitySessionQueryRepository, IIdentitySessionWriteRepository {}
