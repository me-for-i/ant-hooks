import { useRef } from 'react';
import type { Plugin, Timeout } from '../types';

const useRetryPlugin: Plugin<any, any[]> = (fetchInstance, { retryInterval, retryCount }) => {
  const timerRef = useRef<Timeout>();
  const countRef = useRef(0);

  const triggerByRetry = useRef(false); // 请求是否由错误重试触发？

  if (!retryCount) {
    return {};
  }

  return {
    onBefore: () => {
      // 若本次请求不是由错误重试引起的，那么重置错误计数
      if (!triggerByRetry.current) {
        countRef.current = 0;
      }
      triggerByRetry.current = false;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    onSuccess: () => {
      countRef.current = 0;
    },
    onError: () => {
      countRef.current += 1;
      // 没有超过错误次数的限制
      if (retryCount === -1 || countRef.current <= retryCount) {
        // Exponential backoff
        // 随着错误次数的增加，重试的间隔时间成指数关系增长，最长为 30s
        const timeout = retryInterval ?? Math.min(1000 * 2 ** countRef.current, 30000);
        timerRef.current = setTimeout(() => {
          triggerByRetry.current = true;
          fetchInstance.refresh();
        }, timeout);
      } else {
        countRef.current = 0;
      }
    },
    onCancel: () => {
      countRef.current = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
  };
};

export default useRetryPlugin;
