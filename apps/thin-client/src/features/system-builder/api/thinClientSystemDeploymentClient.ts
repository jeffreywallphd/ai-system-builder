import type { SystemDeploymentResult } from "../../../../../../modules/contracts/system-deployment";
import type { SystemDeploymentClient } from "../../../../../../modules/ui/shared/system-builder";
import { parseApiEnvelope } from "../../../security/apiErrorEnvelope";
import { secureFetch } from "../../../security/secureFetch";

const failure = <T>(
  message = "System deployment is unavailable.",
  code = "unavailable",
): SystemDeploymentResult<T> => ({ ok: false, error: { code, message } });
async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<SystemDeploymentResult<T>> {
  try {
    const response = await secureFetch(url, init);
    const envelope = parseApiEnvelope(await response.json());
    return envelope.ok
      ? { ok: true, value: envelope.value as T }
      : failure(
          envelope.error?.message ?? "The deployment request failed.",
          envelope.error?.code ?? "internal",
        );
  } catch {
    return failure();
  }
}
const post = <T>(url: string, body: unknown) =>
  request<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const query = (input: {
  workspaceId: string;
  deploymentId?: string;
  releaseId?: string;
  limit?: number;
}) =>
  `workspaceId=${encodeURIComponent(input.workspaceId)}${input.deploymentId ? `&deploymentId=${encodeURIComponent(input.deploymentId)}` : ""}${input.releaseId ? `&releaseId=${encodeURIComponent(input.releaseId)}` : ""}${input.limit !== undefined ? `&limit=${input.limit}` : ""}`;

export function createThinClientSystemDeploymentClient(
  baseUrl = "/api",
): SystemDeploymentClient {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    install: (input) => post(`${root}/systems/deployments/install`, input),
    activate: (input) => post(`${root}/systems/deployments/activate`, input),
    health: (input) => post(`${root}/systems/deployments/health`, input),
    rollback: (input) => post(`${root}/systems/deployments/rollback`, input),
    revoke: (input) => post(`${root}/systems/deployments/revoke`, input),
    read: (input) => request(`${root}/systems/deployment?${query(input)}`),
    list: (input) => request(`${root}/systems/deployments?${query(input)}`),
    startRun: (input) => post(`${root}/systems/deployments/runs/start`, input),
    cancelRun: (input) =>
      post(`${root}/systems/deployments/runs/cancel`, input),
    listRuns: (input) =>
      request(`${root}/systems/deployments/runs?${query(input)}`),
    listAudit: (input) =>
      request(`${root}/systems/deployments/audit?${query(input)}`),
  };
}
