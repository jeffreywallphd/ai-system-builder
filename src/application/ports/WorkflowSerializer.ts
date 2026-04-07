import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowDeserializationRequest,
  IWorkflowSerializationRequest,
  IWorkflowSerializationResult,
  IWorkflowSerializer,
} from "./interfaces/IWorkflowSerializer";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export class WorkflowSerializationResult implements IWorkflowSerializationResult {
  public readonly content: string;
  public readonly format: IWorkflowSerializationResult["format"];
  public readonly contentType?: string;

  constructor(params: {
    content: string;
    format: IWorkflowSerializationResult["format"];
    contentType?: string;
  }) {
    if (!params.content.trim()) {
      throw new Error("WorkflowSerializationResult.content cannot be empty.");
    }

    this.content = params.content;
    this.format = params.format;
    this.contentType = params.contentType?.trim().toLowerCase() || undefined;
  }

  public static from(
    result: IWorkflowSerializationResult
  ): WorkflowSerializationResult {
    return new WorkflowSerializationResult({
      content: result.content,
      format: result.format,
      contentType: result.contentType,
    });
  }
}

export class WorkflowSerializer implements IWorkflowSerializer {
  private readonly serializers: ReadonlyArray<IWorkflowSerializer>;

  constructor(serializers: ReadonlyArray<IWorkflowSerializer> = []) {
    this.serializers = Object.freeze([...serializers]);
  }

  public async serialize(
    request: IWorkflowSerializationRequest
  ): Promise<IWorkflowSerializationResult> {
    const serializer = this.resolveSerializationSerializer(request.target);
    const result = await serializer.serialize(request);
    return WorkflowSerializationResult.from(result);
  }

  public async deserialize(
    request: IWorkflowDeserializationRequest
  ): Promise<IWorkflow> {
    const serializer = this.resolveDeserializationSerializer(request.source);
    return serializer.deserialize(request);
  }

  public canSerialize(
    target: IWorkflowSerializationRequest["target"]
  ): boolean {
    return this.serializers.some((serializer) => serializer.canSerialize(target));
  }

  public canDeserialize(
    source: IWorkflowDeserializationRequest["source"]
  ): boolean {
    return this.serializers.some((serializer) => serializer.canDeserialize(source));
  }

  private resolveSerializationSerializer(
    target: IWorkflowSerializationRequest["target"]
  ): IWorkflowSerializer {
    const serializer = this.serializers.find((candidate) =>
      candidate.canSerialize(target)
    );

    if (!serializer) {
      const runtime = target.runtime ?? "generic";
      throw new Error(
        `No workflow serializer is available for format '${target.format}' and runtime '${runtime}'.`
      );
    }

    return serializer;
  }

  private resolveDeserializationSerializer(
    source: IWorkflowDeserializationRequest["source"]
  ): IWorkflowSerializer {
    const serializer = this.serializers.find((candidate) =>
      candidate.canDeserialize(source)
    );

    if (!serializer) {
      const runtime = source.runtime ?? "generic";
      throw new Error(
        `No workflow serializer is available for source format '${source.format}' and runtime '${runtime}'.`
      );
    }

    return serializer;
  }
}

