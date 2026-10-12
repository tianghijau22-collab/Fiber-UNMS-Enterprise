import axios from 'axios';

export function isSameOriginApi(input, origin) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, origin);
  return url.origin === new URL(origin).origin && url.pathname.startsWith('/api/');
}

export function prepareApiRequest(input, init, origin, cookie) {
  if (!isSameOriginApi(input, origin)) return init;

  const headers = new Headers(typeof input === 'object' && input.headers ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  for (const name of ['X-User-Id', 'X-User-Name', 'X-User-Role', 'X-CSRF-TOKEN']) headers.delete(name);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const token = cookie.split(';').map(part => part.trim()).find(part => part.startsWith('XSRF-TOKEN='));
  const method = String(init.method || input.method || 'GET').toUpperCase();
  if (token && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-XSRF-TOKEN', decodeURIComponent(token.slice('XSRF-TOKEN='.length)));
  }

  return { ...init, headers, credentials: 'same-origin' };
}

export function installApiClient() {
  const originalFetch = window.fetch.bind(window);
  const expireSession = (status, input, code) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, window.location.href);
    if (([401, 419].includes(status) || code === 'ACCOUNT_INACTIVE') && url.pathname !== '/api/auth/login') {
      window.dispatchEvent(new CustomEvent('fona:session-expired'));
    }
  };

  window.fetch = async (input, init = {}) => {
    const isApi = isSameOriginApi(input, window.location.href);
    const config = prepareApiRequest(input, init, window.location.href, document.cookie);
    const response = await originalFetch(input, config);
    if (isApi) {
      const errorCode = response.status === 403 ? await response.clone().json().then(data => data.code).catch(() => undefined) : undefined;
      expireSession(response.status, input, errorCode);
      const method = String(config.method || input.method || 'GET').toUpperCase();
      const url = typeof input === 'object' && input.url ? input.url : String(input);
      if (response.ok && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !url.includes('/test') && !url.includes('/auth/')) {
        window.dispatchEvent(new CustomEvent('unms:data-mutated', { detail: { url, method, timestamp: Date.now() } }));
      }
    }
    return response;
  };

  axios.interceptors.request.use(config => {
    if (isSameOriginApi(new URL(config.url, config.baseURL || window.location.href), window.location.href)) {
      config.headers = axios.AxiosHeaders.from(config.headers);
      for (const name of ['X-User-Id', 'X-User-Name', 'X-User-Role', 'X-CSRF-TOKEN']) config.headers.delete(name);
      config.headers.set('Accept', 'application/json');
      config.withCredentials = true;
      config.withXSRFToken = true;
    }
    return config;
  });
  axios.interceptors.response.use(response => response, error => {
    const url = new URL(error.config?.url || '/', error.config?.baseURL || window.location.href);
    if (isSameOriginApi(url, window.location.href)) expireSession(error.response?.status, url, error.response?.data?.code);
    return Promise.reject(error);
  });
}
