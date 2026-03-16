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

/** 是否为开发/测试号模式 */
export const isDevMode = (): boolean => {
  // 测试号模式下 appId 为 touristappid 或以 wx 开头的测试号
  // 也可通过 globalData 配置判断
  return true; // 当前开发阶段统一使用开发模式
};

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

    if (isDevMode()) {
      // 开发模式：只检查 token 是否存在即可，不依赖微信 session
      resolve(true);
      return;
    }

    // 正式模式：验证微信 session 有效性
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
 * 开发模式登录（测试号环境，绕过微信 code2Session）
 * 直接调用后端 /api/user/dev-login 获取 token
 */
export const devLogin = async (): Promise<LoginResult> => {
  const result = await post<LoginResult>('/user/dev-login', {});

  // 保存 token 和用户信息
  wx.setStorageSync('token', result.data.token);
  wx.setStorageSync('userInfo', JSON.stringify(result.data.userInfo));

  // 更新全局状态
  const app = getApp();
  if (app) {
    app.globalData.isLoggedIn = true;
    app.globalData.userInfo = result.data.userInfo as any;
  }

  return result.data;
};

/**
 * 获取手机号（微信快速验证组件回调）
 * @param code 手机号临时凭证
 */
export const bindPhone = (code: string): Promise<{ phone: string }> => {
  return post<{ phone: string }>('/user/bindPhone', { code }).then(res => res.data);
};
