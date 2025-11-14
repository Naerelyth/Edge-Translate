import type { AxiosInstance, Method } from "axios";

/**
 * Service Worker 호환 Axios 대체 구현
 * 실제 axios 없이 fetch를 사용한 동일한 인터페이스 제공
 */

interface ServiceWorkerAxiosRequestConfig {
    url?: string;
    method?: Method;
    data?: any;
    headers?: any;
    timeout?: number;
    params?: any;
    responseType?: "json" | "text" | "blob" | "arraybuffer";
    baseURL?: string;
    validateStatus?: (status: number) => boolean;
}

interface ServiceWorkerAxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: ServiceWorkerAxiosRequestConfig;
    request?: any;
}

/**
 * Service Worker 환경을 위한 axios 대체 함수
 */
const createServiceWorkerAxios = (): AxiosInstance => {
    const axiosReplacement = function (config: ServiceWorkerAxiosRequestConfig | string): Promise<ServiceWorkerAxiosResponse> {
        // Handle string URL shorthand
        if (typeof config === "string") {
            config = { url: config, method: "GET" as Method };
        }

        const {
            url,
            method = "GET" as Method,
            data,
            headers = {},
            timeout = 0,
            params,
            responseType = "json",
            baseURL = "",
            validateStatus = (status: number) => status >= 200 && status < 300,
        } = config;

        // Build full URL
        let fullUrl = baseURL ? baseURL + url : url!;

        // Add query parameters
        if (params) {
            const searchParams = new URLSearchParams(params);
            fullUrl += (fullUrl.includes("?") ? "&" : "?") + searchParams.toString();
        }

        const fetchOptions: RequestInit = {
            method: method.toUpperCase(),
            headers: new Headers(headers),
        };

        // Add request body
        if (data && !["GET", "HEAD"].includes(fetchOptions.method!)) {
            if (typeof data === "string") {
                fetchOptions.body = data;
            } else if (data instanceof FormData) {
                fetchOptions.body = data;
            } else if (data instanceof URLSearchParams) {
                fetchOptions.body = data;
                const headersObj = fetchOptions.headers as Headers;
                if (!headersObj.get("content-type")) {
                    headersObj.set("content-type", "application/x-www-form-urlencoded");
                }
            } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
                fetchOptions.body = data;
            } else {
                fetchOptions.body = JSON.stringify(data);
                const headersObj = fetchOptions.headers as Headers;
                if (!headersObj.get("content-type")) {
                    headersObj.set("content-type", "application/json");
                }
            }
        }

        // Set up abort controller for timeout
        const abortController = new AbortController();
        fetchOptions.signal = abortController.signal;

        let timeoutId: NodeJS.Timeout | null = null;
        if (timeout > 0) {
            timeoutId = setTimeout(() => abortController.abort(), timeout);
        }

        return fetch(fullUrl, fetchOptions)
            .then((response) => {
                if (timeoutId) clearTimeout(timeoutId);

                // Process response based on responseType
                let dataPromise: Promise<any>;
                switch (responseType) {
                    case "text":
                        dataPromise = response.text();
                        break;
                    case "blob":
                        dataPromise = response.blob();
                        break;
                    case "arraybuffer":
                        dataPromise = response.arrayBuffer();
                        break;
                    case "json":
                    default:
                        dataPromise = response.text().then((text) => {
                            try {
                                return text ? JSON.parse(text) : {};
                            } catch (e) {
                                return text;
                            }
                        });
                        break;
                }

                return dataPromise.then((data) => {
                    // Convert headers to plain object
                    const headersObj: any = {};
                    const headersIterable = response.headers as any;
                    if (headersIterable && typeof headersIterable.forEach === 'function') {
                        headersIterable.forEach((value: string, key: string) => {
                            headersObj[key] = value;
                        });
                    }

                    const axiosResponse: ServiceWorkerAxiosResponse = {
                        data,
                        status: response.status,
                        statusText: response.statusText,
                        headers: headersObj,
                        config: config as ServiceWorkerAxiosRequestConfig,
                        request: {},
                    };

                    if (!validateStatus(response.status)) {
                        const error = new Error(`Request failed with status ${response.status}`) as any;
                        error.config = config;
                        error.response = axiosResponse;
                        error.code = response.status >= 500 ? "ECONNABORTED" : "ERR_BAD_REQUEST";
                        throw error;
                    }

                    return axiosResponse;
                });
            })
            .catch((error) => {
                if (timeoutId) clearTimeout(timeoutId);

                if (error.name === "AbortError") {
                    const timeoutError = new Error(`Request timeout after ${timeout}ms`) as any;
                    timeoutError.config = config;
                    timeoutError.code = "ECONNABORTED";
                    throw {
                        errorType: "NET_ERR",
                        errorCode: 0,
                        errorMsg: timeoutError.message,
                    };
                } else if (error.response) {
                    throw {
                        errorType: "NET_ERR",
                        errorCode: error.response.status || 0,
                        errorMsg: error.message || "Request failed",
                    };
                } else {
                    throw {
                        errorType: "NET_ERR",
                        errorCode: 0,
                        errorMsg: error.message || "Network Error",
                    };
                }
            });
    } as any;

    // Add HTTP method shortcuts
    axiosReplacement.get = (url: string, config: ServiceWorkerAxiosRequestConfig = {}) =>
        axiosReplacement({ ...config, url, method: "GET" as Method });
    axiosReplacement.post = (url: string, data?: any, config: ServiceWorkerAxiosRequestConfig = {}) =>
        axiosReplacement({ ...config, url, data, method: "POST" as Method });
    axiosReplacement.put = (url: string, data?: any, config: ServiceWorkerAxiosRequestConfig = {}) =>
        axiosReplacement({ ...config, url, data, method: "PUT" as Method });
    axiosReplacement.patch = (url: string, data?: any, config: ServiceWorkerAxiosRequestConfig = {}) =>
        axiosReplacement({ ...config, url, data, method: "PATCH" as Method });
    axiosReplacement.delete = (url: string, config: ServiceWorkerAxiosRequestConfig = {}) =>
        axiosReplacement({ ...config, url, method: "DELETE" as Method });
    axiosReplacement.head = (url: string, config: ServiceWorkerAxiosRequestConfig = {}) =>
        axiosReplacement({ ...config, url, method: "HEAD" as Method });
    axiosReplacement.options = (url: string, config: ServiceWorkerAxiosRequestConfig = {}) =>
        axiosReplacement({ ...config, url, method: "OPTIONS" as Method });

    // Add axios properties
    axiosReplacement.defaults = {
        headers: {
            common: {},
            get: {},
            post: { "Content-Type": "application/json" },
            put: { "Content-Type": "application/json" },
            patch: { "Content-Type": "application/json" },
        },
        // Avoid long hangs on flaky networks
        timeout: 8000,
        responseType: "json",
        baseURL: "",
        validateStatus: (status: number) => status >= 200 && status < 300,
    };

    // Mock interceptors
    axiosReplacement.interceptors = {
        request: {
            use: () => {},
            eject: () => {},
        },
        response: {
            use: () => {},
            eject: () => {},
        },
    };

    axiosReplacement.create = (config: ServiceWorkerAxiosRequestConfig = {}) => {
        const instance = createServiceWorkerAxios();
        Object.assign(instance.defaults, config);
        return instance;
    };

    axiosReplacement.isAxiosError = (error: any) => {
        return error && (error.errorType === "NET_ERR" || (error.config && error.code));
    };

    return axiosReplacement as AxiosInstance;
};

/**
 * Axios proxy with error handling for translators package.
 */
const AxiosProxy = createServiceWorkerAxios();

export default AxiosProxy;
