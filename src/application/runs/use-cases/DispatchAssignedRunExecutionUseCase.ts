import type {
  CanonicalRunExecutionCommand,
  IRunExecutionDispatchPort,
  RunExecutionDispatchReceipt,
} from "@application/runs/ports/RunExecutionDispatchPorts";
import type {
  BuildAssignedRunExecutionCommandRequest,
} from "./BuildAssignedRunExecutionCommandUseCase";

interface DispatchAssignedRunExecutionCommandBuilderPort {
  execute(request: BuildAssignedRunExecutionCommandRequest): Promise<CanonicalRunExecutionCommand>;
}

interface DispatchAssignedRunExecutionUseCaseDependencies {
  readonly commandBuilder: DispatchAssignedRunExecutionCommandBuilderPort;
  readonly dispatchPort: IRunExecutionDispatchPort;
}

export interface DispatchAssignedRunExecutionRequest extends BuildAssignedRunExecutionCommandRequest {}

export interface DispatchAssignedRunExecutionResult {
  readonly command: CanonicalRunExecutionCommand;
  readonly receipt: RunExecutionDispatchReceipt;
}

export class DispatchAssignedRunExecutionUseCase {
  public constructor(private readonly dependencies: DispatchAssignedRunExecutionUseCaseDependencies) {}

  public async execute(request: DispatchAssignedRunExecutionRequest): Promise<DispatchAssignedRunExecutionResult> {
    const command = await this.dependencies.commandBuilder.execute(request);
    const receipt = await this.dependencies.dispatchPort.dispatch(command);
    return Object.freeze({
      command,
      receipt,
    });
  }
}

