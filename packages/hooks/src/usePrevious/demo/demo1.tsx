/**
 * title: Basic usage
 * description: Record the previous value.
 *
 * title.zh-CN: 基础用法
 * description.zh-CN: 记录上次的 count 值
 */

import React, { useState } from 'react';
import { usePrevious } from 'ahooks';

export default () => {
  const [count, setCount] = useState(0);
  const previous = usePrevious(count);
  return (
    <>
      <div>counter current value: {count}</div>
      <div style={{ marginBottom: 8 }}>counter previous value: {previous}</div>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        increase
      </button>
      <button type="button" style={{ marginLeft: 8 }} onClick={() => setCount((c) => c - 1)}>
        decrease
      </button>
    </>
  );
};
