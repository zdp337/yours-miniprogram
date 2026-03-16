// 生成失败页 — Yours·凝刻（多引擎版）

import { post } from '../../utils/request';

const ENGINE_LABELS: Record<string, string> = {
  tripo: 'Tripo3D',
  hunyuan: '混元3D',
};

Page({
  data: {
    modelId: 0,
    photoId: 0,
    engine: 'tripo',
    engineLabel: 'Tripo3D',
    failReason: '生成遇到了一些问题，请重试',
    retryCount: 0,
    retryDisabled: false,
  },

  onLoad(options: Record<string, string>) {
    const modelId = parseInt(options.modelId || '0', 10);
    const photoId = parseInt(options.photoId || '0', 10);
    const failReason = decodeURIComponent(options.reason || '生成遇到了一些问题，请重试');
    const retryCount = parseInt(options.retryCount || '0', 10);
    const engine = options.engine || 'tripo';

    this.setData({
      modelId,
      photoId,
      engine,
      engineLabel: ENGINE_LABELS[engine] || engine,
      failReason,
      retryCount,
      retryDisabled: retryCount >= 3,
    });
  },

  /** 重新尝试（使用原引擎） */
  async onRetry() {
    if (this.data.retryDisabled || !this.data.modelId) return;
    await this.doRetry(this.data.engine);
  },

  /** 切换引擎重试 */
  onSwitchEngineRetry() {
    if (this.data.retryDisabled || !this.data.modelId) return;

    const otherEngine = this.data.engine === 'tripo' ? 'hunyuan' : 'tripo';
    const otherLabel = ENGINE_LABELS[otherEngine] || otherEngine;

    wx.showModal({
      title: '切换引擎',
      content: `切换为 ${otherLabel} 引擎重新生成？`,
      confirmText: '确认切换',
      success: async (res) => {
        if (res.confirm) {
          await this.doRetry(otherEngine);
        }
      },
    });
  },

  /** 执行重试 */
  async doRetry(engine: string) {
    wx.showLoading({ title: '正在重试...', mask: true });

    try {
      const res = await post<{ id: number; engine: string; retryCount: number }>(
        `/model/${this.data.modelId}/retry`,
        { engine },
        { silent401: true }
      );
      wx.hideLoading();

      // 跳转到等待页
      wx.redirectTo({
        url: `/pages/generate-waiting/generate-waiting?modelId=${this.data.modelId}&photoId=${this.data.photoId}&engine=${res.data.engine || engine}`,
      });
    } catch (err: any) {
      wx.hideLoading();
      // token 过期：提示用户重新登录
      if (err.message === 'TOKEN_EXPIRED') {
        wx.showModal({
          title: '登录已过期',
          content: '请重新登录后继续操作',
          showCancel: false,
          success: () => {
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            wx.reLaunch({ url: '/pages/welcome/welcome' });
          },
        });
        return;
      }
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
