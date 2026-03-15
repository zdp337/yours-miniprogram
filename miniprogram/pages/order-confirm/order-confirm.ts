// 订单确认页 — Yours·凝刻

import { get, post } from '../../utils/request';

Page({
  data: {
    // 订单数据（从产品定制页传入）
    modelId: 0,
    modelPreviewUrl: '',
    originalPhotoUrl: '',
    figurineSize: 'M',
    sizeLabel: 'M 标准款',
    sizeHeight: '约12cm',
    material: '高精度树脂',
    figurinePrice: '0.01',
    addons: [] as Array<{ type: string; spec: string; price: number; priceText: string }>,
    packageDealId: '',

    // 价格
    totalPrice: '0.00',
    discount: '0.00',
    payPrice: '0.00',

    // 收货地址
    address: null as any,

    // 备注
    remark: '',

    // 状态
    paying: false,
    orderId: 0,

    // 定制选项（用于创建订单）
    modelPhotoPrint: null as any,
    originalPhotoPrint: null as any,
    packageBox: null as any,
  },

  onLoad(options: Record<string, string>) {
    if (options.data) {
      try {
        const orderData = JSON.parse(decodeURIComponent(options.data));
        const sizeMap: Record<string, { label: string; height: string }> = {
          S: { label: 'S 迷你款', height: '约8cm' },
          M: { label: 'M 标准款', height: '约12cm' },
          L: { label: 'L 豪华款', height: '约18cm' },
        };
        const sizeInfo = sizeMap[orderData.figurineSize] || sizeMap.M;

        // 构建附加商品列表
        const addons = (orderData.addons || []).map((item: any) => ({
          ...item,
          priceText: item.price.toFixed(2),
        }));

        this.setData({
          modelId: orderData.modelId,
          modelPreviewUrl: orderData.modelPreviewUrl || '',
          originalPhotoUrl: orderData.originalPhotoUrl || '',
          figurineSize: orderData.figurineSize,
          sizeLabel: sizeInfo.label,
          sizeHeight: sizeInfo.height,
          figurinePrice: parseFloat(orderData.figurinePrice || '0.01').toFixed(2),
          addons,
          packageDealId: orderData.packageDealId || '',
          totalPrice: orderData.totalPrice,
          discount: orderData.discount,
          payPrice: orderData.payPrice,
          modelPhotoPrint: orderData.modelPhotoPrint || null,
          originalPhotoPrint: orderData.originalPhotoPrint || null,
          packageBox: orderData.packageBox || null,
        });
      } catch (e) {
        console.error('[OrderConfirm] 解析订单数据失败:', e);
      }
    }

    this.loadDefaultAddress();
  },

  onShow() {
    // 从地址列表选择返回时刷新
    const selectedAddress = (getApp() as any).globalData?.selectedAddress;
    if (selectedAddress) {
      this.setData({
        address: {
          ...selectedAddress,
          fullAddress: `${selectedAddress.province}${selectedAddress.city}${selectedAddress.district}${selectedAddress.detail}`,
        },
      });
      (getApp() as any).globalData.selectedAddress = null;
    }
  },

  /** 加载默认收货地址 */
  async loadDefaultAddress() {
    try {
      const res = await get<any[]>('/address/list');
      const list = res.data || [];
      const defaultAddr = list.find((a: any) => a.isDefault) || list[0];
      if (defaultAddr) {
        this.setData({
          address: {
            ...defaultAddr,
            fullAddress: defaultAddr.fullAddress || `${defaultAddr.province}${defaultAddr.city}${defaultAddr.district}${defaultAddr.detail}`,
          },
        });
      }
    } catch (err) {
      console.error('[OrderConfirm] 加载地址失败:', err);
    }
  },

  /** 选择/修改地址 */
  goToSelectAddress() {
    if (this.data.address) {
      wx.navigateTo({ url: '/pages/address-list/address-list?mode=select' });
    } else {
      wx.navigateTo({ url: '/pages/address-edit/address-edit' });
    }
  },

  /** 备注输入 */
  onRemarkInput(e: WechatMiniprogram.Input) {
    this.setData({ remark: e.detail.value });
  },

  /** 发起支付 */
  async onPay() {
    if (!this.data.address) {
      wx.showToast({ title: '请先添加收货地址', icon: 'none' });
      return;
    }

    if (this.data.paying) return;
    this.setData({ paying: true });

    try {
      // 1. 创建订单
      const createRes = await post<any>('/order/create', {
        modelId: this.data.modelId,
        addressId: this.data.address.id,
        figurineSize: this.data.figurineSize,
        modelPhotoPrint: this.data.modelPhotoPrint,
        originalPhotoPrint: this.data.originalPhotoPrint,
        packageBox: this.data.packageBox,
        packageDealId: this.data.packageDealId || undefined,
        remark: this.data.remark || undefined,
      });

      const orderId = createRes.data.id;
      const orderNo = createRes.data.orderNo;
      this.setData({ orderId });

      // 2. MVP 阶段：模拟支付（真实场景应调用 wx.requestPayment）
      const payRes = await post<any>(`/order/${orderId}/pay`);

      // 3. 支付成功跳转
      this.setData({ paying: false });
      wx.redirectTo({
        url: `/pages/order-success/order-success?orderId=${orderId}&orderNo=${orderNo}&payPrice=${this.data.payPrice}`,
      });
    } catch (err: any) {
      this.setData({ paying: false });
      console.error('[OrderConfirm] 支付失败:', err);

      if (err.message?.includes('超时')) {
        wx.showToast({ title: '订单已超时关闭，请重新下单', icon: 'none' });
      } else {
        wx.showModal({
          title: '支付未成功',
          content: err.message || '支付失败，请重试',
          confirmText: '我知道了',
          showCancel: false,
        });
      }
    }
  },
});
