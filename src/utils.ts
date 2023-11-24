import { WrapTTL } from './types';

export const resolveTTL = <T>(item: T, ttl?: WrapTTL<T>) => (typeof ttl === 'function' ? ttl(item) : ttl);
