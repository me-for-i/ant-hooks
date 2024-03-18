import { useThrottle } from 'ahooks';
/* eslint-disable @typescript-eslint/no-parameter-properties */
import { isFunction } from '../../utils';
import type { MutableRefObject } from 'react';
import type { FetchState, Options, PluginReturn, Service, Subscribe } from './types';

export default class Fetch<TData, TParams extends any[]> {
  // fetch 实例创建后注册的插件
  pluginImpls: PluginReturn<TData, TParams>[];
  // 控制请求是否取消
  count: number = 0;

  state: FetchState<TData, TParams> = {
    loading: false,
    params: undefined,
    data: undefined,
    error: undefined,
  };

  constructor(
    public serviceRef: MutableRefObject<Service<TData, TParams>>,
    public options: Options<TData, TParams>,
    public subscribe: Subscribe, // 添加了访问修饰符后，ts 会自动将这些参数添加为类的成员，这些修饰符包括 public、private、protected 或 readonly
    public initState: Partial<FetchState<TData, TParams>> = {},
  ) {
    this.state = {
      ...this.state,
      loading: !options.manual,
      ...initState,
    };
  }

  setState(s: Partial<FetchState<TData, TParams>> = {}) {
    this.state = {
      ...this.state,
      ...s,
    };
    // subscribe 会强制做一次组件更新，对于部分插件中实现的订阅机制是非常有用的，例如缓存插件
    this.subscribe();
  }

  runPluginHandler(event: keyof PluginReturn<TData, TParams>, ...rest: any[]) {
    // @ts-ignore
    const r = this.pluginImpls.map((i) => i[event]?.(...rest)).filter(Boolean); // 非常有趣的写法直接使用 Boolean 函数转换默认的参数
    return Object.assign({}, ...r);
  }

  async runAsync(...params: TParams): Promise<TData> {
    this.count += 1;
    const currentCount = this.count;

    // 部分插件提供的返回值中会包含 onBefore，在开始执行 service 之前会根据使用的插件做出相应的处理
    /**
     * useAutoRunPlugin 若未 ready 则 stopNow
     * useCachePlugin 若存在新鲜的 cache 则作为 this.state.data 返回并终止当前请求，若 cache 未过期但并不新鲜则使用该 cache 的同时仍继续当前请求
     * useLoadingDelayPlugin 增加延时请求效果
     * useRetryPlugin 重置 retry 次数
     * usePollingPlugin 重置轮询机制，在轮询过程中可能存在手动调用的请求打断间隔节奏，因此，无论当前请求来自轮询还是意外都应重置
     * useRetryPlugin 当前请求是否由错误重试机制引起，组件内部逻辑处理
     */
    const {
      stopNow = false,
      returnNow = false,
      ...state
    } = this.runPluginHandler('onBefore', params);

    // stop request
    if (stopNow) {
      return new Promise(() => {});
    }

    this.setState({
      loading: true,
      params,
      ...state,
    });

    // return now
    if (returnNow) {
      return Promise.resolve(state.data);
    }

    // 之后是执行自定义的 onBefore
    this.options.onBefore?.(params);

    try {
      // replace service
      // onRequest 由 useCachePlugin 唯一提供
      let { servicePromise } = this.runPluginHandler('onRequest', this.serviceRef.current, params);

      if (!servicePromise) {
        servicePromise = this.serviceRef.current(...params);
      }

      const res = await servicePromise;

      if (currentCount !== this.count) {
        // prevent run.then when request is canceled
        // 只有 cancel 具有调整 this.count 的能力，若当前 currentCount 不等于 this.count，说明当前请求已经被取消，直接返回
        return new Promise(() => {});
      }

      // const formattedResult = this.options.formatResultRef.current ? this.options.formatResultRef.current(res) : res;

      this.setState({
        data: res,
        error: undefined,
        loading: false,
      });

      this.options.onSuccess?.(res, params);
      /**
       * usePollingPlugin 轮询成功时重置所有的失败次数，错误尝试机制只在连续失败时触发
       * useRetryPlugin 只要成功则需要重置错误重试次数
       */
      this.runPluginHandler('onSuccess', res, params);

      this.options.onFinally?.(params, res, undefined);

      if (currentCount === this.count) {
        /**
         * useLoadingDelayPlugin 清除延时效果
         * usePollingPlugin 保证轮询机制的正常运转，请求结束后自动 refresh 开启下次请求
         * useCachePlugin 请求成功则使用最新的响应数据更新缓存
         */
        this.runPluginHandler('onFinally', params, res, undefined);
      }

      return res;
    } catch (error) {
      if (currentCount !== this.count) {
        // prevent run.then when request is canceled
        return new Promise(() => {});
      }

      this.setState({
        error,
        loading: false,
      });

      this.options.onError?.(error, params);
      /**
       * usePollingPlugin 每次失败添加一次错误计数
       * useRetryPlugin 每次失败添加一次错误计数
       */
      this.runPluginHandler('onError', error, params);

      this.options.onFinally?.(params, undefined, error);
      // 保持请求一致性，请求取消时，此次对应的 onFinally 不应被执行
      if (currentCount === this.count) {
        this.runPluginHandler('onFinally', params, undefined, error);
      }

      throw error;
    }
  }

  run(...params: TParams) {
    this.runAsync(...params).catch((error) => {
      if (!this.options.onError) {
        console.error(error);
      }
    });
  }

  cancel() {
    this.count += 1;
    this.setState({
      loading: false,
    });
    /**
     * useDebouncePlugin 清除防抖效果
     * useThrottlePlugin 清除节流效果
     * useLoadingDelayPlugin 清除延时效果
     * usePollingPlugin 清除轮询效果
     * useRetryPlugin 清除重试效果
     */
    this.runPluginHandler('onCancel');
  }

  refresh() {
    // @ts-ignore
    this.run(...(this.state.params || []));
  }

  refreshAsync() {
    // @ts-ignore
    return this.runAsync(...(this.state.params || []));
  }

  // 立即变更数据，如同 setState 一般使用，使用场景如当即输入的内容可以立即用来进行渲染无需等待接口的返回
  mutate(data?: TData | ((oldData?: TData) => TData | undefined)) {
    const targetData = isFunction(data) ? data(this.state.data) : data;
    /**
     * useCachePlugin 立即变更数据时更新缓存
     */
    this.runPluginHandler('onMutate', targetData);
    this.setState({
      data: targetData,
    });
  }
}
