import { coalesceAsync } from 'promise-coalesce';
import { resolveTTL } from './utils';
import { Cache, CacheOptions, Milliseconds, Store, WrapOptions } from './types';

/**
 * Generic caching interface that wraps any caching library with a compatible interface.
 */
export const caching = <S extends Store>(store: Store, cacheOptions?: CacheOptions): Cache<S> => ({
  /**
   * Wraps a function in cache. I.e., the first time the function is run,
   * its results are stored in cache so subsequent calls retrieve from cache
   * instead of calling the function.

   * @example
   * const result = await cache.wrap('key', () => Promise.resolve(1));
   *
   */
  wrap: async <T>(key: string, fn: () => Promise<T>, options?: WrapOptions<T>) => {
    return coalesceAsync(key, async () => {
      const value = await store.get<T>(key);
      if (value === undefined) {
        const result = await fn();
        const cacheTTL = resolveTTL(result, options?.ttl);
        await store.set<T>(key, result, cacheTTL);
        return result;
      } else if (cacheOptions?.refreshThreshold) {
        const cacheTTL = resolveTTL(value, options?.ttl);
        const remainingTtl = await store.ttl(key);
        if (remainingTtl !== -1 && remainingTtl < cacheOptions?.refreshThreshold) {
          fn().then((result) => store.set<T>(key, result, cacheTTL));
        }
      }
      return value;
    });
  },
  store: store as S,
  del: (key: string) => store.del(key),
  get: <T>(key: string) => store.get<T>(key),
  set: (key: string, value: unknown, ttl?: Milliseconds) => store.set(key, value, ttl),
  reset: () => store.reset(),
});
