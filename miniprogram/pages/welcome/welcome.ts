// 欢迎页逻辑 — Yours·凝刻
import { wxLogin } from '../../utils/auth';

Page({
  data: {
    agreed: false,
    isLoading: false,
  },

  /** 切换协议勾选 */
  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  /** 微信登录 */
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
      const result = await wxLogin();

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
