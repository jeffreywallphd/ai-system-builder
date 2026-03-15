import type {
  IWorkflowAuditInfo,
  IWorkflowMetadata,
  IWorkflowRuntimeProfile,
} from "./interfaces/IWorkflow";
import type { RuntimeEngine } from "../models/interfaces/IModelCompatibility";

function freezeArray<T>(values?: ReadonlyArray<T>): ReadonlyArray<T> | undefined {
  return values ? Object.freeze([...values]) : undefined;
}

export class WorkflowMetadata implements IWorkflowMetadata {
  public readonly name: string;
  public readonly description?: string;
  public readonly author?: string;
  public readonly tags?: ReadonlyArray<string>;
  public readonly version?: string;

  constructor(params: {
    name: string;
    description?: string;
    author?: string;
    tags?: ReadonlyArray<string>;
    version?: string;
  }) {
    const normalizedName = params.name.trim();

    if (!normalizedName) {
      throw new Error("WorkflowMetadata.name cannot be empty.");
    }

    this.name = normalizedName;
    this.description = params.description?.trim() || undefined;
    this.author = params.author?.trim() || undefined;
    this.tags = freezeArray(
      params.tags?.map((tag) => tag.trim()).filter(Boolean)
    );
    this.version = params.version?.trim() || undefined;
  }

  public static from(metadata: IWorkflowMetadata): WorkflowMetadata {
    return new WorkflowMetadata({
      name: metadata.name,
      description: metadata.description,
      author: metadata.author,
      tags: metadata.tags,
      version: metadata.version,
    });
  }
}

export class WorkflowAuditInfo implements IWorkflowAuditInfo {
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(params: {
    createdAt?: Date;
    updatedAt?: Date;
  } = {}) {
    this.createdAt = params.createdAt
      ? new Date(params.createdAt.getTime())
      : undefined;
    this.updatedAt = params.updatedAt
      ? new Date(params.updatedAt.getTime())
      : undefined;
  }

  public touch(now: Date = new Date()): WorkflowAuditInfo {
    return new WorkflowAuditInfo({
      createdAt: this.createdAt ?? now,
      updatedAt: now,
    });
  }

  public static from(audit?: IWorkflowAuditInfo): WorkflowAuditInfo | undefined {
    if (!audit) {
      return undefined;
    }

    return new WorkflowAuditInfo({
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt,
    });
  }
}

export class WorkflowRuntimeProfile implements IWorkflowRuntimeProfile {
  public readonly preferredRuntime?: RuntimeEngine;
  public readonly allowedRuntimes?: ReadonlyArray<RuntimeEngine>;

  constructor(params: {
    preferredRuntime?: RuntimeEngine;
    allowedRuntimes?: ReadonlyArray<RuntimeEngine>;
  } = {}) {
    this.preferredRuntime = params.preferredRuntime;
    this.allowedRuntimes = freezeArray(params.allowedRuntimes);

    if (
      this.preferredRuntime &&
      this.allowedRuntimes &&
      this.allowedRuntimes.length > 0 &&
      !this.allowedRuntimes.includes(this.preferredRuntime)
    ) {
      throw new Error(
        "WorkflowRuntimeProfile.preferredRuntime must be included in allowedRuntimes when allowedRuntimes is provided."
      );
    }
  }

  public supportsRuntime(runtime: RuntimeEngine): boolean {
    if (!this.allowedRuntimes || this.allowedRuntimes.length === 0) {
      return true;
    }

    return this.allowedRuntimes.includes(runtime);
  }

  public static from(
    profile?: IWorkflowRuntimeProfile
  ): WorkflowRuntimeProfile | undefined {
    if (!profile) {
      return undefined;
    }

    return new WorkflowRuntimeProfile({
      preferredRuntime: profile.preferredRuntime,
      allowedRuntimes: profile.allowedRuntimes,
    });
  }
}
