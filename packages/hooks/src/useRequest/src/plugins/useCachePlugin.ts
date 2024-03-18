import { useRef } from 'react';
import useCreation from '../../../useCreation';
import useUnmount from '../../../useUnmount';
import type { Plugin } from '../types';
import { setCache, getCache } from '../utils/cache';
import type { CachedData } from '../utils/cache';
import { setCachePromise, getCachePromise } from '../utils/cachePromise';
import { trigger, subscribe } from '../utils/cacheSubscribe';

const useCachePlugin: Plugin<any, any[]> = (
  fetchInstance,
  {
    cacheKey,
    cacheTime = 5 * 60 * 1000, // 默认 5min 过期，过期的 cache 会被清除
    staleTime = 0, // 新鲜时间，与 cacheTime 不同，staleTime 决定未过期的 cache 是否会被使用并取消当前请求
    setCache: customSetCache,
    getCache: customGetCache,
  },
) => {
  const unSubscribeRef = useRef<() => void>();

  const currentPromiseRef = useRef<Promise<any>>();

  const _setCache = (key: string, cachedData: CachedData) => {
    // 优先使用自定义的 setCache 方式
    if (customSetCache) {
      customSetCache(cachedData);
    } else {
      setCache(key, cacheTime, cachedData);
    }
    trigger(key, cachedData.data);
  };

  const _getCache = (key: string, params: any[] = []) => {
    // 优先使用自定义的 getCache 方式
    if (customGetCache) {
      return customGetCache(params);
    }
    return getCache(key);
  };

  useCreation(() => {
    if (!cacheKey) {
      return;
    }

    // get data from cache when init
    const cacheData = _getCache(cacheKey);
    if (cacheData && Object.hasOwnProperty.call(cacheData, 'data')) {
      // 只要可以拿到 data 则说明没有过期，直接在当前 fetch 实例中使用
      fetchInstance.state.data = cacheData.data;
      fetchInstance.state.params = cacheData.params;
      // 如果 staleTime 为 -1 或者当前时间与缓存时间差小于 staleTime，则认为数据是新鲜的，无需继续请求
      if (staleTime === -1 || new Date().getTime() - cacheData.time <= staleTime) {
        fetchInstance.state.loading = false;
      }
    }

    // subscribe same cachekey update, trigger update
    // 订阅 cacheKey 更新，触发更新，触发更新会重新设置 request 返回的 data，同名 cacheKey 的 request 可以借助缓存同步数据
    unSubscribeRef.current = subscribe(cacheKey, (data) => {
      fetchInstance.setState({ data });
    });
  }, []);

  // 卸载时，相应 cache 同步清除
  useUnmount(() => {
    unSubscribeRef.current?.();
  });

  // 若 cacheKey 不存在，视为不使用缓存功能
  if (!cacheKey) {
    return {};
  }

  return {
    onBefore: (params) => {
      const cacheData = _getCache(cacheKey, params);

      if (!cacheData || !Object.hasOwnProperty.call(cacheData, 'data')) {
        return {};
      }

      // If the data is fresh, stop request
      // 请求前检查一次 cache 是否新鲜，若新鲜则直接返回数据，停止请求
      if (staleTime === -1 || new Date().getTime() - cacheData.time <= staleTime) {
        return {
          loading: false,
          data: cacheData?.data,
          error: undefined,
          returnNow: true,
        };
      } else {
        // If the data is stale, return data, and request continue
        return {
          data: cacheData?.data,
          error: undefined,
        };
      }
    },
    onRequest: (service, args) => {
      // 同名 cacheKey 的多个 request 同时进行时，会共用一个 promise 结果
      let servicePromise = getCachePromise(cacheKey);

      // If has servicePromise, and is not trigger by self, then use it
      if (servicePromise && servicePromise !== currentPromiseRef.current) {
        return { servicePromise };
      }
      // service 本身为一个 promise 函数，调用之后得到一个 promise 对象，已经保存有响应数据，故 cacheKey 同名的 request 会得到相同的响应结果
      servicePromise = service(...args);
      currentPromiseRef.current = servicePromise;
      // 构建 cacheKey 和 servicePromise 映射关系，方便下次找到之前缓存的 promise 数据对象
      setCachePromise(cacheKey, servicePromise);
      return { servicePromise };
    },
    onSuccess: (data, params) => {
      if (cacheKey) {
        /**
         * 一般来说 cacheKey 在每个 fetchInstance 创建时都是一同唯一创建的，
         * 在 onSuccess 调用前 fetchInstance.setState({ data: d }) 就已经被应用过了
         * 这里仍使用 unsubscribe-resubscribe 模式，是为多个 fetchInstance 使用同一个 cacheKey 指代的缓存的场景
         *  */
        // 请求成功则应更新 cache，为避免二次更新 data，需要先取消当前订阅
        // cancel subscribe, avoid trgger self
        unSubscribeRef.current?.();
        _setCache(cacheKey, {
          data,
          params,
          time: new Date().getTime(),
        });
        // resubscribe
        // 订阅机制实现同名 cacheKey 的所有 request 的数据全局同步
        unSubscribeRef.current = subscribe(cacheKey, (d) => {
          fetchInstance.setState({ data: d });
        });
      }
    },
    onMutate: (data) => {
      if (cacheKey) {
        // cancel subscribe, avoid trigger self
        unSubscribeRef.current?.();
        _setCache(cacheKey, {
          data,
          params: fetchInstance.state.params,
          time: new Date().getTime(),
        });
        // resubscribe
        unSubscribeRef.current = subscribe(cacheKey, (d) => {
          fetchInstance.setState({ data: d });
        });
      }
    },
  };
};

export default useCachePlugin;
