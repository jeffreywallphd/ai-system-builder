import type {
  CanonicalRunExecutionCommand,
  IRunExecutionDispatchPort,
  RunExecutionDispatchReceipt,
} from "@application/runs/ports/RunExecutionDispatchPorts";
import {
  createDispatchAcceptedOutcome,
  createDispatchFailureOutcome,
  type HandleRunDispatchResultRequest,
} from "./HandleRunDispatchResultUseCase";
import type {
  BuildAssignedRunExecutionCommandRequest,
} from "./BuildAssignedRunExecutionCommandUseCase";

interface DispatchAssignedRunExecutionCommandBuilderPort {
  execute(request: BuildAssignedRunExecutionCommandRequest): Promise<CanonicalRunExecutionCommand>;
}

interface DispatchAssignedRunExecutionUseCaseDependencies {
  readonly commandBuilder: DispatchAssignedRunExecutionCommandBuilderPort;
  readonly dispatchPort: IRunExecutionDispatchPort;
  readonly dispatchResultHandler: {
    execute(request: HandleRunDispatchResultRequest): Promise<unknown>;
  };
  readonly now?: () => Date;
}

export interface DispatchAssignedRunExecutionRequest extends BuildAssignedRunExecutionCommandRequest {}

export interface DispatchAssignedRunExecutionResult {
  readonly command: CanonicalRunExecutionCommand;
  readonly receipt: RunExecutionDispatchReceipt;
}

export class DispatchAssignedRunExecutionUseCase {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: DispatchAssignedRunExecutionUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(request: DispatchAssignedRunExecutionRequest): Promise<DispatchAssignedRunExecutionResult> {
    const command = await this.dependencies.commandBuilder.execute(request);
    const dispatchStartedAt = this.now().toISOString();
    let receipt: RunExecutionDispatchReceipt;
    try {
      receipt = await this.dependencies.dispatchPort.dispatch(command);
    } catch (error) {
      await this.dependencies.dispatchResultHandler.execute({
        command,
        dispatchStartedAt,
        outcome: createDispatchFailureOutcome({
          failedAt: this.now().toISOString(),
          error,
        }),
      });
      throw error;
    }

    await this.dependencies.dispatchResultHandler.execute({
      command,
      dispatchStartedAt,
      outcome: createDispatchAcceptedOutcome(receipt),
    });

    return Object.freeze({
      command,
      receipt,
    });
  }
}

