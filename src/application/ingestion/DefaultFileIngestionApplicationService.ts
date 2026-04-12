import { FileIngestionPolicyService } from "@domain/ingestion/FileIngestionServices";
import {
  ConversionFailedError,
  FileIngestionError,
  type FileIngestionProfile,
  type FileIngestionRequest,
  type FileIngestionResult,
  RuntimeUnavailableError,
} from "@domain/ingestion/interfaces/IFileIngestion";
import type { DocumentConversionGateway } from "./DocumentConversionGateway";
import { RuntimeDependencyUnavailableError } from "../runtime/RuntimeDependencyOrchestrator";
import type { FileIngestionApplicationService } from "./FileIngestionApplicationService";

function toUint8Array(content: string | Uint8Array): Uint8Array {
  if (content instanceof Uint8Array) {
    return content;
  }

  return new TextEncoder().encode(content);
}

export class DefaultFileIngestionApplicationService implements FileIngestionApplicationService {
  constructor(
    private readonly policyService: FileIngestionPolicyService,
    private readonly conversionGateway: DocumentConversionGateway,
  ) {}

  public async ingestFile(profile: FileIngestionProfile, request: FileIngestionRequest): Promise<FileIngestionResult> {
    const evaluation = this.policyService.evaluateRequest(request, profile.policy);

    if (!evaluation.requiresConversion) {
      const document = this.policyService.buildPassThroughDocument({
        descriptor: evaluation.descriptor,
        provenance: request.provenance,
        sourceFormat: evaluation.sourceFormat,
        content: request.content,
        warnings: evaluation.warnings,
      });

      return Object.freeze({
        profileId: profile.id,
        document,
        warnings: document.warnings,
      });
    }

    try {
      const converted = await this.conversionGateway.convert({
        file: evaluation.descriptor,
        content: toUint8Array(request.content),
        outputFormat: "markdown",
      });

      const warnings = Object.freeze([...evaluation.warnings, ...converted.warnings]);
      return Object.freeze({
        profileId: profile.id,
        document: Object.freeze({
          ...converted,
          warnings,
          provenance: Object.freeze({ ...request.provenance, capturedAt: new Date(request.provenance.capturedAt) }),
        }),
        warnings,
      });
    } catch (error) {
      if (error instanceof FileIngestionError) {
        throw error;
      }

      if (error instanceof RuntimeDependencyUnavailableError) {
        throw new RuntimeUnavailableError("Document conversion runtime is unavailable.", {
          cause: error.message,
          fileName: evaluation.descriptor.name,
          dependency: error.resolution,
          remediationHints: error.resolution.remediationHints,
        });
      }

      if (error instanceof Error && /disabled|unavailable/i.test(error.message)) {
        throw new RuntimeUnavailableError("Document conversion runtime is unavailable.", {
          cause: error.message,
          fileName: evaluation.descriptor.name,
        });
      }

      throw new ConversionFailedError(`Failed to convert '${evaluation.descriptor.name}' to markdown.`, {
        cause: error instanceof Error ? error.message : String(error),
        fileName: evaluation.descriptor.name,
      });
    }
  }

  public async ingestFiles(
    profile: FileIngestionProfile,
    requests: ReadonlyArray<FileIngestionRequest>,
  ): Promise<ReadonlyArray<FileIngestionResult>> {
    return Object.freeze(await Promise.all(requests.map((request) => this.ingestFile(profile, request))));
  }
}


