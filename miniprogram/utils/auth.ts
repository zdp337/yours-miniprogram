/**
 * 登录态管理 — Yours·凝刻
 * 微信授权登录 + token 管理
 */

import { post } from './request';

interface LoginResult {
  token: string;
  userInfo: {
    id: number;
    openId: string;
    nickname: string;
    avatarUrl: string;
    phone: string | null;
  };
  isNewUser: boolean;
}

/**
 * 检查登录状态
 * @returns 是否已登录
 */
export const checkLoginStatus = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const token = wx.getStorageSync('token');
    if (!token) {
      resolve(false);
      return;
    }

    // 验证 token 有效性
    wx.checkSession({
      success: () => resolve(true),
      fail: () => {
        // session 过期，清除登录态
        clearLoginStatus();
        resolve(false);
      },
    });
  });
};

/**
 * 微信授权登录
 * 流程：wx.login() 获取 code → 发送到后端 → 后端换取 openId → 返回 JWT token
 */
export const wxLogin = (): Promise<LoginResult> => {
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (loginRes) => {
        if (!loginRes.code) {
          reject(new Error('微信登录失败：获取 code 失败'));
          return;
        }

        try {
          const result = await post<LoginResult>('/user/login', {
            code: loginRes.code,
          });

          // 保存 token 和用户信息
          wx.setStorageSync('token', result.data.token);
          wx.setStorageSync('userInfo', JSON.stringify(result.data.userInfo));

          // 更新全局状态
          const app = getApp();
          if (app) {
            app.globalData.isLoggedIn = true;
            app.globalData.userInfo = result.data.userInfo as any;
          }

          resolve(result.data);
        } catch (err) {
          reject(err);
        }
      },
      fail: (err) => {
        reject(new Error(`微信登录失败：${err.errMsg}`));
      },
    });
  });
};

/**
 * 获取本地存储的用户信息
 */
export const getLocalUserInfo = (): LoginResult['userInfo'] | null => {
  try {
    const info = wx.getStorageSync('userInfo');
    return info ? JSON.parse(info) : null;
  } catch {
    return null;
  }
};

/**
 * 清除登录态
 */
export const clearLoginStatus = (): void => {
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  const app = getApp();
  if (app) {
    app.globalData.isLoggedIn = false;
    app.globalData.userInfo = null;
  }
};

/**
 * 获取手机号（微信快速验证组件回调）
 * @param code 手机号临时凭证
 */
export const bindPhone = (code: string): Promise<{ phone: string }> => {
  return post<{ phone: string }>('/user/bindPhone', { code }).then(res => res.data);
};
