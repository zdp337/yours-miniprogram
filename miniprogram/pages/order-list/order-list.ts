// 我的订单列表页 — Yours·凝刻

import { get, post } from '../../utils/request';

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending_payment', label: '待支付' },
  { key: 'producing', label: '制作中' },
  { key: 'shipped', label: '已发货' },
  { key: 'completed', label: '已完成' },
];

Page({
  data: {
    tabs: TABS,
    currentTab: 'all',
    list: [] as any[],
    page: 1,
    loading: false,
    refreshing: false,
    noMore: false,
  },

  onLoad(options: Record<string, string>) {
    if (options.status) {
      this.setData({ currentTab: options.status });
    }
    this.loadOrders(true);
  },

  onShow() {
    // 返回时刷新列表
    if (this.data.list.length > 0) {
      this.loadOrders(true);
    }
  },

  /** 切换 Tab */
  onTabChange(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as string;
    if (key === this.data.currentTab) return;
    this.setData({ currentTab: key, list: [], page: 1, noMore: false });
    this.loadOrders(true);
  },

  /** 加载订单列表 */
  async loadOrders(reset: boolean = false) {
    if (this.data.loading) return;
    if (!reset && this.data.noMore) return;

    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });

    try {
      const status = this.data.currentTab === 'all' ? '' : this.data.currentTab;
      const res = await get<any>('/order/list', { status, page, pageSize: 10 });
      const { list: newList, totalPages } = res.data;

      // 格式化数据
      const formatted = newList.map((item: any) => ({
        ...item,
        payPriceText: parseFloat(item.payPrice).toFixed(2),
        timeText: this.formatTime(item.createdAt),
        itemSummary: this.buildItemSummary(item.items || []),
      }));

      const finalList = reset ? formatted : [...this.data.list, ...formatted];

      this.setData({
        list: finalList,
        page: page + 1,
        noMore: page >= totalPages,
        loading: false,
        refreshing: false,
      });
    } catch (err) {
      console.error('[OrderList] 加载订单失败:', err);
      this.setData({ loading: false, refreshing: false });
    }
  },

  /** 构建商品概要 */
  buildItemSummary(items: any[]): string {
    const addons = items
      .filter((i: any) => i.itemType !== 'figurine')
      .map((i: any) => {
        if (i.itemType === 'package_box') return '包装盒';
        if (i.itemType === 'model_photo_print') return '模型卡片';
        if (i.itemType === 'original_photo_print') return '照片打印';
        return i.itemSpec || '';
      });
    return addons.length > 0 ? ` + ${addons.join(' + ')}` : '';
  },

  /** 格式化时间 */
  formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  /** 下拉刷新 */
  onPullRefresh() {
    this.setData({ refreshing: true });
    this.loadOrders(true);
  },

  /** 上拉加载更多 */
  onLoadMore() {
    this.loadOrders(false);
  },

  /** 跳转订单详情 */
  goToDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?orderId=${id}` });
  },

  /** 取消订单 */
  onCancelOrder(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消订单',
      content: '确定取消此订单吗？取消后不可恢复。',
      confirmColor: '#EE0A24',
      success: async (res) => {
        if (res.confirm) {
          try {
            await post(`/order/${id}/cancel`);
            wx.showToast({ title: '订单已取消', icon: 'success' });
            this.loadOrders(true);
          } catch (err: any) {
            wx.showToast({ title: err.message || '操作失败', icon: 'none' });
          }
        }
      },
    });
  },

  /** 去支付 */
  onPayOrder(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?orderId=${id}` });
  },

  /** 确认收货 */
  onConfirmReceive(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？',
      confirmColor: '#333333',
      success: async (res) => {
        if (res.confirm) {
          try {
            await post(`/order/${id}/confirm`);
            wx.showToast({ title: '已确认收货', icon: 'success' });
            this.loadOrders(true);
          } catch (err: any) {
            wx.showToast({ title: err.message || '操作失败', icon: 'none' });
          }
        }
      },
    });
  },

  /** 再来一单 / 重新下单 */
  onReorder(e: WechatMiniprogram.TouchEvent) {
    const modelId = e.currentTarget.dataset.modelId;
    wx.navigateTo({
      url: `/pages/product-customize/product-customize?modelId=${modelId}`,
    });
  },

  /** 去定制（空状态） */
  goToCustomize() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  /** 阻止事件冒泡 */
  preventBubble() {},
});
