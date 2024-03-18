import { useRef } from 'react';
import useUpdateEffect from '../../../useUpdateEffect';
import type { Plugin } from '../types';

// support refreshDeps & ready
const useAutoRunPlugin: Plugin<any, any[]> = (
  fetchInstance,
  { manual, ready = true, defaultParams = [], refreshDeps = [], refreshDepsAction },
) => {
  const hasAutoRun = useRef(false); // 用于判断是否已经执行过自动执行，若自动执行过，则会锁住 refresh 行为
  hasAutoRun.current = false;
  // 由于 hasAutoRun.current 锁的存在，每次 hook 执行最多执行 run 或者 refresh 其中之一
  useUpdateEffect(() => {
    if (!manual && ready) {
      hasAutoRun.current = true;
      fetchInstance.run(...defaultParams); // 这里的逻辑是否有问题，每次 ready 由 false 转为 true 都是用 defaultParams 进行请求
    }
  }, [ready]);
  // refresh 时不关心是否 ready，refreshDeps 变化时且未自动执行过时刷新
  useUpdateEffect(() => {
    if (hasAutoRun.current) {
      return;
    }
    if (!manual) {
      hasAutoRun.current = true;
      if (refreshDepsAction) {
        refreshDepsAction();
      } else {
        fetchInstance.refresh();
      }
    }
  }, [...refreshDeps]);

  return {
    onBefore: () => {
      if (!ready) {
        return {
          stopNow: true,
        };
      }
    },
  };
};

useAutoRunPlugin.onInit = ({ ready = true, manual }) => {
  // 若未使用自动执行请求，则初始化时会将 loading 的状态设置正确
  return {
    loading: !manual && ready,
  };
};

export default useAutoRunPlugin;
