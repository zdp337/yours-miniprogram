// 退款申请页 — Yours·凝刻

import { post } from '../../utils/request';

const REFUND_REASONS = [
  { id: 'unwanted', label: '不想要了' },
  { id: 'quality', label: '质量问题' },
  { id: 'not_match', label: '商品与描述不符' },
  { id: 'other', label: '其他' },
];

Page({
  data: {
    orderId: 0,
    orderNo: '',
    payPrice: '0.00',
    reasons: REFUND_REASONS,
    selectedReason: '',
    description: '',
    photos: [] as string[],
    submitting: false,
  },

  onLoad(options: Record<string, string>) {
    this.setData({
      orderId: parseInt(options.orderId || '0', 10),
      orderNo: options.orderNo || '',
      payPrice: options.payPrice || '0.00',
    });
  },

  /** 选择退款原因 */
  onReasonSelect(e: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedReason: e.currentTarget.dataset.id });
  },

  /** 退款说明输入 */
  onDescInput(e: WechatMiniprogram.Input) {
    this.setData({ description: e.detail.value });
  },

  /** 添加照片 */
  onAddPhoto() {
    const remaining = 3 - this.data.photos.length;
    if (remaining <= 0) return;

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newPhotos = res.tempFiles.map((f) => f.tempFilePath);
        this.setData({
          photos: [...this.data.photos, ...newPhotos],
        });
      },
    });
  },

  /** 删除照片 */
  onDeletePhoto(e: WechatMiniprogram.TouchEvent) {
    const index = e.currentTarget.dataset.index as number;
    const photos = [...this.data.photos];
    photos.splice(index, 1);
    this.setData({ photos });
  },

  /** 提交退款申请 */
  async onSubmit() {
    if (!this.data.selectedReason) {
      wx.showToast({ title: '请选择退款原因', icon: 'none' });
      return;
    }

    if (this.data.submitting) return;
    this.setData({ submitting: true });

    try {
      const reason = REFUND_REASONS.find((r) => r.id === this.data.selectedReason);
      await post(`/order/${this.data.orderId}/refund`, {
        reason: reason?.label || this.data.selectedReason,
        description: this.data.description || undefined,
      });

      wx.showToast({ title: '申请已提交', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err: any) {
      console.error('[RefundApply] 提交失败:', err);
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
