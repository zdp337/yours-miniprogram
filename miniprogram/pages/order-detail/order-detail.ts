// 订单详情页 — Yours·凝刻

import { get, post } from '../../utils/request';

const STATUS_ICON: Record<string, string> = {
  pending_payment: '💰',
  cancelled: '❌',
  producing: '🔨',
  shipped: '🚚',
  completed: '✅',
  refunding: '🔄',
  refunded: '💸',
};

const STATUS_DESC: Record<string, string> = {
  pending_payment: '超时订单将自动取消',
  cancelled: '订单已取消',
  producing: '您的手办正在精心制作中，预计 7-15 个工作日完成',
  shipped: '快递正在路上',
  completed: '感谢您的购买！',
  refunding: '退款申请审核中，预计 1-3 个工作日',
  refunded: '退款已完成',
};

Page({
  data: {
    orderId: 0,
    order: {} as any,
    statusIcon: '',
    statusDesc: '',
    mainItemPrice: '0.00',
    addonItems: [] as any[],
    orderTime: '',
    payTime: '',
    countdown: '',
    countdownTimer: 0,
  },

  onLoad(options: Record<string, string>) {
    const orderId = parseInt(options.orderId || '0', 10);
    this.setData({ orderId });
    this.loadOrderDetail();
  },

  onUnload() {
    if (this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer);
    }
  },

  /** 加载订单详情 */
  async loadOrderDetail() {
    try {
      const res = await get<any>(`/order/${this.data.orderId}/detail`);
      const order = res.data;

      // 分离主商品和附加商品
      const items = order.items || [];
      const mainItem = items.find((i: any) => i.itemType === 'figurine');
      const addonItems = items
        .filter((i: any) => i.itemType !== 'figurine')
        .map((i: any) => ({ ...i, priceText: i.price.toFixed(2) }));

      // 格式化时间
      const orderTime = this.formatTime(order.createdAt);
      const payTime = order.paidAt ? this.formatTime(order.paidAt) : '';

      // 格式化价格为字符串
      order.totalPrice = parseFloat(order.totalPrice).toFixed(2);
      order.discountPrice = parseFloat(order.discountPrice).toFixed(2);
      order.shippingFee = parseFloat(order.shippingFee).toFixed(2);
      order.payPrice = parseFloat(order.payPrice).toFixed(2);

      this.setData({
        order,
        statusIcon: STATUS_ICON[order.status] || '📋',
        statusDesc: STATUS_DESC[order.status] || '',
        mainItemPrice: mainItem ? mainItem.price.toFixed(2) : '0.00',
        addonItems,
        orderTime,
        payTime,
      });

      // 待支付时启动倒计时
      if (order.status === 'pending_payment' && order.expireAt) {
        this.startCountdown(new Date(order.expireAt));
      }
    } catch (err) {
      console.error('[OrderDetail] 加载订单详情失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /** 格式化时间 */
  formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  /** 启动倒计时 */
  startCountdown(expireAt: Date) {
    const update = () => {
      const diff = expireAt.getTime() - Date.now();
      if (diff <= 0) {
        this.setData({ countdown: '' });
        clearInterval(this.data.countdownTimer);
        this.loadOrderDetail(); // 刷新状态
        return;
      }
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      this.setData({
        countdown: `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`,
      });
    };

    update();
    const timer = setInterval(update, 1000) as unknown as number;
    this.setData({ countdownTimer: timer });
  },

  /** 复制订单号 */
  copyOrderNo() {
    wx.setClipboardData({
      data: this.data.order.orderNo,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  /** 复制快递号 */
  copyTrackingNo() {
    wx.setClipboardData({
      data: 'SF0000000000',
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  /** 取消订单 */
  onCancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '确定取消此订单吗？取消后不可恢复。',
      confirmColor: '#EE0A24',
      success: async (res) => {
        if (res.confirm) {
          try {
            await post(`/order/${this.data.orderId}/cancel`);
            wx.showToast({ title: '订单已取消', icon: 'success' });
            this.loadOrderDetail();
          } catch (err: any) {
            wx.showToast({ title: err.message || '操作失败', icon: 'none' });
          }
        }
      },
    });
  },

  /** 立即支付 */
  async onPayNow() {
    try {
      wx.showLoading({ title: '支付处理中', mask: true });
      await post(`/order/${this.data.orderId}/pay`);
      wx.hideLoading();

      wx.redirectTo({
        url: `/pages/order-success/order-success?orderId=${this.data.orderId}&orderNo=${this.data.order.orderNo}&payPrice=${this.data.order.payPrice}`,
      });
    } catch (err: any) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '支付失败', icon: 'none' });
    }
  },

  /** 确认收货 */
  onConfirmReceive() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？',
      confirmColor: '#333333',
      success: async (res) => {
        if (res.confirm) {
          try {
            await post(`/order/${this.data.orderId}/confirm`);
            wx.showToast({ title: '已确认收货', icon: 'success' });
            this.loadOrderDetail();
          } catch (err: any) {
            wx.showToast({ title: err.message || '操作失败', icon: 'none' });
          }
        }
      },
    });
  },

  /** 申请退款 */
  onApplyRefund() {
    wx.navigateTo({
      url: `/pages/refund-apply/refund-apply?orderId=${this.data.orderId}&orderNo=${this.data.order.orderNo}&payPrice=${this.data.order.payPrice}`,
    });
  },

  /** 再来一单 / 重新下单 */
  onReorder() {
    wx.navigateTo({
      url: `/pages/product-customize/product-customize?modelId=${this.data.order.modelId}`,
    });
  },
});
