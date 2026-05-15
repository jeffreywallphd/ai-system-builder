export type AsyncFeatureProvider<T extends object> = () => Promise<T>;

export function lazyProvidedObject<T extends object>(provider: AsyncFeatureProvider<T>, select?: (feature: T) => object): any {
  return new Proxy({}, {
    get(_target, property) {
      if (property === "then") return undefined;
      return async (...args: unknown[]) => {
        const feature = await provider();
        const object = select ? select(feature) : feature;
        const value = (object as Record<PropertyKey, unknown>)[property];
        if (typeof value !== "function") return value;
        return value.apply(object, args);
      };
    },
  });
}
