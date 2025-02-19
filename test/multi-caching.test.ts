import { describe, expect, it, beforeEach, vi } from 'vitest';
import { faker } from '@faker-js/faker';

import { sleep } from './utils';

import { Cache, caching, MultiCache, multiCaching, Store, createLruStore } from '../src';

describe('multiCaching', () => {
  let memoryCache: Cache;
  let memoryCache2: Cache;
  let memoryCache3: Cache;
  let multiCache: MultiCache;
  let ttl: number;
  let defaultTtl: number;
  let key: string;

  async function multiMset() {
    const keys = [faker.string.sample(20), faker.string.sample(20)];
    const values = [faker.string.sample(), faker.string.sample()];
    await multiCache.setMany(
      [
        [keys[0], values[0]],
        [keys[1], values[1]],
      ],
      defaultTtl,
    );
    return { keys, values };
  }

  beforeEach(async () => {
    ttl = 100;
    defaultTtl = 5000;

    memoryCache = caching(
      createLruStore({
        ttl,
      }),
    );
    memoryCache2 = caching(
      createLruStore({
        ttl,
      }),
    );
    memoryCache3 = caching(
      createLruStore({
        ttl,
      }),
    );

    key = faker.string.sample(20);
  });

  describe('get(), set(), del(), reset(), getMany(), setMany()', () => {
    let value: string;

    beforeEach(() => {
      multiCache = multiCaching([memoryCache, memoryCache2, memoryCache3]);
      key = faker.string.sample(20);
      value = faker.string.sample();
    });

    describe('set()', () => {
      it('lets us set data in all caches', async () => {
        await multiCache.set(key, value, defaultTtl);
        await expect(memoryCache.get(key)).resolves.toEqual(value);
        await expect(memoryCache2.get(key)).resolves.toEqual(value);
        await expect(memoryCache3.get(key)).resolves.toEqual(value);
      });
    });

    describe('get()', () => {
      it('lets us get data', async () => {
        await multiCache.set(key, value, defaultTtl);
        await expect(multiCache.get(key)).resolves.toEqual(value);
      });
    });

    describe('wrap()', () => {
      it('should get data', async () => {
        await multiCache.wrap(key, async () => value);
        await expect(memoryCache.get(key)).resolves.toEqual(value);
        await expect(memoryCache2.get(key)).resolves.toEqual(value);
        await expect(memoryCache3.get(key)).resolves.toEqual(value);
        await expect(multiCache.wrap(key, async () => 'foo')).resolves.toEqual(value);
      });

      it('lets us set the ttl to be milliseconds', async () => {
        const ttl = 2 * 1000;
        await multiCache.wrap(key, async () => value, { ttl });

        await expect(memoryCache.get(key)).resolves.toEqual(value);
        await expect(memoryCache2.get(key)).resolves.toEqual(value);
        await expect(memoryCache3.get(key)).resolves.toEqual(value);
        await expect(multiCache.wrap(key, async () => 'foo')).resolves.toEqual(value);

        await sleep(ttl);
        await expect(memoryCache.get(key)).resolves.toBeUndefined();
        await expect(memoryCache2.get(key)).resolves.toBeUndefined();
        await expect(memoryCache3.get(key)).resolves.toBeUndefined();
        await expect(multiCache.wrap(key, async () => 'foo')).resolves.toEqual('foo');
      });

      it('lets us set the ttl to be a function', async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const sec = faker.number.int({ min: 2, max: 4 });
        value = faker.string.sample(sec * 2);
        const fn = vi.fn((v: string) => (v.length / 2) * 1000);
        await multiCache.wrap(key, async () => value, { ttl: fn });
        await expect(memoryCache.get(key)).resolves.toEqual(value);
        await expect(memoryCache2.get(key)).resolves.toEqual(value);
        await expect(memoryCache3.get(key)).resolves.toEqual(value);
        await expect(multiCache.wrap(key, async () => 'foo')).resolves.toEqual(value);
        expect(fn).toHaveBeenCalledTimes(1);
        await sleep(sec * 1000);
        await expect(memoryCache.get(key)).resolves.toBeUndefined();
        await expect(memoryCache2.get(key)).resolves.toBeUndefined();
        await expect(memoryCache3.get(key)).resolves.toBeUndefined();
        await expect(multiCache.wrap(key, async () => 'foo')).resolves.toEqual('foo');
      });
    });

    describe('del()', () => {
      it('should delete data', async () => {
        await multiCache.set(key, value);
        await multiCache.del(key);
        await expect(multiCache.get(key)).resolves.toBeUndefined();
      });
    });

    describe('reset()', () => {
      it('should reset cache', async () => {
        await multiCache.set(key, value);
        await multiCache.reset();
        await expect(multiCache.get(key)).resolves.toBeUndefined();
      });
    });

    describe('setMany()', () => {
      it('lets us set multiple keys in all caches', async () => {
        const { keys, values } = await multiMset();
        await expect(memoryCache.get(keys[0])).resolves.toEqual(values[0]);
        await expect(memoryCache2.get(keys[0])).resolves.toEqual(values[0]);
        await expect(memoryCache3.get(keys[0])).resolves.toEqual(values[0]);
        await expect(memoryCache.get(keys[1])).resolves.toEqual(values[1]);
        await expect(memoryCache2.get(keys[1])).resolves.toEqual(values[1]);
        await expect(memoryCache3.get(keys[1])).resolves.toEqual(values[1]);
      });
    });

    describe('getMany()', () => {
      it('lets us get multiple keys', async () => {
        const { keys, values } = await multiMset();
        await multiCache.set(keys[0], values[0], defaultTtl);
        await memoryCache3.set(keys[1], values[1], defaultTtl);
        await expect(multiCache.getMany(...keys)).resolves.toStrictEqual(values);
      });

      it('lets us get multiple undefined', async () => {
        const len = 4;
        await multiMset();
        const args = new Array(len).fill('').map(() => faker.string.sample());
        await expect(multiCache.getMany(...args)).resolves.toStrictEqual(new Array(len).fill(undefined));
      });
    });

    describe('delMany()', () => {
      it('lets us delete multiple keys', async () => {
        const { keys } = await multiMset();
        await multiCache.delMany(...keys);
        await expect(memoryCache.get(keys[0])).resolves.toBeUndefined();
        await expect(memoryCache.get(keys[1])).resolves.toBeUndefined();
      });
    });

    describe('when cache fails', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const empty = (async () => {}) as never;
      const cache: Cache = {
        get: async () => {
          throw new Error();
        },
        set: empty,
        del: empty,
        reset: empty,
        wrap: empty,
        store: {} as Store,
      };

      const cacheEmpty: Cache = {
        get: empty,
        set: empty,
        del: empty,
        reset: empty,
        wrap: empty,
        store: {} as Store,
      };

      it('should get error', async () => {
        multiCache = multiCaching([cache, memoryCache]);
        await multiCache.set(key, value);
        await expect(multiCache.get(key)).resolves.toEqual(value);
      });

      it('should get all error', async () => {
        multiCache = multiCaching([cache]);
        await multiCache.set(key, value);
        await expect(multiCache.get(key)).resolves.toBeUndefined();
      });

      it('should get empty', async () => {
        multiCache = multiCaching([cacheEmpty, memoryCache]);
        await multiCache.set(key, value);
        await expect(multiCache.get(key)).resolves.toEqual(value);
      });

      it('should get all empty', async () => {
        multiCache = multiCaching([cacheEmpty, cacheEmpty]);
        await multiCache.set(key, value);
        await expect(multiCache.get(key)).resolves.toBeUndefined();
      });
    });
  });

  describe('issues', () => {
    it('#253', async () => {
      const cache0 = caching(createLruStore({ ttl: 500 }));
      const cache1 = caching(createLruStore({ ttl: 1000 }));
      const multi = multiCaching([cache0, cache1]);
      const key = 'bar';
      const value = 'foo';

      const fn = async () => value;

      await multi.wrap(key, fn);
      await sleep(600);
      await expect(cache0.get(key)).resolves.toBeUndefined();
      await expect(cache1.get(key)).resolves.toEqual(value);

      await multi.wrap(key, fn);

      await expect(cache0.get(key)).resolves.toEqual(value);
      await expect(cache1.get(key)).resolves.toEqual(value);
    });
  });
});
