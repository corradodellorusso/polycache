export type Milliseconds = number;

export type Store = {
  name: string;
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, data: T, ttl?: Milliseconds): Promise<void>;
  del(key: string): Promise<void>;
  reset(): Promise<void>;
  setMany(args: [string, unknown][], ttl?: Milliseconds): Promise<void>;
  getMany(...args: string[]): Promise<unknown[]>;
  delMany(...args: string[]): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
};

export type WrapTTL<T> = Milliseconds | ((v: T) => Milliseconds);

export type WrapOptions<T> = {
  ttl?: WrapTTL<T>;
};

export type CacheOptions = {
  refreshThreshold?: Milliseconds;
};

export type Cache<S extends Store = Store> = {
  set: (key: string, value: unknown, ttl?: Milliseconds) => Promise<void>;
  get: <T>(key: string) => Promise<T | undefined>;
  del: (key: string) => Promise<void>;
  reset: () => Promise<void>;
  wrap: <T>(key: string, fn: () => Promise<T>, ttl?: WrapOptions<T>) => Promise<T>;
  store: S;
};
