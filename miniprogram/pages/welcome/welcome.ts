// 欢迎页逻辑 — Yours·凝刻
import { wxLogin, devLogin, isDevMode } from '../../utils/auth';

Page({
  data: {
    agreed: false,
    isLoading: false,
    isDevMode: false,
  },

  onLoad() {
    this.setData({ isDevMode: isDevMode() });
  },

  /** 切换协议勾选 */
  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  /** 登录（自动区分开发模式 / 正式模式） */
  async handleLogin() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先阅读并同意用户协议和隐私政策',
        icon: 'none',
        duration: 2000,
      });
      return;
    }

    if (this.data.isLoading) return;

    this.setData({ isLoading: true });

    try {
      let result;
      if (isDevMode()) {
        // 开发模式：直接调用后端 dev-login，不需要微信授权
        result = await devLogin();
      } else {
        // 正式模式：走微信 wx.login 流程
        result = await wxLogin();
      }

      wx.showToast({
        title: result.isNewUser ? '欢迎加入 Yours·凝刻！' : '欢迎回来！',
        icon: 'success',
        duration: 1500,
      });

      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/home' });
      }, 1500);
    } catch (err) {
      console.error('[Welcome] 登录失败:', err);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000,
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /** 打开用户协议 */
  openUserAgreement() {
    wx.navigateTo({ url: '/pages/webview/webview?type=user-agreement' });
  },

  /** 打开隐私政策 */
  openPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/webview/webview?type=privacy-policy' });
  },
});
