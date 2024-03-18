import type { DebouncedFunc, DebounceSettings } from 'lodash';
import debounce from 'lodash/debounce';
import { useEffect, useMemo, useRef } from 'react';
import type { Plugin } from '../types';

const useDebouncePlugin: Plugin<any, any[]> = (
  fetchInstance,
  { debounceWait, debounceLeading, debounceTrailing, debounceMaxWait },
) => {
  const debouncedRef = useRef<DebouncedFunc<any>>();

  // 转换为 debounce 可接受的参数
  const options = useMemo(() => {
    const ret: DebounceSettings = {};
    if (debounceLeading !== undefined) {
      ret.leading = debounceLeading;
    }
    if (debounceTrailing !== undefined) {
      ret.trailing = debounceTrailing;
    }
    if (debounceMaxWait !== undefined) {
      ret.maxWait = debounceMaxWait;
    }
    return ret;
  }, [debounceLeading, debounceTrailing, debounceMaxWait]);

  useEffect(() => {
    if (debounceWait) {
      // 保存原始的 runAsync 逻辑，函数内部的 this 是在调用时确定的，因此这里需要重新指定 this
      const _originRunAsync = fetchInstance.runAsync.bind(fetchInstance);

      // debounce 返回值为 func 同类型的新 func，因此 debouncedRef.current 调用时的参数即为 callback
      debouncedRef.current = debounce(
        (callback) => {
          callback();
        },
        debounceWait,
        options,
      );

      // debounce runAsync should be promise
      // https://github.com/lodash/lodash/issues/4400#issuecomment-834800398
      // 替换原本的的 runAsync 逻辑
      fetchInstance.runAsync = (...args) => {
        return new Promise((resolve, reject) => {
          debouncedRef.current?.(() => {
            _originRunAsync(...args)
              .then(resolve)
              .catch(reject);
          });
        });
      };

      return () => {
        // lodash.debounce 挂载一个 cancel 函数用于取消
        debouncedRef.current?.cancel();
        // 依赖变化时 runAsync 可能被使用，恢复原本的 runAsync
        fetchInstance.runAsync = _originRunAsync;
      };
    }
  }, [debounceWait, options]);

  if (!debounceWait) {
    return {};
  }

  return {
    onCancel: () => {
      debouncedRef.current?.cancel();
    },
  };
};

export default useDebouncePlugin;
