const checks = {
  dockerfile: [
    [
      /^FROM node:24-bookworm-slim@sha256:[a-f0-9]{64} AS build$/m,
      "build base image is not digest-pinned",
    ],
    [
      /^FROM node:24-bookworm-slim@sha256:[a-f0-9]{64} AS runtime$/m,
      "runtime base image is not digest-pinned",
    ],
    [
      /npm ci --ignore-scripts --no-audit --no-fund/,
      "build does not use the locked dependency tree",
    ],
    [
      /npm ci --omit=dev --ignore-scripts --no-audit --no-fund/,
      "runtime installs development dependencies",
    ],
    [/^USER node$/m, "runtime image does not declare a non-root user"],
    [/^HEALTHCHECK /m, "runtime image has no health check"],
  ],
  compose: [
    [
      /image: postgres:18-bookworm@sha256:[a-f0-9]{64}/,
      "Compose PostgreSQL image is not digest-pinned",
    ],
    [
      /image: ai-system-builder:qualification/,
      "Compose does not name the qualified application image",
    ],
    [
      /condition: service_healthy/,
      "Compose does not wait for PostgreSQL health",
    ],
    [/read_only: true/, "Compose application root filesystem is writable"],
    [/no-new-privileges:true/, "Compose does not prevent privilege escalation"],
    [/cap_drop:\s*\n\s*- ALL/, "Compose does not drop Linux capabilities"],
    [
      /tmpfs:\s*\n\s*- \/tmp:/,
      "Compose does not provide bounded temporary storage",
    ],
  ],
  kubernetes: [
    [/replicas: 1/, "Kubernetes template is not explicitly single-replica"],
    [
      /strategy:\s*\n\s*type: Recreate/,
      "Kubernetes template may create overlapping replicas",
    ],
    [
      /automountServiceAccountToken: false/,
      "Kubernetes template mounts an unused service-account token",
    ],
    [
      /runAsNonRoot: true/,
      "Kubernetes template does not require a non-root identity",
    ],
    [
      /seccompProfile:\s*\n\s*type: RuntimeDefault/,
      "Kubernetes template does not use the runtime-default seccomp profile",
    ],
    [
      /allowPrivilegeEscalation: false/,
      "Kubernetes container allows privilege escalation",
    ],
    [
      /readOnlyRootFilesystem: true/,
      "Kubernetes container root filesystem is writable",
    ],
    [
      /capabilities:\s*\n\s*drop:\s*\n\s*- ALL/,
      "Kubernetes container does not drop all capabilities",
    ],
    [
      /startupProbe:[\s\S]*path: \/health\/live/,
      "Kubernetes startup probe is missing",
    ],
    [
      /livenessProbe:[\s\S]*path: \/health\/live/,
      "Kubernetes liveness probe is missing",
    ],
    [
      /readinessProbe:[\s\S]*path: \/health\/ready/,
      "Kubernetes readiness probe is missing",
    ],
    [
      /resources:\s*\n\s*requests:[\s\S]*limits:/,
      "Kubernetes resource requests or limits are missing",
    ],
    [
      /image: [^\s]+@sha256:/,
      "Kubernetes image is not expressed as an immutable digest",
    ],
  ],
  workflow: [
    [
      /deployment-artifacts:/,
      "CI has no deployment-artifact qualification job",
    ],
    [
      /docker compose .* up --build --detach --wait/,
      "CI does not wait for the Compose application to become healthy",
    ],
    [
      /kubectl create --dry-run=client/,
      "CI does not parse the Kubernetes resources",
    ],
    [
      /anchore\/scan-action@[a-f0-9]{40}/,
      "CI image scanner is not pinned to a full action SHA",
    ],
    [
      /docker compose .* down --volumes --remove-orphans/,
      "CI does not tear down the qualification stack",
    ],
  ],
};

export function inspectServerDeploymentArtifacts(sources) {
  const violations = [];
  for (const [sourceName, sourceChecks] of Object.entries(checks)) {
    const source = sources[sourceName];
    for (const [pattern, message] of sourceChecks) {
      if (!pattern.test(source)) violations.push(`${sourceName}: ${message}`);
    }
  }
  if (
    /\b(?:node|postgres):latest\b/.test(
      `${sources.dockerfile}\n${sources.compose}`,
    )
  ) {
    violations.push("container inputs must not use latest tags");
  }
  if (/\bhostPath:/.test(sources.kubernetes)) {
    violations.push(
      "kubernetes: hostPath storage is not allowed in the managed template",
    );
  }
  return violations;
}
