/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AxiosInstance, Method } from "axios";

/**
 * Service Worker 环境下的 axios 替代实现（基于 fetch）
 * - 支持 defaults 合并（含 headers.common 与各方法级 headers）
 * - 支持 interceptors（最小可用版）
 * - 支持 baseURL、params、timeout、responseType、withCredentials、validateStatus
 * - 错误对象尽量与 axios 对齐（isAxiosError, code, config, request, response）
 */

type ResponseType = "json" | "text" | "blob" | "arraybuffer";

interface SWAxiosRequestConfig {
  url?: string;
  method?: Method | string;
  baseURL?: string;
  headers?: Record<string, any> | Headers;
  params?: any;
  paramsSerializer?: (params: any) => string;
  data?: any;
  timeout?: number;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
  withCredentials?: boolean;
  // 兼容 axios(url, config) 场景：第二个参数
  [key: string]: any;
}

interface SWAxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: SWAxiosRequestConfig;
  request?: any;
}

type InterceptorFulfilled<V> = (value: V) => V | Promise<V>;
type InterceptorRejected = (error: any) => any;

interface Interceptor<V> {
  fulfilled?: InterceptorFulfilled<V> | null;
  rejected?: InterceptorRejected | null;
}

interface InterceptorManager<V> {
  use(onFulfilled?: InterceptorFulfilled<V>, onRejected?: InterceptorRejected): number;
  eject(id: number): void;
  handlers: Array<Interceptor<V> | null>;
}

type TimeoutHandle = ReturnType<typeof setTimeout>;

interface DefaultsShape {
  method?: string;
  baseURL?: string;
  timeout: number;
  responseType: ResponseType;
  validateStatus: (status: number) => boolean;
  withCredentials?: boolean;
  paramsSerializer?: (params: any) => string;
  headers: {
    common: Record<string, any>;
    get: Record<string, any>;
    delete: Record<string, any>;
    head: Record<string, any>;
    options: Record<string, any>;
    post: Record<string, any>;
    put: Record<string, any>;
    patch: Record<string, any>;
    [key: string]: any;
  };
}

function isAbsoluteURL(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

function combineURL(baseURL: string, url: string): string {
  if (!baseURL) return url;
  if (isAbsoluteURL(url)) return url;
  const slashA = baseURL.endsWith("/");
  const slashB = url.startsWith("/");
  if (slashA && slashB) return baseURL + url.slice(1);
  if (!slashA && !slashB) return baseURL + "/" + url;
  return baseURL + url;
}

function normalizeHeaderName(name: string): string {
  return name.toLowerCase();
}

function headersToPlainObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[normalizeHeaderName(key)] = value;
  });
  return obj;
}

function ensureHeadersInstance(input?: Record<string, any> | Headers): Headers {
  if (!input) return new Headers();
  if (input instanceof Headers) return input;
  const h = new Headers();
  for (const key of Object.keys(input)) {
    const val = (input as any)[key];
    if (val !== undefined && val !== null) {
      h.set(key, String(val));
    }
  }
  return h;
}

function headerHas(headers: Headers, name: string): boolean {
  return headers.has(normalizeHeaderName(name));
}

function setDefaultContentType(headers: Headers, value: string) {
  if (!headerHas(headers, "content-type")) {
    headers.set("content-type", value);
  }
}

function mergeHeaders(defaults: DefaultsShape["headers"], method: string, custom?: any): Record<string, any> {
  const m = method.toLowerCase();
  return {
    ...(defaults?.common || {}),
    ...(defaults?.[m] || {}),
    ...(custom || {}),
  };
}

function defaultParamsSerializer(params: any): string {
  const usp = new URLSearchParams();
  const append = (key: string, value: any) => {
    if (value === null || typeof value === "undefined") return;
    if (value instanceof Date) {
      usp.append(key, value.toISOString());
    } else if (Array.isArray(value)) {
      value.forEach((v) => append(key, v));
    } else if (typeof value === "object") {
      usp.append(key, JSON.stringify(value));
    } else {
      usp.append(key, String(value));
    }
  };
  if (params && typeof params === "object") {
    Object.keys(params).forEach((k) => append(k, params[k]));
  }
  return usp.toString();
}

function buildURL(url: string, params?: any, paramsSerializer?: (params: any) => string): string {
  if (!params) return url;
  const serialized = paramsSerializer ? paramsSerializer(params) : defaultParamsSerializer(params);
  if (!serialized) return url;
  return url + (url.includes("?") ? "&" : "?") + serialized;
}

function parseJSONSafely(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createInterceptorManager<V>(): InterceptorManager<V> {
  const handlers: Array<Interceptor<V> | null> = [];
  return {
    handlers,
    use(onFulfilled?: InterceptorFulfilled<V>, onRejected?: InterceptorRejected): number {
      handlers.push({ fulfilled: onFulfilled || null, rejected: onRejected || null });
      return handlers.length - 1;
    },
    eject(id: number) {
      if (handlers[id]) handlers[id] = null;
    },
  };
}

function createServiceWorkerAxios(instanceInitDefaults: Partial<DefaultsShape> = {}): AxiosInstance {
  // 基础默认值
  const baseDefaults: DefaultsShape = {
    method: "get",
    timeout: 8000,
    responseType: "json",
    baseURL: "",
    withCredentials: false,
    validateStatus: (status: number) => status >= 200 && status < 300,
    paramsSerializer: undefined as any,
    headers: {
      common: {},
      get: {},
      delete: {},
      head: {},
      options: {},
      post: { "Content-Type": "application/json;charset=UTF-8" },
      put: { "Content-Type": "application/json;charset=UTF-8" },
      patch: { "Content-Type": "application/json;charset=UTF-8" },
    },
  };

  // 实例级 defaults（浅合并 + headers 深合并）
  const defaults: DefaultsShape = {
    ...baseDefaults,
    ...instanceInitDefaults,
    headers: {
      ...baseDefaults.headers,
      ...(instanceInitDefaults.headers || {}),
      common: {
        ...baseDefaults.headers.common,
        ...(instanceInitDefaults.headers?.common || {}),
      },
      get: {
        ...baseDefaults.headers.get,
        ...(instanceInitDefaults.headers?.get || {}),
      },
      delete: {
        ...baseDefaults.headers.delete,
        ...(instanceInitDefaults.headers?.delete || {}),
      },
      head: {
        ...baseDefaults.headers.head,
        ...(instanceInitDefaults.headers?.head || {}),
      },
      options: {
        ...baseDefaults.headers.options,
        ...(instanceInitDefaults.headers?.options || {}),
      },
      post: {
        ...baseDefaults.headers.post,
        ...(instanceInitDefaults.headers?.post || {}),
      },
      put: {
        ...baseDefaults.headers.put,
        ...(instanceInitDefaults.headers?.put || {}),
      },
      patch: {
        ...baseDefaults.headers.patch,
        ...(instanceInitDefaults.headers?.patch || {}),
      },
    },
  };

  // 拦截器
  const requestInterceptors = createInterceptorManager<SWAxiosRequestConfig>();
  const responseInterceptors = createInterceptorManager<SWAxiosResponse>();

  // 核心请求执行器（不含拦截器）
  const dispatchRequest = async (rawConfig: SWAxiosRequestConfig): Promise<SWAxiosResponse> => {
    // 合并 defaults 与本次 config
    const cfg: SWAxiosRequestConfig = { ...rawConfig };
    const method = (cfg.method || defaults.method || "get").toString().toUpperCase();
    const baseURL = cfg.baseURL ?? defaults.baseURL ?? "";
    const timeout = cfg.timeout ?? defaults.timeout ?? 0;
    const validateStatus = cfg.validateStatus || defaults.validateStatus;
    const responseType = (cfg.responseType || defaults.responseType || "json") as ResponseType;
    const withCredentials = cfg.withCredentials ?? defaults.withCredentials ?? false;
    const paramsSerializer = cfg.paramsSerializer || defaults.paramsSerializer;

    if (!cfg.url) {
      throw new Error("Missing url in request config");
    }

    // 构建 URL
    let fullUrl = cfg.url!;
    fullUrl = baseURL ? combineURL(baseURL, fullUrl) : fullUrl;
    fullUrl = buildURL(fullUrl, cfg.params, paramsSerializer);

    // 合并 headers（common + method + custom）
    const mergedHeaderObj = mergeHeaders(defaults.headers, method, cfg.headers);
    const headers = ensureHeadersInstance(mergedHeaderObj);

    // 构建 fetch 选项
    const fetchOptions: RequestInit = {
      method,
      headers,
      credentials: withCredentials ? "include" : "same-origin",
    };

    // 处理请求体
    const hasBody = !["GET", "HEAD"].includes(method);
    if (hasBody && cfg.data !== undefined && cfg.data !== null) {
      const data = cfg.data;
      if (typeof data === "string") {
        fetchOptions.body = data;
        // 不强制设置 content-type，调用方可自控
      } else if (data instanceof FormData) {
        fetchOptions.body = data; // 浏览器自动设置 multipart/form-data 边界
      } else if (data instanceof URLSearchParams) {
        fetchOptions.body = data;
        setDefaultContentType(headers, "application/x-www-form-urlencoded;charset=UTF-8");
      } else if (
        data instanceof ArrayBuffer ||
        ArrayBuffer.isView(data) || // 包含 TypedArray、DataView
        data instanceof Blob
      ) {
        fetchOptions.body = data as any;
      } else {
        // 其他对象按 JSON 处理
        fetchOptions.body = JSON.stringify(data);
        setDefaultContentType(headers, "application/json;charset=UTF-8");
      }
    }

    // 超时控制
    const abortController = new AbortController();
    fetchOptions.signal = abortController.signal;
    let timeoutId: TimeoutHandle | null = null;
    if (timeout && timeout > 0) {
      timeoutId = setTimeout(() => abortController.abort(), timeout);
    }

    try {
      const response = await fetch(fullUrl, fetchOptions);
      if (timeoutId) clearTimeout(timeoutId);

      // 解析响应体
      let data: any = null;
      if (responseType === "arraybuffer") {
        data = await response.arrayBuffer();
      } else if (responseType === "blob") {
        data = await response.blob();
      } else if (responseType === "text") {
        data = await response.text();
      } else {
        // json
        // 若无内容，返回 null
        const contentLength = response.headers.get("content-length");
        if (response.status === 204 || response.status === 205 || contentLength === "0") {
          data = null;
        } else {
          const text = await response.text();
          if (text === "") {
            data = null;
          } else {
            const ctype = response.headers.get("content-type") || "";
            if (/\bjson\b/i.test(ctype) || /\+json\b/i.test(ctype)) {
              data = parseJSONSafely(text);
            } else {
              // 不宣称是 json，则尝试解析，失败则返回原文本
              data = parseJSONSafely(text);
            }
          }
        }
      }

      // headers 转普通对象
      const headersObj = headersToPlainObject(response.headers);

      const axiosResponse: SWAxiosResponse = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: headersObj,
        config: cfg,
        request: { responseURL: response.url }, // 关键补齐
      };

      // 状态校验
      const ok = typeof validateStatus === "function" ? validateStatus(response.status) : response.ok;
      if (!ok) {
        const err: any = new Error(`Request failed with status code ${response.status}`);
        err.config = cfg;
        err.request = {};
        err.response = axiosResponse;
        err.isAxiosError = true;
        err.code = response.status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST";
        throw err;
      }

      return axiosResponse;
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);

      // 超时/中断
      if (error?.name === "AbortError") {
        const err: any = new Error(`timeout of ${timeout}ms exceeded`);
        err.code = "ECONNABORTED";
        err.config = rawConfig;
        err.isAxiosError = true;
        throw err;
      }

      // fetch 网络错误
      if (error && error.isAxiosError) {
        // 前面构造的 axios 风格错误，原样抛出
        throw error;
      } else {
        const err: any = new Error(error?.message || "Network Error");
        err.code = "ERR_NETWORK";
        err.config = rawConfig;
        err.isAxiosError = true;
        throw err;
      }
    }
  };

  // 构建可调用的 axios 实例函数（含拦截器链）
  const axiosFn = function (...args: any[]): Promise<SWAxiosResponse> {
    // 支持 axios(config) 与 axios(url, config)
    let config: SWAxiosRequestConfig;
    if (typeof args[0] === "string") {
      config = { ...(args[1] || {}), url: args[0] };
    } else {
      config = { ...(args[0] || {}) };
    }

    // 组装拦截器链：request（后添加先执行） -> dispatch -> response（先添加先执行）
    const chain: Array<{ fulfilled: Function; rejected?: Function | null }> = [];

    // 收集 request 拦截器（后进先出）
    const reqHandlers = requestInterceptors.handlers.slice().reverse();
    reqHandlers.forEach((h) => {
      if (h !== null) chain.push({ fulfilled: h.fulfilled || ((c: any) => c), rejected: h.rejected || null });
    });

    // 核心请求
    chain.push({ fulfilled: dispatchRequest, rejected: undefined });

    // 收集 response 拦截器（先进先出）
    responseInterceptors.handlers.forEach((h) => {
      if (h !== null) chain.push({ fulfilled: h.fulfilled || ((r: any) => r), rejected: h.rejected || null });
    });

    // 执行链
    let promise: Promise<any> = Promise.resolve(config);
    while (chain.length) {
      const { fulfilled, rejected } = chain.shift()!;
      promise = promise.then(fulfilled as any, rejected as any);
    }
    return promise;
  } as any;

  // 方法别名
  axiosFn.request = (config: SWAxiosRequestConfig) => axiosFn(config);
  axiosFn.get = (url: string, config: SWAxiosRequestConfig = {}) =>
    axiosFn({ ...config, url, method: "GET" });
  axiosFn.delete = (url: string, config: SWAxiosRequestConfig = {}) =>
    axiosFn({ ...config, url, method: "DELETE" });
  axiosFn.head = (url: string, config: SWAxiosRequestConfig = {}) =>
    axiosFn({ ...config, url, method: "HEAD" });
  axiosFn.options = (url: string, config: SWAxiosRequestConfig = {}) =>
    axiosFn({ ...config, url, method: "OPTIONS" });
  axiosFn.post = (url: string, data?: any, config: SWAxiosRequestConfig = {}) =>
    axiosFn({ ...config, url, data, method: "POST" });
  axiosFn.put = (url: string, data?: any, config: SWAxiosRequestConfig = {}) =>
    axiosFn({ ...config, url, data, method: "PUT" });
  axiosFn.patch = (url: string, data?: any, config: SWAxiosRequestConfig = {}) =>
    axiosFn({ ...config, url, data, method: "PATCH" });

  // defaults & interceptors
  axiosFn.defaults = defaults;
  axiosFn.interceptors = {
    request: requestInterceptors,
    response: responseInterceptors,
  };

  // create
  axiosFn.create = (config: Partial<DefaultsShape> = {}) => {
    // 合并 headers
    const merged: Partial<DefaultsShape> = {
      ...config,
      headers: {
        ...defaults.headers,
        ...(config.headers || {}),
        common: { ...defaults.headers.common, ...(config.headers?.common || {}) },
        get: { ...defaults.headers.get, ...(config.headers?.get || {}) },
        delete: { ...defaults.headers.delete, ...(config.headers?.delete || {}) },
        head: { ...defaults.headers.head, ...(config.headers?.head || {}) },
        options: { ...defaults.headers.options, ...(config.headers?.options || {}) },
        post: { ...defaults.headers.post, ...(config.headers?.post || {}) },
        put: { ...defaults.headers.put, ...(config.headers?.put || {}) },
        patch: { ...defaults.headers.patch, ...(config.headers?.patch || {}) },
      },
    };
    return createServiceWorkerAxios(merged);
  };

  // isAxiosError
  axiosFn.isAxiosError = (error: any): boolean => {
    return !!(error && error.isAxiosError);
  };

  return axiosFn as AxiosInstance;
}

/**
 * 导出单例 Axios 代理
 */
const AxiosProxy = createServiceWorkerAxios();
export default AxiosProxy;
