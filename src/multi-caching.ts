import { coalesceAsync } from 'promise-coalesce';
import { Cache, Milliseconds, WrapOptions } from './types';
import { resolveTTL } from './utils';

export type MultiCache = Omit<Cache, 'store'> & Pick<Cache['store'], 'setMany' | 'getMany' | 'delMany'>;

/**
 * Module that lets you specify a hierarchy of caches.
 */
export const multiCaching = <C extends Cache[]>(caches: C): MultiCache => {
  const get = async <T>(key: string) => {
    for (const cache of caches) {
      try {
        const val = await cache.get<T>(key);
        if (val !== undefined) return val;
      } catch (e) {}
    }
  };
  const set = async <T>(key: string, data: T, ttl?: Milliseconds | undefined) => {
    await Promise.all(caches.map((cache) => cache.set(key, data, ttl)));
  };

  return {
    get,
    set,
    del: async (key) => {
      await Promise.all(caches.map((cache) => cache.del(key)));
    },
    wrap: async <T>(key: string, fn: () => Promise<T>, options?: WrapOptions<T>): Promise<T> =>
      coalesceAsync(key, async () => {
        let value: T | undefined;
        let i = 0;
        for (; i < caches.length; i++) {
          try {
            value = await caches[i].get<T>(key);
            if (value !== undefined) break;
          } catch (e) {}
        }
        if (value === undefined) {
          const result = await fn();
          const cacheTTL = resolveTTL(result, options?.ttl);
          await set<T>(key, result, cacheTTL);
          return result;
        } else {
          const cacheTTL = resolveTTL(value, options?.ttl);
          Promise.all(caches.slice(0, i).map((cache) => cache.set(key, value, cacheTTL))).then();
          caches[i].wrap(key, fn, options).then(); // call wrap for store for internal refreshThreshold logic, see: src/caching.ts caching.wrap
        }
        return value;
      }),
    reset: async () => {
      await Promise.all(caches.map((x) => x.reset()));
    },
    getMany: async (...keys: string[]) => {
      const values = new Array(keys.length).fill(undefined);
      for (const cache of caches) {
        if (values.every((x) => x !== undefined)) break;
        try {
          const val = await cache.store.getMany(...keys);
          val.forEach((v, i) => {
            if (values[i] === undefined && v !== undefined) values[i] = v;
          });
        } catch (e) {}
      }
      return values;
    },
    setMany: async (args: [string, unknown][], ttl?: Milliseconds) => {
      await Promise.all(caches.map((cache) => cache.store.setMany(args, ttl)));
    },
    delMany: async (...keys: string[]) => {
      await Promise.all(caches.map((cache) => cache.store.delMany(...keys)));
    },
  };
};
