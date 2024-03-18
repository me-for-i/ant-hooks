import { useRef } from 'react';
import useUpdateEffect from '../../../useUpdateEffect';
import type { Plugin, Timeout } from '../types';
import isDocumentVisible from '../utils/isDocumentVisible';
import subscribeReVisible from '../utils/subscribeReVisible';

const usePollingPlugin: Plugin<any, any[]> = (
  fetchInstance,
  { pollingInterval, pollingWhenHidden = true, pollingErrorRetryCount = -1 },
) => {
  const timerRef = useRef<Timeout>();
  const unsubscribeRef = useRef<() => void>();
  const countRef = useRef<number>(0);

  const stopPolling = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    unsubscribeRef.current?.();
  };

  // 轮询是一个持续进行的过程，可能在某个时刻，轮询停止，此刻需要 stopPolling
  useUpdateEffect(() => {
    if (!pollingInterval) {
      stopPolling();
    }
  }, [pollingInterval]);

  if (!pollingInterval) {
    return {};
  }

  return {
    onBefore: () => {
      stopPolling();
    },
    onError: () => {
      countRef.current += 1;
    },
    onSuccess: () => {
      countRef.current = 0;
    },
    onFinally: () => {
      if (
        // 不限制轮询错误次数
        pollingErrorRetryCount === -1 ||
        // When an error occurs, the request is not repeated after pollingErrorRetryCount retries
        // 错误次数在接受的范围内
        (pollingErrorRetryCount !== -1 && countRef.current <= pollingErrorRetryCount)
      ) {
        timerRef.current = setTimeout(() => {
          // if pollingWhenHidden = false && document is hidden, then stop polling and subscribe revisible
          // 若页面隐藏时不继续轮询则页面隐藏时，停止轮询，订阅页面重新可见的事件
          if (!pollingWhenHidden && !isDocumentVisible()) {
            // subscribeReVisible 会将所有订阅函数在页面重新可见时触发
            unsubscribeRef.current = subscribeReVisible(() => {
              // refresh 成功后就会开启下一次 onFinally
              fetchInstance.refresh();
            });
          } else {
            fetchInstance.refresh();
          }
        }, pollingInterval);
      } else {
        // 结束轮询条件满足时，重置轮询次数
        countRef.current = 0;
      }
    },
    onCancel: () => {
      stopPolling();
    },
  };
};

export default usePollingPlugin;
