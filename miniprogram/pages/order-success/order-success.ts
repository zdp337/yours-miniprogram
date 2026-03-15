// 支付成功页 — Yours·凝刻

Page({
  data: {
    orderId: 0,
    orderNo: '',
    payPrice: '0.00',
    payTime: '',
  },

  onLoad(options: Record<string, string>) {
    const orderId = parseInt(options.orderId || '0', 10);
    const orderNo = options.orderNo || '';
    const payPrice = options.payPrice || '0.00';

    // 格式化当前时间
    const now = new Date();
    const payTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    this.setData({ orderId, orderNo, payPrice, payTime });
  },

  /** 查看订单详情 */
  goToOrderDetail() {
    wx.redirectTo({
      url: `/pages/order-detail/order-detail?orderId=${this.data.orderId}`,
    });
  },

  /** 继续定制新手办 */
  goToCustomize() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  /** 返回首页 */
  goToHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  /** 分享 */
  onShareAppMessage() {
    return {
      title: '我刚刚定制了一个 Q 版手办，快来 Yours·凝刻 试试吧！',
      path: '/pages/welcome/welcome',
    };
  },
});
