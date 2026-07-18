import type { SystemDeploymentResult } from "../../../../../../../modules/contracts/system-deployment";
import type { SystemDeploymentClient } from "../../../../../../../modules/ui/shared/system-builder";
import { getDesktopApi } from "../../../lib/desktopApi";

interface Envelope {
  readonly ok?: boolean;
  readonly value?: unknown;
  readonly error?: { readonly code?: unknown; readonly message?: unknown };
}

const failure = <T>(
  message = "System deployment is unavailable.",
  code = "unavailable",
): SystemDeploymentResult<T> => ({ ok: false, error: { code, message } });
const unwrap = <T>(response: unknown): SystemDeploymentResult<T> => {
  if (!response || typeof response !== "object" || Array.isArray(response))
    return failure(
      "The desktop deployment response was invalid.",
      "invalid-response",
    );
  const envelope = response as Envelope;
  return envelope.ok === true
    ? { ok: true, value: envelope.value as T }
    : failure(
        typeof envelope.error?.message === "string"
          ? envelope.error.message
          : "The deployment request failed.",
        typeof envelope.error?.code === "string"
          ? envelope.error.code
          : "internal",
      );
};

export function createDesktopSystemDeploymentClient(): SystemDeploymentClient {
  const api = getDesktopApi();
  const call = async <T>(
    method: ((input: any) => Promise<unknown>) | undefined,
    input: unknown,
  ): Promise<SystemDeploymentResult<T>> =>
    typeof method === "function" ? unwrap(await method(input)) : failure();
  return {
    install: (input) => call(api.installSystemDeployment, input),
    activate: (input) => call(api.activateSystemDeployment, input),
    health: (input) => call(api.reconcileSystemDeploymentHealth, input),
    rollback: (input) => call(api.rollbackSystemDeployment, input),
    revoke: (input) => call(api.revokeSystemDeployment, input),
    read: (input) => call(api.readSystemDeployment, input),
    list: (input) => call(api.listSystemDeployments, input),
    startRun: (input) => call(api.startSystemDeploymentRun, input),
    cancelRun: (input) => call(api.cancelSystemDeploymentRun, input),
    listRuns: (input) => call(api.listSystemDeploymentRuns, input),
    listAudit: (input) => call(api.listSystemDeploymentAudit, input),
  };
}
