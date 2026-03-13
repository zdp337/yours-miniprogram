// 个人中心逻辑 — Yours·凝刻
import { getLocalUserInfo, clearLoginStatus } from '../../utils/auth';
import { get } from '../../utils/request';

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 64,
    userInfo: {
      nickname: '',
      avatarUrl: '',
      phone: '',
    },
    modelCount: 0,
    modelList: [] as Array<{ id: number }>,
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navHeight = statusBarHeight + 44;
    this.setData({ statusBarHeight, navHeight });
  },

  onShow() {
    // 更新 Tab 栏选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }

    // 刷新用户信息
    this.loadUserInfo();
  },

  /** 加载用户信息 */
  async loadUserInfo() {
    // 优先从本地取
    const localInfo = getLocalUserInfo();
    if (localInfo) {
      this.setData({
        userInfo: {
          nickname: localInfo.nickname || '',
          avatarUrl: localInfo.avatarUrl || '',
          phone: localInfo.phone || '',
        },
      });
    }

    // 从服务器刷新
    try {
      const res = await get<{
        nickname: string;
        avatarUrl: string;
        phone: string | null;
      }>('/user/info');

      this.setData({
        userInfo: {
          nickname: res.data.nickname || '',
          avatarUrl: res.data.avatarUrl || '',
          phone: res.data.phone || '',
        },
      });

      // 更新本地缓存
      wx.setStorageSync('userInfo', JSON.stringify(res.data));
    } catch (err) {
      console.error('[Profile] 获取用户信息失败:', err);
    }
  },

  /** 跳转编辑个人信息 */
  goToProfileEdit() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
  },

  /** 跳转订单列表 */
  goToOrderList(e: WechatMiniprogram.TouchEvent) {
    const status = e.currentTarget?.dataset?.status || '';
    // 迭代4实现
    wx.showToast({ title: '订单功能即将上线', icon: 'none' });
  },

  /** 跳转模型列表 */
  goToModelList() {
    // 迭代3实现
    wx.showToast({ title: '模型功能即将上线', icon: 'none' });
  },

  /** 跳转模型详情 */
  goToModelDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget?.dataset?.id;
    wx.showToast({ title: '模型功能即将上线', icon: 'none' });
  },

  /** 跳转地址列表 */
  goToAddressList() {
    wx.navigateTo({ url: '/pages/address-list/address-list' });
  },

  /** 分享 */
  goToShare() {
    // 触发分享
  },

  onShareAppMessage() {
    return {
      title: 'Yours·凝刻 — 把你变成一个手办',
      path: '/pages/welcome/welcome',
    };
  },

  /** 联系客服 */
  goToService() {
    wx.showToast({ title: '客服功能即将上线', icon: 'none' });
  },

  /** 关于我们 */
  goToAbout() {
    wx.showToast({ title: '关于页面即将上线', icon: 'none' });
  },

  /** 退出登录 */
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      confirmColor: '#333333',
      success: (res) => {
        if (res.confirm) {
          clearLoginStatus();
          wx.reLaunch({ url: '/pages/welcome/welcome' });
        }
      },
    });
  },
});
