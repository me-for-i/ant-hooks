import { useRef, useEffect } from 'react';

type Subscription<T> = (val: T) => void;

export class EventEmitter<T> {
  private subscriptions = new Set<Subscription<T>>();

  emit = (val: T) => {
    // 事件发出时，所有的订阅者都会接收到通知
    for (const subscription of this.subscriptions) {
      subscription(val);
    }
  };

  // 注意该 hook 在此处仅是声明，它的调用依然需要遵循 hook 的调用规则
  useSubscription = (callback: Subscription<T>) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const callbackRef = useRef<Subscription<T>>();
    callbackRef.current = callback;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      function subscription(val: T) {
        if (callbackRef.current) {
          callbackRef.current(val);
        }
      }
      // 不添加依赖只在首次调用时添加订阅
      this.subscriptions.add(subscription);
      return () => {
        this.subscriptions.delete(subscription);
      };
    }, []);
  };
}

export default function useEventEmitter<T = void>() {
  const ref = useRef<EventEmitter<T>>();
  // 单例模式，始终返回一开始创建的对象
  if (!ref.current) {
    ref.current = new EventEmitter();
  }
  return ref.current;
}
