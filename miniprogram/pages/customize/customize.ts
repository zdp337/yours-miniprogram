// 定制页占位逻辑 — Yours·凝刻

Page({
  data: {},

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },
});
