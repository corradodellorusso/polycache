import { LRUCache } from 'lru-cache';
import cloneDeep from 'lodash.clonedeep';

import { Store } from '../types';

function clone<T>(object: T): T {
  if (typeof object === 'object' && object !== null) {
    return cloneDeep(object);
  }
  return object;
}

type LRU = LRUCache<string, any, unknown>;
type LRUOptions = Omit<LRUCache.Options<string, any, unknown>, 'ttlAutopurge'> &
  Partial<Pick<LRUCache.Options<string, any, unknown>, 'ttlAutopurge'>>;

export type LRUConfig = {
  shouldCloneBeforeSet?: boolean;
  isCacheable?: (val: unknown) => boolean;
} & LRUOptions;

export type LRUStore = Store & {
  get size(): number;
  dump: LRU['dump'];
  load: LRU['load'];
  calculatedSize: LRU['calculatedSize'];
};

/**
 * Wrapper for lru-cache.
 */
export const createLruStore = (args?: LRUConfig): LRUStore => {
  const shouldCloneBeforeSet = args?.shouldCloneBeforeSet !== false; // clone by default
  const isCacheable = args?.isCacheable ?? ((val) => val !== undefined);

  const lruOpts = {
    ttlAutopurge: true,
    ...args,
    max: args?.max || 500,
    ttl: args?.ttl !== undefined ? args.ttl : 0,
  };

  const lruCache = new LRUCache(lruOpts);

  return {
    name: 'memory-lru',
    del: async (key) => {
      lruCache.delete(key);
    },
    get: async <T>(key: string) => lruCache.get(key) as T,
    keys: async () => [...lruCache.keys()],
    getMany: async (...args) => args.map((x) => lruCache.get(x)),
    setMany: async (args, ttl?) => {
      const opt = { ttl: ttl !== undefined ? ttl : lruOpts.ttl } as const;
      for (const [key, value] of args) {
        if (!isCacheable(value)) {
          // TODO: this should probably be configurable
          throw new Error(`no cacheable value ${JSON.stringify(value)}`);
        }
        if (shouldCloneBeforeSet) {
          lruCache.set(key, clone(value), opt);
        } else {
          lruCache.set(key, value, opt);
        }
      }
    },
    delMany: async (...args) => {
      for (const key of args) {
        lruCache.delete(key);
      }
    },
    reset: async () => {
      lruCache.clear();
    },
    ttl: async (key) => lruCache.getRemainingTTL(key),
    set: async (key, value, opt) => {
      if (!isCacheable(value)) {
        throw new Error(`no cacheable value ${JSON.stringify(value)}`);
      }
      if (shouldCloneBeforeSet) {
        value = clone(value);
      }
      const ttl = opt !== undefined ? opt : lruOpts.ttl;
      lruCache.set(key, value, { ttl });
    },
    get calculatedSize() {
      return lruCache.calculatedSize;
    },
    /**
     * This method is not available in the caching modules.
     */
    get size() {
      return lruCache.size;
    },
    /**
     * This method is not available in the caching modules.
     */
    dump: () => lruCache.dump(),
    /**
     * This method is not available in the caching modules.
     */
    load: (...args: Parameters<LRU['load']>) => lruCache.load(...args),
  };
};
