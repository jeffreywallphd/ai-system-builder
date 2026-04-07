export interface AutoSaveControllerOptions {
  readonly delayMs?: number;
  readonly onSave: () => Promise<void> | void;
}

export class AutoSaveController {
  private readonly delayMs: number;
  private readonly onSave: () => Promise<void> | void;
  private timer?: ReturnType<typeof setTimeout>;
  private inFlightSave?: Promise<void>;
  private shouldScheduleAfterSave = false;

  constructor(options: AutoSaveControllerOptions) {
    this.delayMs = Math.max(0, options.delayMs ?? 750);
    this.onSave = options.onSave;
  }

  public schedule(): void {
    if (this.inFlightSave) {
      this.shouldScheduleAfterSave = true;
      return;
    }

    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.delayMs);
  }

  public async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.inFlightSave) {
      this.shouldScheduleAfterSave = true;
      return this.inFlightSave;
    }

    const savePromise = Promise.resolve(this.onSave()).finally(() => {
      this.inFlightSave = undefined;

      if (this.shouldScheduleAfterSave) {
        this.shouldScheduleAfterSave = false;
        this.schedule();
      }
    });

    this.inFlightSave = savePromise;
    return savePromise;
  }

  public cancel(): void {
    if (!this.timer) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = undefined;
  }

  public dispose(): void {
    this.cancel();
  }
}
