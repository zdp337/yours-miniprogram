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
    // 迭代2实现，当前跳转占位页
    wx.showToast({
      title: '功能即将上线',
      icon: 'none',
      duration: 1500,
    });
  },

  /** 下拉刷新 */
  onPullDownRefresh() {
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
});
