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

/**
 * 统一请求方法
 */
export const request = <T = any>(options: RequestOptions): Promise<ApiResponse<T>> => {
  const { url, method = 'GET', data, header = {}, showLoading = false, loadingText = '加载中...' } = options;

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

        if (res.statusCode === 200 && response.code === 0) {
          resolve(response);
        } else if (res.statusCode === 401 || response.code === 401) {
          // token 过期，清除登录态，跳转欢迎页
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.reLaunch({ url: '/pages/welcome/welcome' });
          reject(new Error('登录已过期，请重新登录'));
        } else {
          const errMsg = response.message || '请求失败';
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
export const get = <T = any>(url: string, data?: Record<string, any>) => {
  return request<T>({ url, method: 'GET', data });
};

/** POST 请求 */
export const post = <T = any>(url: string, data?: Record<string, any>) => {
  return request<T>({ url, method: 'POST', data });
};

/** PUT 请求 */
export const put = <T = any>(url: string, data?: Record<string, any>) => {
  return request<T>({ url, method: 'PUT', data });
};

/** DELETE 请求 */
export const del = <T = any>(url: string, data?: Record<string, any>) => {
  return request<T>({ url, method: 'DELETE', data });
};
