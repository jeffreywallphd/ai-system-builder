export interface PageActionRecord<TMetadata = Readonly<Record<string, unknown>>> {
  readonly id: string;
  readonly pageId: string;
  readonly type: string;
  readonly description: string;
  readonly occurredAt: string;
  readonly metadata?: TMetadata;
}

export interface PageActionTrackerState<TMetadata = Readonly<Record<string, unknown>>> {
  readonly entries: ReadonlyArray<PageActionRecord<TMetadata>>;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface RecordPageActionInput<TMetadata = Readonly<Record<string, unknown>>> {
  readonly type: string;
  readonly description: string;
  readonly metadata?: TMetadata;
  readonly occurredAt?: string;
}

export interface PageActionTrackerOptions {
  readonly pageId: string;
  readonly capacity?: number;
}

const defaultActionState: PageActionTrackerState = Object.freeze({
  entries: Object.freeze([]),
  canUndo: false,
  canRedo: false,
});

export class PageActionTracker<TMetadata = Readonly<Record<string, unknown>>> {
  private readonly pageId: string;
  private readonly capacity: number;
  private state: PageActionTrackerState<TMetadata>;

  constructor(options: PageActionTrackerOptions) {
    this.pageId = options.pageId.trim();
    this.capacity = Math.max(1, options.capacity ?? 100);
    this.state = defaultActionState as PageActionTrackerState<TMetadata>;
  }

  public getState(): PageActionTrackerState<TMetadata> {
    return this.state;
  }

  public record(action: RecordPageActionInput<TMetadata>): PageActionTrackerState<TMetadata> {
    const nextEntries = [
      ...this.state.entries,
      Object.freeze({
        id: `${this.pageId}:${Date.now()}:${this.state.entries.length}`,
        pageId: this.pageId,
        type: action.type.trim(),
        description: action.description.trim(),
        occurredAt: action.occurredAt ?? new Date().toISOString(),
        metadata: action.metadata,
      }),
    ].slice(-this.capacity);

    this.state = Object.freeze({
      entries: Object.freeze(nextEntries),
      canUndo: nextEntries.length > 0,
      canRedo: false,
    });

    return this.state;
  }

  public clear(): PageActionTrackerState<TMetadata> {
    this.state = defaultActionState as PageActionTrackerState<TMetadata>;
    return this.state;
  }
}
