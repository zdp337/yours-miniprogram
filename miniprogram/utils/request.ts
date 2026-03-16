/**
 * 网络请求封装 — Yours·凝刻
 * 统一请求拦截 / 错误处理 / token 管理
 */

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, any>;
  header?: Record<string, string>;
  showLoading?: boolean;
  loadingText?: string;
  /** 静默处理 401，不自动跳转登录页（用于轮询等后台请求） */
  silent401?: boolean;
}

interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

const getBaseUrl = (): string => {
  const app = getApp();
  return app?.globalData?.baseUrl || 'http://localhost:3000/api';
};

const getToken = (): string => {
  return wx.getStorageSync('token') || '';
};

/** 全局 401 跳转防重入标记，防止多个请求同时触发 401 时重复清除 token 和重复跳转 */
let isHandling401 = false;

/**
 * 统一请求方法
 */
export const request = <T = any>(options: RequestOptions): Promise<ApiResponse<T>> => {
  const { url, method = 'GET', data, header = {}, showLoading = false, loadingText = '加载中...', silent401 = false } = options;

  if (showLoading) {
    wx.showLoading({ title: loadingText, mask: true });
  }

  const token = getToken();

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getBaseUrl()}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...header,
      },
      success(res) {
        if (showLoading) wx.hideLoading();

        const response = res.data as ApiResponse<T>;

        // 调试日志：帮助定位请求问题
        if (res.statusCode !== 200 || response.code !== 0) {
          console.error(`[Request] ${method} ${url} → statusCode=${res.statusCode}, code=${response.code}, msg=${response.message}`);
        }

        if (res.statusCode === 200 && response.code === 0) {
          resolve(response);
        } else if (res.statusCode === 401 || response.code === 401) {
          // token 过期或无效
          console.error(`[Request] 401 鉴权失败: ${method} ${url}, token长度=${token.length}, token前15位="${token.slice(0, 15)}...", silent401=${silent401}, 服务器msg="${response.message}"`);

          
          if (silent401) {
            // 静默模式：只 reject，不跳转登录页（用于轮询等后台请求）
            reject(new Error('TOKEN_EXPIRED'));
            return;
          }
          
          // 非静默模式：使用防重入标记，避免多个请求同时触发 401 导致重复跳转
          if (!isHandling401) {
            isHandling401 = true;
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            wx.showToast({
              title: '登录已过期，请重新登录',
              icon: 'none',
              duration: 2000,
            });
            setTimeout(() => {
              isHandling401 = false;
              wx.reLaunch({ url: '/pages/welcome/welcome' });
            }, 1500);
          }
          reject(new Error('TOKEN_EXPIRED'));
        } else {
          const errMsg = response.message || `请求失败(${res.statusCode})`;
          wx.showToast({ title: errMsg, icon: 'none', duration: 2000 });
          reject(new Error(errMsg));
        }
      },
      fail(err) {
        if (showLoading) wx.hideLoading();
        wx.showToast({ title: '网络异常，请稍后重试', icon: 'none', duration: 2000 });
        reject(new Error(err.errMsg || '网络请求失败'));
      },
    });
  });
};

/** GET 请求 */
export const get = <T = any>(url: string, data?: Record<string, any>, options?: Partial<RequestOptions>) => {
  return request<T>({ url, method: 'GET', data, ...options });
};

/** POST 请求 */
export const post = <T = any>(url: string, data?: Record<string, any>, options?: Partial<RequestOptions>) => {
  return request<T>({ url, method: 'POST', data, ...options });
};

/** PUT 请求 */
export const put = <T = any>(url: string, data?: Record<string, any>, options?: Partial<RequestOptions>) => {
  return request<T>({ url, method: 'PUT', data, ...options });
};

/** DELETE 请求 */
export const del = <T = any>(url: string, data?: Record<string, any>, options?: Partial<RequestOptions>) => {
  return request<T>({ url, method: 'DELETE', data, ...options });
};
