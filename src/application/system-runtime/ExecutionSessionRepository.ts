import type { ExecutionSession } from "../../domain/system-runtime/ExecutionSessionDomain";

export interface ExecutionSessionRepository {
  save(session: ExecutionSession): ExecutionSession;
  getById(sessionId: string): ExecutionSession | undefined;
  getByExecutionId(executionId: string): ExecutionSession | undefined;
}

export class InMemoryExecutionSessionRepository implements ExecutionSessionRepository {
  private readonly sessions = new Map<string, ExecutionSession>();
  private readonly sessionIdByExecutionId = new Map<string, string>();

  public save(session: ExecutionSession): ExecutionSession {
    this.sessions.set(session.sessionId, session);
    for (const executionId of session.executionIds) {
      this.sessionIdByExecutionId.set(executionId, session.sessionId);
    }
    return session;
  }

  public getById(sessionId: string): ExecutionSession | undefined {
    const normalized = sessionId.trim();
    if (!normalized) {
      return undefined;
    }
    return this.sessions.get(normalized);
  }

  public getByExecutionId(executionId: string): ExecutionSession | undefined {
    const normalized = executionId.trim();
    if (!normalized) {
      return undefined;
    }
    const sessionId = this.sessionIdByExecutionId.get(normalized);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }
}
