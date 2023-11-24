import { vi } from 'vitest';
import { Store } from '../src';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const buildMockStore = (): Store => ({
  get: vi.fn(),
  ttl: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  mset: vi.fn(),
  reset: vi.fn(),
  mget: vi.fn(),
  mdel: vi.fn(),
});
