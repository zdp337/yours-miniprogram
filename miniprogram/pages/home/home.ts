// 首页逻辑 — Yours·凝刻

Page({
  data: {
    statusBarHeight: 20,
    navHeight: 64,
    showcaseList: [
      { id: 1, label: '活力少女' },
      { id: 2, label: '酷帅男生' },
      { id: 3, label: '甜美公主' },
      { id: 4, label: '运动达人' },
    ],
  },

  onLoad() {
    // 获取系统信息，设置导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navHeight = statusBarHeight + 44;
    this.setData({ statusBarHeight, navHeight });
  },

  onShow() {
    // Tab 页显示时更新数据
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  /** 跳转到拍照/上传页面 */
  goToCreate() {
    // 检查是否跳过引导
    const skip = wx.getStorageSync('photo_guide_skip');
    if (skip) {
      wx.navigateTo({ url: '/pages/photo-upload/photo-upload' });
    } else {
      wx.navigateTo({ url: '/pages/photo-guide/photo-guide' });
    }
  },

  /** 下拉刷新 */
  onPullDownRefresh() {
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
});
