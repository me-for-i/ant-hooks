import { useMemo, useRef } from 'react';
import type { SetStateAction } from 'react';
import { isFunction } from '../utils';
import useMemoizedFn from '../useMemoizedFn';
import useUpdate from '../useUpdate';

export interface Options<T> {
  defaultValue?: T;
  defaultValuePropName?: string;
  valuePropName?: string;
  trigger?: string;
}

export type Props = Record<string, any>;

export interface StandardProps<T> {
  value: T;
  defaultValue?: T;
  onChange: (val: T) => void;
}

function useControllableValue<T = any>(
  props: StandardProps<T>,
): [T, (v: SetStateAction<T>) => void];

function useControllableValue<T = any>(
  props?: Props,
  options?: Options<T>,
): [T, (v: SetStateAction<T>, ...args: any[]) => void];

/**
 * 使用两个函数重载，useControllableValue 支持两种调用形式，若存在 props 且 props 满足 StandardProps 描述则按照重载 1 的形式进行调用
 * 最终返回类似[state,setState]的形式，若不满足 StandardProps 或者 props 本身不存在则使用重载 2。
 * 重载 2 中可以额外传递参数 options 对 props 做相关配置，可以发现 StandardProps 要求 props 必须具有 value 和 onChange 两个字段
 * 实际上组件设计时可能不会完全符合这个要求，在不满足该要求的前提下可以用 options 对 props 做设定补充，实际上传递值的字段可能不叫 ‘value’
 * 那么可以在 options 中指定实际的值的字段名称，例如 {valuePropName:'val'}
 *  */

function useControllableValue<T = any>(props: Props = {}, options: Options<T> = {}) {
  const {
    defaultValue,
    defaultValuePropName = 'defaultValue',
    valuePropName = 'value',
    trigger = 'onChange',
  } = options;

  const value = props[valuePropName] as T;
  const isControlled = props.hasOwnProperty(valuePropName); // 若存在 valuePropName 指定的字段则认为 hook 返回的 state 是受控的

  // 初始化 state 的顺序为 value -> props.defaultValue -> defaultValue
  const initialValue = useMemo(() => {
    if (isControlled) {
      return value;
    }
    if (props.hasOwnProperty(defaultValuePropName)) {
      return props[defaultValuePropName];
    }
    return defaultValue;
  }, []);

  const stateRef = useRef(initialValue);
  if (isControlled) {
    // 若受控，每次外部 value 更新则 hook 返回的 state 必须更新
    stateRef.current = value;
  }

  const update = useUpdate();

  function setState(v: SetStateAction<T>, ...args: any[]) {
    // setState 接受值或函数进行更新，若为函数更新则 nextState 是函数返回的结果，同时函数的默认入参是 currentState
    const r = isFunction(v) ? v(stateRef.current) : v;
    // 如果没有受控就由自己管理
    if (!isControlled) {
      stateRef.current = r;
      // ref 修改不会直接引起组件再次调用，修改后需要为 stateRef.current 的改变手动强制刷新
      update();
    }
    // 传递给内部的 onChange 掌管来自外部的 value 的更新
    if (props[trigger]) {
      props[trigger](r, ...args);
    }
  }

  return [stateRef.current, useMemoizedFn(setState)] as const;
}

export default useControllableValue;
