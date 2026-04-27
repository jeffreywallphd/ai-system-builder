import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import type { ModelPublisherPort } from "../../../application/ports/model";
import type { PublishModelRequest, PublishModelResult } from "../../../contracts/model";

interface HuggingFaceUploadClient {
  uploadFile(params: {
    repo: string;
    path: string;
    content: Uint8Array;
    token?: string;
    revision?: string;
    private?: boolean;
  }): Promise<void>;
}

export interface CreateHuggingFaceModelPublisherAdapterOptions {
  client: HuggingFaceUploadClient;
  tokenProvider?: () => string | undefined;
}

async function collectFiles(root: string, current: string, output: string[] = []): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(current, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(root, full, output);
      continue;
    }
    output.push(relative(root, full));
  }
  return output;
}

function mapError(error: unknown): Error {
  const value = error as { statusCode?: number; status?: number; message?: string };
  const status = value.statusCode ?? value.status;
  if (status === 401 || status === 403) {
    return new Error("Hugging Face publish failed: unauthorized.");
  }
  if (status === 404) {
    return new Error("Hugging Face publish failed: repository not found.");
  }
  if (status === 429) {
    return new Error("Hugging Face publish failed: rate limited.");
  }
  return new Error(`Hugging Face publish failed: ${value.message ?? String(error)}`);
}

export function createHuggingFaceModelPublisherAdapter(
  options: CreateHuggingFaceModelPublisherAdapterOptions,
): ModelPublisherPort {
  return {
    async publishModel(request: PublishModelRequest & { modelPath: string }): Promise<PublishModelResult> {
      const token = request.token ?? options.tokenProvider?.();
      const fileStats = await stat(request.modelPath);
      if (!fileStats.isDirectory()) {
        throw new Error("publishModel requires a model directory path.");
      }

      const files = await collectFiles(request.modelPath, request.modelPath);
      const required = ["config.json"];
      if (!files.some((file) => file.endsWith(".safetensors"))) {
        throw new Error("Publishing requires safetensors artifacts.");
      }
      for (const requiredFile of required) {
        if (!files.includes(requiredFile) && !files.includes(`./${requiredFile}`)) {
          // allow adapter-only publish without config
          if (!files.includes("adapter_config.json")) {
            throw new Error(`Publishing requires ${requiredFile} for full model outputs.`);
          }
        }
      }

      for (const file of files) {
        const fullPath = join(request.modelPath, file);
        const content = new Uint8Array(await (await import("node:fs/promises")).readFile(fullPath));
        const remotePath = `${request.pathPrefix ? `${request.pathPrefix.replace(/\/$/, "")}/` : ""}${file}`;
        try {
          await options.client.uploadFile({
            repo: request.repository,
            path: remotePath,
            content,
            token,
            revision: request.revision,
            private: request.private,
          });
        } catch (error) {
          throw mapError(error);
        }
      }

      return {
        modelRecordId: request.modelRecordId,
        published: true,
        provider: "huggingface",
        repository: request.repository,
        revision: request.revision,
        url: `https://huggingface.co/${request.repository}`,
      };
    },
  };
}
