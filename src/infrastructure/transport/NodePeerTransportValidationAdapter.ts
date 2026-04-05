import type {
  AuthorizeNodePeerCommunicationOutcome,
  AuthorizeNodePeerCommunicationUseCase,
} from "../../application/security/use-cases/AuthorizeNodePeerCommunicationUseCase";

export const NodePeerTransportValidationErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  forbidden: "forbidden",
  internal: "internal",
});

export type NodePeerTransportValidationErrorCode =
  typeof NodePeerTransportValidationErrorCodes[keyof typeof NodePeerTransportValidationErrorCodes];

export interface NodePeerTransportValidationError {
  readonly code: NodePeerTransportValidationErrorCode;
  readonly message: string;
  readonly reasons?: ReadonlyArray<string>;
}

export type NodePeerTransportValidationResult =
  | {
    readonly ok: true;
    readonly decision: Extract<AuthorizeNodePeerCommunicationOutcome, { readonly ok: true }>["value"];
  }
  | {
    readonly ok: false;
    readonly statusCode: number;
    readonly error: NodePeerTransportValidationError;
  };

type NodePeerValidator = Pick<AuthorizeNodePeerCommunicationUseCase, "execute">;

export class NodePeerTransportValidationAdapter {
  public constructor(private readonly validator: NodePeerValidator) {}

  public async validate(
    request: Parameters<NodePeerValidator["execute"]>[0],
  ): Promise<NodePeerTransportValidationResult> {
    const outcome = await this.validator.execute(request);
    if (!outcome.ok) {
      if (outcome.error.code === "authorize-node-peer-communication-invalid-request") {
        return Object.freeze({
          ok: false,
          statusCode: 400,
          error: Object.freeze({
            code: NodePeerTransportValidationErrorCodes.invalidRequest,
            message: outcome.error.message,
          }),
        });
      }
      return Object.freeze({
        ok: false,
        statusCode: 500,
        error: Object.freeze({
          code: NodePeerTransportValidationErrorCodes.internal,
          message: "Node peer transport validation failed unexpectedly.",
        }),
      });
    }

    if (outcome.value.accepted) {
      return Object.freeze({
        ok: true,
        decision: outcome.value,
      });
    }

    return Object.freeze({
      ok: false,
      statusCode: 403,
      error: Object.freeze({
        code: NodePeerTransportValidationErrorCodes.forbidden,
        message: "Node peer transport is not authorized for this operation.",
        reasons: outcome.value.rejectionReasons,
      }),
    });
  }
}
