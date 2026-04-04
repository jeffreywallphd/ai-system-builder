import type { Session } from "../../../src/domain/identity/IdentityDomain";
import type { IdentitySessionListQuery } from "../../contracts/IdentityApplicationContracts";

export interface IIdentitySessionRepository {
  saveSession(session: Session): Promise<Session>;
  getSessionById(sessionId: string): Promise<Session | undefined>;
  listSessionsByUserIdentityId(query: IdentitySessionListQuery): Promise<ReadonlyArray<Session>>;
  removeSession(sessionId: string): Promise<boolean>;
}
