// AI生成等待页 — Yours·凝刻

import { post, get } from '../../utils/request';

Page({
  data: {
    photoId: 0,
    modelId: 0,
    status: 'uploading', // uploading | queued | generating | completed | failed
    statusTitle: '正在上传照片...',
    statusDesc: '准备中',
    statusEmoji: '🎨',
    progressPercent: 10,
    subscribed: false,
  },

  pollTimer: null as any,

  onLoad(options: Record<string, string>) {
    const photoId = parseInt(options.photoId || '0', 10);
    const modelId = parseInt(options.modelId || '0', 10);

    if (modelId) {
      // 从失败页重试过来，直接轮询
      this.setData({ modelId, photoId });
      this.startPolling();
    } else if (photoId) {
      this.setData({ photoId });
      this.startGenerate(photoId);
    }
  },

  onUnload() {
    this.stopPolling();
  },

  onHide() {
    // 页面隐藏不停止轮询，后台继续
  },

  /** 发起生成 */
  async startGenerate(photoId: number) {
    this.updateStatus('uploading', '正在上传照片...', '准备中', '📤', 15);

    try {
      const res = await post<{ id: number; status: string }>('/model/generate', { photoId });
      this.setData({ modelId: res.data.id });
      this.updateStatus('queued', '排队中...', '请耐心等待', '⏳', 30);
      this.startPolling();
    } catch (err: any) {
      if (err.message?.includes('次数已用完')) {
        wx.showModal({
          title: '提示',
          content: '今日免费次数已用完，明天再来试试吧~',
          showCancel: false,
          success: () => wx.navigateBack(),
        });
        return;
      }
      // 跳转到失败页
      wx.redirectTo({
        url: `/pages/generate-failed/generate-failed?photoId=${photoId}&reason=${encodeURIComponent('生成遇到了一些问题，请重试')}`,
      });
    }
  },

  /** 开始轮询 */
  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      this.checkStatus();
    }, 3000);
    // 立即检查一次
    this.checkStatus();
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  /** 检查生成状态 */
  async checkStatus() {
    if (!this.data.modelId) return;

    try {
      const res = await get<{
        status: string;
        modelUrl: string | null;
        previewUrl: string | null;
        failReason: string | null;
        retryCount: number;
      }>(`/model/${this.data.modelId}/status`);

      const { status, failReason, retryCount } = res.data;

      switch (status) {
        case 'queued':
          this.updateStatus('queued', '排队中...', '请耐心等待', '⏳', 30);
          break;

        case 'generating':
          this.updateStatus('generating', 'AI 正在创作你的手办...', '马上就好', '🎨', 65);
          break;

        case 'completed':
          this.stopPolling();
          this.updateStatus('completed', '🎉 你的手办生成好了！', '', '✨', 100);
          break;

        case 'failed':
          this.stopPolling();
          wx.redirectTo({
            url: `/pages/generate-failed/generate-failed?modelId=${this.data.modelId}&photoId=${this.data.photoId}&reason=${encodeURIComponent(failReason || '生成遇到了一些问题')}&retryCount=${retryCount}`,
          });
          break;
      }
    } catch (err) {
      console.error('[Waiting] 状态查询失败:', err);
    }
  },

  /** 更新状态展示 */
  updateStatus(
    status: string,
    title: string,
    desc: string,
    emoji: string,
    progress: number
  ) {
    this.setData({
      status,
      statusTitle: title,
      statusDesc: desc,
      statusEmoji: emoji,
      progressPercent: progress,
    });
  },

  /** 订阅消息 */
  onSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: ['YOUR_TEMPLATE_ID'], // 替换为实际模板 ID
      success: (res) => {
        this.setData({ subscribed: true });
      },
      fail: () => {
        wx.showToast({ title: '未授权通知', icon: 'none' });
      },
    });
  },

  /** 查看模型预览 */
  goToPreview() {
    wx.redirectTo({
      url: `/pages/model-preview/model-preview?modelId=${this.data.modelId}`,
    });
  },

  /** 回首页 */
  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  /** 返回拦截 */
  onBackPress() {
    if (this.data.status !== 'completed') {
      wx.showModal({
        title: '提示',
        content: '生成进行中，离开不影响生成哦',
        confirmText: '离开',
        cancelText: '继续等待',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        },
      });
      return;
    }
    wx.navigateBack();
  },
});
