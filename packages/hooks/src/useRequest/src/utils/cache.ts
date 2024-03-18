type Timer = ReturnType<typeof setTimeout>;
type CachedKey = string | number;

export interface CachedData<TData = any, TParams = any> {
  data: TData;
  params: TParams;
  time: number;
}
interface RecordData extends CachedData {
  timer: Timer | undefined;
}

const cache = new Map<CachedKey, RecordData>();

const setCache = (key: CachedKey, cacheTime: number, cachedData: CachedData) => {
  const currentCache = cache.get(key);
  if (currentCache?.timer) {
    clearTimeout(currentCache.timer);
  }

  let timer: Timer | undefined = undefined;

  if (cacheTime > -1) {
    // if cache out, clear it
    // 同一 key 对应的 cache 被更新时重置该 key 的过期时间
    timer = setTimeout(() => {
      cache.delete(key);
    }, cacheTime);
  }

  // cache 保存时同时记录 timer 方便清除
  cache.set(key, {
    ...cachedData,
    timer,
  });
};

const getCache = (key: CachedKey) => {
  return cache.get(key);
};

const clearCache = (key?: string | string[]) => {
  if (key) {
    const cacheKeys = Array.isArray(key) ? key : [key];
    cacheKeys.forEach((cacheKey) => cache.delete(cacheKey));
  } else {
    cache.clear();
  }
};

export { getCache, setCache, clearCache };
