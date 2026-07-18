import type { SystemDeploymentRuntimePort } from "../../../application/ports/system-deployment";
import type { AssetImplementationDeploymentProfile } from "../../../contracts/asset-implementation";
import type {
  SystemDeployment,
  SystemDeploymentDiagnostic,
  SystemDeploymentHealth,
  SystemReferenceRuntimeKind,
} from "../../../contracts/system-deployment";

const TRUSTED_REFERENCE_KINDS = new Set<SystemReferenceRuntimeKind>([
  "secured-data-entry",
  "controlled-chatbot",
  "secured-data-review",
]);

export interface CreateTrustedSystemDeploymentRuntimeAdapterOptions {
  readonly deploymentProfiles: readonly AssetImplementationDeploymentProfile[];
  readonly now?: () => string;
  readonly verifyReferenceRelease?: (
    deployment: SystemDeployment,
  ) => Promise<boolean>;
}

export function createTrustedSystemDeploymentRuntimeAdapter(
  options: CreateTrustedSystemDeploymentRuntimeAdapterOptions,
): SystemDeploymentRuntimePort {
  const now = options.now ?? (() => new Date().toISOString());
  const supportsProfile = (profile: AssetImplementationDeploymentProfile) =>
    options.deploymentProfiles.includes(profile) && profile !== "thin-client";
  const ready = (
    diagnostics: readonly SystemDeploymentDiagnostic[] = [],
  ): SystemDeploymentHealth => ({
    status: diagnostics.some((item) => item.severity === "error")
      ? "not-ready"
      : "ready",
    checkedAt: now(),
    diagnostics,
  });

  return {
    supportsReferenceRuntime: (kind) => TRUSTED_REFERENCE_KINDS.has(kind),
    async inspect(deployment) {
      const diagnostics: SystemDeploymentDiagnostic[] = [];
      if (!TRUSTED_REFERENCE_KINDS.has(deployment.referenceRuntimeKind))
        diagnostics.push(
          error(
            "deployment.runtime.unavailable",
            "Only product-compiled reference runtimes are available.",
          ),
        );
      if (!supportsProfile(deployment.deploymentProfile))
        diagnostics.push(
          error(
            "deployment.profile.unavailable",
            "This host does not own the selected deployment profile.",
          ),
        );
      if (deployment.compatibility.sandboxRequired)
        diagnostics.push(
          error(
            "deployment.sandbox-unavailable",
            "Imported or authored execution requires a separately qualified sandbox adapter.",
          ),
        );
      return {
        ready: diagnostics.length === 0,
        diagnostics,
      };
    },
    async activate(deployment) {
      if (
        !TRUSTED_REFERENCE_KINDS.has(deployment.referenceRuntimeKind) ||
        !supportsProfile(deployment.deploymentProfile) ||
        deployment.compatibility.sandboxRequired
      )
        return ready([
          error(
            "deployment.runtime.unavailable",
            "The deployment runtime is unavailable on this host.",
          ),
        ]);
      if (
        options.verifyReferenceRelease &&
        !(await options.verifyReferenceRelease(deployment))
      )
        return ready([
          error(
            "deployment.runtime.release-invalid",
            "The release-bound reference runtime could not verify its manifest.",
          ),
        ]);
      return ready([
        {
          severity: "info",
          code: "deployment.runtime.ready",
          message: "The release-bound trusted runtime is ready.",
        },
      ]);
    },
    async deactivate() {},
    async health(deployment) {
      return this.activate(deployment);
    },
    async start(deployment) {
      const health = await this.activate(deployment);
      if (health.status !== "ready")
        return { status: "failed", diagnostics: health.diagnostics };
      return {
        status: "succeeded",
        diagnostics: [
          {
            severity: "info",
            code: "deployment.run.handoff-ready",
            message:
              "The trusted release-bound runtime accepted the deployment handoff.",
          },
        ],
        durationMilliseconds: 0,
        outputBytes: 0,
      };
    },
    async cancel() {},
  };
}

const error = (code: string, message: string): SystemDeploymentDiagnostic => ({
  severity: "error",
  code,
  message,
});
