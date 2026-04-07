import type { IComfyObjectInfo } from "../../../infrastructure/comfyui/catalog/ComfyNodeCatalogProvider";

export const SEED_NODE_CATALOG: Readonly<Record<string, IComfyObjectInfo>> =
  Object.freeze({
    PromptText: Object.freeze({
      display_name: "Prompt Text",
      description: "A basic text prompt node for workflow testing and composition.",
      category: "text/input",
      input: {
        required: Object.freeze({
          text: Object.freeze([
            "STRING",
            Object.freeze({
              default: "Describe the output you want.",
              multiline: true,
            }),
          ]),
        }),
      },
      output: Object.freeze(["STRING"]),
      output_name: Object.freeze(["text"]),
    }),

    CheckpointLoaderSimple: Object.freeze({
      display_name: "Checkpoint Loader",
      description: "Loads a model checkpoint.",
      category: "models/loaders",
      input: {
        required: Object.freeze({
          ckpt_name: Object.freeze([
            Object.freeze(["demo-model.safetensors", "starter-model.safetensors"]),
            Object.freeze({
              default: "demo-model.safetensors",
            }),
          ]),
        }),
      },
      output: Object.freeze(["MODEL", "CLIP", "VAE"]),
      output_name: Object.freeze(["model", "clip", "vae"]),
    }),

    KSampler: Object.freeze({
      display_name: "KSampler",
      description: "A sampling node used for image generation style workflows.",
      category: "sampling/core",
      input: {
        required: Object.freeze({
          model: Object.freeze(["MODEL"]),
          positive: Object.freeze(["CONDITIONING"]),
          negative: Object.freeze(["CONDITIONING"]),
          latent_image: Object.freeze(["LATENT"]),
          seed: Object.freeze([
            "INT",
            Object.freeze({
              default: 1,
              min: 0,
            }),
          ]),
          steps: Object.freeze([
            "INT",
            Object.freeze({
              default: 20,
              min: 1,
            }),
          ]),
          cfg: Object.freeze([
            "FLOAT",
            Object.freeze({
              default: 7,
              min: 0,
            }),
          ]),
        }),
        optional: Object.freeze({
          sampler_name: Object.freeze([
            Object.freeze(["euler", "euler_a", "dpmpp_2m"]),
            Object.freeze({
              default: "euler",
            }),
          ]),
        }),
      },
      output: Object.freeze(["LATENT"]),
      output_name: Object.freeze(["latent"]),
    }),

    SaveImage: Object.freeze({
      display_name: "Save Image",
      description: "Saves an image output.",
      category: "image/output",
      input: {
        required: Object.freeze({
          images: Object.freeze(["IMAGE"]),
          filename_prefix: Object.freeze([
            "STRING",
            Object.freeze({
              default: "ai-loom-output",
            }),
          ]),
        }),
      },
      output: Object.freeze([]),
      output_name: Object.freeze([]),
      output_node: true,
    }),
  });
