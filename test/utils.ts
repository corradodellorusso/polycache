import { vi } from 'vitest';
import { Store } from '../src';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const buildMockStore = (): Store => ({
  get: vi.fn(),
  ttl: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  setMany: vi.fn(),
  reset: vi.fn(),
  getMany: vi.fn(),
  delMany: vi.fn(),
});
