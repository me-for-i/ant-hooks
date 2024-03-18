import { useRef } from 'react';
import isPlainObject from 'lodash/isPlainObject';
import useCreation from '../useCreation';
import useUpdate from '../useUpdate';
/**
 * 之所以是用 WeakMap 是为了在组件卸载时不需要手动清理 Map 中已存在的 kv
 * 当组件卸载时，WeakMap 中的 kv 的引用关系只存在于 WeakMap 中，垃圾回收机制会忽略 WeakMap 中的引用关系，
 * 因此组件卸载时，kv 就会在某刻被回收掉，而不需要手动 clear
 */
// k:v 原对象:代理过的对象
const proxyMap = new WeakMap();
// k:v 代理过的对象:原对象
const rawMap = new WeakMap();

function observer<T extends Record<string, any>>(initialVal: T, cb: () => void): T {
  const existingProxy = proxyMap.get(initialVal);

  // 添加缓存 防止重新构建proxy
  if (existingProxy) {
    return existingProxy;
  }

  // 防止代理已经代理过的对象
  // https://github.com/alibaba/hooks/issues/839
  if (rawMap.has(initialVal)) {
    return initialVal;
  }

  const proxy = new Proxy<T>(initialVal, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);

      // https://github.com/alibaba/hooks/issues/1317
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      if (!descriptor?.configurable && !descriptor?.writable) {
        return res;
      }

      // Only proxy plain object or array,
      // otherwise it will cause: https://github.com/alibaba/hooks/issues/2080
      // 对象或数组需要再次代理，即对象中任意层级的引用值在外部使用时都是被代理后的版本
      return isPlainObject(res) || Array.isArray(res) ? observer(res, cb) : res;
    },
    set(target, key, val) {
      const ret = Reflect.set(target, key, val);
      cb();
      return ret;
    },
    deleteProperty(target, key) {
      const ret = Reflect.deleteProperty(target, key);
      cb();
      return ret;
    },
  });

  proxyMap.set(initialVal, proxy);
  rawMap.set(proxy, initialVal);

  return proxy;
}

function useReactive<S extends Record<string, any>>(initialState: S): S {
  const update = useUpdate();
  const stateRef = useRef<S>(initialState);

  const state = useCreation(() => {
    return observer(stateRef.current, () => {
      update();
    });
  }, []);

  return state;
}

export default useReactive;
