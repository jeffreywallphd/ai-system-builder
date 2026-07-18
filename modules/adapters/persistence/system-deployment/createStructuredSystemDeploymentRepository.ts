import type { SystemDeploymentRepositoryPort } from "../../../application/ports/system-deployment";
import type {
  SystemDeployment,
  SystemDeploymentRun,
} from "../../../contracts/system-deployment";
import {
  StructuredDocumentConflictError,
  cloneStructuredJson,
  type StructuredDocumentStore,
} from "../shared";

const DEPLOYMENTS = "system-deployment/deployments";
const RUNS = "system-deployment/runs";
const AUDIT = "system-deployment/audit";

export function createStructuredSystemDeploymentRepository(
  documents: StructuredDocumentStore,
): SystemDeploymentRepositoryPort {
  return {
    async createDeployment(deployment) {
      const key = deploymentKey(deployment);
      if (await documents.readDocument(DEPLOYMENTS, key))
        throw new StructuredDocumentConflictError(DEPLOYMENTS, key, 0);
      await documents.writeDocument(
        DEPLOYMENTS,
        key,
        cloneStructuredJson(deployment),
        { expectedRevision: 0 },
      );
      return cloneStructuredJson(deployment);
    },
    async readDeployment(organizationId, workspaceId, deploymentId) {
      const value = (
        await documents.readDocument<SystemDeployment>(
          DEPLOYMENTS,
          `${organizationId}/${workspaceId}/${deploymentId}`,
        )
      )?.value;
      return value?.organizationId === organizationId &&
        value.workspaceId === workspaceId
        ? cloneStructuredJson(value)
        : undefined;
    },
    async listDeployments(organizationId, workspaceId, releaseId) {
      return (await documents.listDocuments<SystemDeployment>(DEPLOYMENTS))
        .map((entry) => entry.value)
        .filter(
          (entry) =>
            entry.organizationId === organizationId &&
            entry.workspaceId === workspaceId &&
            (!releaseId || entry.releaseId === releaseId),
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(cloneStructuredJson);
    },
    async updateDeployment(deployment, expectedRevision) {
      const key = deploymentKey(deployment);
      return documents.runInTransaction(async (transaction) => {
        const current = await transaction.readDocument<SystemDeployment>(
          DEPLOYMENTS,
          key,
        );
        if (
          !current ||
          current.value.revision !== expectedRevision ||
          deployment.revision !== expectedRevision + 1
        )
          throw new StructuredDocumentConflictError(
            DEPLOYMENTS,
            key,
            expectedRevision,
          );
        await transaction.writeDocument(
          DEPLOYMENTS,
          key,
          cloneStructuredJson(deployment),
          { expectedRevision: current.revision },
        );
        return cloneStructuredJson(deployment);
      });
    },
    async createRun(run) {
      const key = runKey(run);
      if (await documents.readDocument(RUNS, key))
        throw new StructuredDocumentConflictError(RUNS, key, 0);
      await documents.writeDocument(RUNS, key, cloneStructuredJson(run), {
        expectedRevision: 0,
      });
      return cloneStructuredJson(run);
    },
    async readRun(organizationId, workspaceId, runId) {
      const value = (
        await documents.readDocument<SystemDeploymentRun>(
          RUNS,
          `${organizationId}/${workspaceId}/${runId}`,
        )
      )?.value;
      return value?.organizationId === organizationId &&
        value.workspaceId === workspaceId
        ? cloneStructuredJson(value)
        : undefined;
    },
    async listRuns(organizationId, workspaceId, deploymentId) {
      return (await documents.listDocuments<SystemDeploymentRun>(RUNS))
        .map((entry) => entry.value)
        .filter(
          (entry) =>
            entry.organizationId === organizationId &&
            entry.workspaceId === workspaceId &&
            (!deploymentId || entry.deploymentId === deploymentId),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map(cloneStructuredJson);
    },
    async updateRun(run, expectedRevision) {
      const key = runKey(run);
      return documents.runInTransaction(async (transaction) => {
        const current = await transaction.readDocument<SystemDeploymentRun>(
          RUNS,
          key,
        );
        if (
          !current ||
          current.value.revision !== expectedRevision ||
          run.revision !== expectedRevision + 1
        )
          throw new StructuredDocumentConflictError(
            RUNS,
            key,
            expectedRevision,
          );
        await transaction.writeDocument(RUNS, key, cloneStructuredJson(run), {
          expectedRevision: current.revision,
        });
        return cloneStructuredJson(run);
      });
    },
    async appendAudit(entry) {
      const key = `${entry.organizationId}/${entry.workspaceId}/${entry.deploymentId}/${entry.occurredAt}/${entry.auditId}`;
      await documents.writeDocument(AUDIT, key, cloneStructuredJson(entry), {
        expectedRevision: 0,
      });
    },
    async listAudit(organizationId, workspaceId, deploymentId, limit) {
      return (await documents.listDocuments(AUDIT))
        .map((entry) => entry.value as any)
        .filter(
          (entry) =>
            entry.organizationId === organizationId &&
            entry.workspaceId === workspaceId &&
            entry.deploymentId === deploymentId,
        )
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, Math.max(1, Math.min(200, limit)))
        .map(cloneStructuredJson);
    },
  };
}

const deploymentKey = (deployment: SystemDeployment) =>
  `${deployment.organizationId}/${deployment.workspaceId}/${deployment.deploymentId}`;
const runKey = (run: SystemDeploymentRun) =>
  `${run.organizationId}/${run.workspaceId}/${run.runId}`;
