// Yours·凝刻 — 小程序入口
import { checkLoginStatus } from './utils/auth';

App({
  globalData: {
    userInfo: null as WechatMiniprogram.UserInfo | null,
    isLoggedIn: false,
    // 开发环境：使用腾讯云服务器公网IP，手机和PC都能访问
    baseUrl: 'http://43.138.185.112:3001/api',
  },

  onLaunch() {
    console.log('[App] Yours·凝刻 启动');

    // 检查登录态
    this.checkLogin();
  },

  async checkLogin() {
    try {
      const isLoggedIn = await checkLoginStatus();
      this.globalData.isLoggedIn = isLoggedIn;
      if (!isLoggedIn) {
        // 未登录，跳转到欢迎页
        wx.reLaunch({ url: '/pages/welcome/welcome' });
      }
    } catch (err) {
      console.error('[App] 检查登录态失败:', err);
    }
  },
});
