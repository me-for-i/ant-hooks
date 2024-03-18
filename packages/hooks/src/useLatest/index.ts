import { useRef } from 'react';
// 使用 ref 保存最新值或许是一个常用的逻辑，通常来说是用来保存函数，因此函数不必存在于 effect 的依赖中
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;

  return ref;
}

export default useLatest;
