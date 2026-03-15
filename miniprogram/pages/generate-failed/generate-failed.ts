// 生成失败页 — Yours·凝刻

import { post } from '../../utils/request';

Page({
  data: {
    modelId: 0,
    photoId: 0,
    failReason: '生成遇到了一些问题，请重试',
    retryCount: 0,
    retryDisabled: false,
  },

  onLoad(options: Record<string, string>) {
    const modelId = parseInt(options.modelId || '0', 10);
    const photoId = parseInt(options.photoId || '0', 10);
    const failReason = decodeURIComponent(options.reason || '生成遇到了一些问题，请重试');
    const retryCount = parseInt(options.retryCount || '0', 10);

    this.setData({
      modelId,
      photoId,
      failReason,
      retryCount,
      retryDisabled: retryCount >= 3,
    });
  },

  /** 重新尝试 */
  async onRetry() {
    if (this.data.retryDisabled || !this.data.modelId) return;

    wx.showLoading({ title: '正在重试...', mask: true });

    try {
      const res = await post<{ id: number; retryCount: number }>(
        `/model/${this.data.modelId}/retry`
      );
      wx.hideLoading();

      // 跳转到等待页
      wx.redirectTo({
        url: `/pages/generate-waiting/generate-waiting?modelId=${this.data.modelId}&photoId=${this.data.photoId}`,
      });
    } catch (err: any) {
      wx.hideLoading();
      if (err.message?.includes('重试次数')) {
        this.setData({ retryDisabled: true });
        wx.showToast({ title: '请更换照片再试', icon: 'none' });
      } else if (err.message?.includes('次数已用完')) {
        wx.showToast({ title: '今日次数已用完', icon: 'none' });
      } else {
        wx.showToast({ title: err.message || '重试失败', icon: 'none' });
      }
    }
  },

  /** 更换照片 */
  onReupload() {
    wx.redirectTo({ url: '/pages/photo-upload/photo-upload' });
  },

  /** 查看拍照指南 */
  goToGuide() {
    wx.navigateTo({ url: '/pages/photo-guide/photo-guide' });
  },
});
